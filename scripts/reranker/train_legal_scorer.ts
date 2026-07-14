import {
  HARD_GUARD_FEATURE_NAMES,
  LEGAL_FEATURE_NAMES,
  type LegalFeatureName,
  type LegalFeatureWeights,
  scoreLegalCandidates,
  TRAINING_SEED_WEIGHTS,
} from "../../supabase/functions/_shared/legal-feature-scorer.ts";
import type { MetricCorpusRow } from "../../supabase/functions/_shared/metric-search.ts";
import type { StatusScope } from "../../supabase/functions/_shared/rag-types.ts";

type Gold = {
  query_id: string;
  query: string;
  status_scope: StatusScope;
  expected_document_ids: string[];
  graded_relevance: Record<string, number>;
  answerable: boolean;
  split: "train" | "dev" | "test";
};

type Candidate = {
  chunk_id: string;
  document_id: string;
  text: string;
  title: string;
  source: string | null;
  source_url: string | null;
  citation_anchor: string | null;
  content_domain: "knowledge_base" | "practice" | "unknown";
  norm_status: string;
  effective_from: string | null;
  effective_to: string | null;
  metric_cosine_similarity: number;
  fts_score: number;
  fts_rank: number | null;
  identifier_match: number;
  citation_metadata: Record<string, unknown>;
  duplicate_group: string;
  ann_rank: number | null;
  identifier_rank: number | null;
  rrf_score: number;
};

type Pool = { query_id: string; candidates: Candidate[] };
type Item = {
  chunkId: string;
  documentId: string;
  relevance: number;
  features: number[];
};
type Query = { queryId: string; items: Item[] };

function cli(argv: string[]) {
  const result: Record<string, string> = {};
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index].startsWith("--")) {
      result[argv[index].slice(2)] = argv[++index] ?? "";
    }
  }
  for (const name of ["gold", "pools", "output"]) {
    if (!result[name]) throw new Error(`--${name} required`);
  }
  return result;
}

async function jsonl<T>(path: string): Promise<T[]> {
  return (await Deno.readTextFile(path)).split(/\r?\n/).map((line) =>
    line.trim()
  ).filter(Boolean).map((line) => JSON.parse(line));
}

function row(candidate: Candidate, scope: StatusScope): MetricCorpusRow {
  return {
    chunk_id: candidate.chunk_id,
    document_id: candidate.document_id,
    version_id: candidate.document_id,
    chunk_text: candidate.text,
    title: candidate.title,
    source: candidate.source,
    language: "hy",
    content_domain: candidate.content_domain,
    norm_status: candidate.norm_status,
    effective_from: candidate.effective_from,
    effective_to: candidate.effective_to,
    status_scope: scope,
    status_eligible: true,
    legal_status_warning: candidate.norm_status === "active"
      ? null
      : candidate.norm_status,
    status_reason_code: candidate.norm_status,
    vector_similarity: candidate.metric_cosine_similarity,
    fts_rank: candidate.fts_score,
    identifier_match: candidate.identifier_match,
    identifier_rank: candidate.identifier_rank,
    ann_rank: candidate.ann_rank,
    fts_rank_position: candidate.fts_rank,
    rrf_score: candidate.rrf_score,
    duplicate_group: candidate.duplicate_group,
    source_url: candidate.source_url,
    citation_anchor: candidate.citation_anchor,
    citation_metadata: candidate.citation_metadata,
  };
}

function buildQueries(
  golds: Gold[],
  pools: Map<string, Pool>,
  split: "train" | "dev",
): Query[] {
  return golds.filter((gold) => gold.answerable && gold.split === split).map(
    (gold) => {
      const pool = pools.get(gold.query_id)!;
      const expectedDocuments = new Set(gold.expected_document_ids);
      const scored = scoreLegalCandidates(
        gold.query,
        pool.candidates.map((candidate) => row(candidate, gold.status_scope)),
        {
          statusScope: gold.status_scope,
        },
      );
      return {
        queryId: gold.query_id,
        items: scored.map((item) => ({
          chunkId: item.row.chunk_id,
          documentId: item.row.document_id,
          relevance: gold.graded_relevance[item.row.chunk_id] ??
            (expectedDocuments.has(item.row.document_id) ? 3 : 0),
          features: LEGAL_FEATURE_NAMES.map((name) => item.features[name]),
        })),
      };
    },
  );
}

function pairs(queries: Query[]): Array<[number[], number[]]> {
  const result: Array<[number[], number[]]> = [];
  for (const query of queries) {
    const positives = query.items.filter((item) => item.relevance > 0);
    const negatives = query.items.filter((item) => item.relevance === 0).slice(
      0,
      20,
    );
    for (const positive of positives) {
      for (const negative of negatives) {
        result.push([positive.features, negative.features]);
      }
    }
  }
  return result;
}

function train(
  trainingPairs: Array<[number[], number[]]>,
  l2: number,
): number[] {
  const weights = LEGAL_FEATURE_NAMES.map((name) =>
    TRAINING_SEED_WEIGHTS[name]
  );
  for (let epoch = 0; epoch < 240; epoch += 1) {
    const gradient = weights.map((weight) => l2 * weight);
    for (const [positive, negative] of trainingPairs) {
      let margin = 0;
      for (let index = 0; index < weights.length; index += 1) {
        margin += weights[index] * (positive[index] - negative[index]);
      }
      const coefficient = -1 / (1 + Math.exp(Math.min(40, margin)));
      for (let index = 0; index < weights.length; index += 1) {
        gradient[index] += coefficient * (positive[index] - negative[index]);
      }
    }
    const learningRate = 0.08 / Math.sqrt(1 + epoch / 20);
    for (let index = 0; index < weights.length; index += 1) {
      weights[index] -= learningRate * gradient[index] /
        Math.max(1, trainingPairs.length);
      const penalty = LEGAL_FEATURE_NAMES[index].endsWith("penalty");
      weights[index] = HARD_GUARD_FEATURE_NAMES.has(LEGAL_FEATURE_NAMES[index])
        ? 0
        : penalty
        ? Math.min(0, Math.max(-2, weights[index]))
        : Math.max(0, Math.min(2, weights[index]));
    }
  }
  const positiveSum = weights.reduce(
    (sum, weight) => sum + Math.max(0, weight),
    0,
  );
  return weights.map((weight) =>
    weight / Math.max(Number.EPSILON, positiveSum)
  );
}

function score(item: Item, weights: number[]): number {
  return item.features.reduce(
    (sum, value, index) => sum + value * weights[index],
    0,
  );
}

function dcg(values: number[]): number {
  return values.reduce(
    (sum, value, index) => sum + (2 ** value - 1) / Math.log2(index + 2),
    0,
  );
}

function evaluate(queries: Query[], weights: number[]) {
  let mrr = 0;
  let ndcg10 = 0;
  let recall10 = 0;
  for (const query of queries) {
    const ranked = [...query.items].sort((left, right) =>
      score(right, weights) - score(left, weights) ||
      left.chunkId.localeCompare(right.chunkId)
    );
    const first = ranked.findIndex((item) => item.relevance > 0);
    if (first >= 0) mrr += 1 / (first + 1);
    const actual = ranked.slice(0, 10).map((item) => item.relevance);
    const ideal = query.items.map((item) => item.relevance).sort((a, b) =>
      b - a
    ).slice(0, 10);
    ndcg10 += dcg(actual) / Math.max(dcg(ideal), Number.EPSILON);
    recall10 += ranked.slice(0, 10).some((item) => item.relevance > 0) ? 1 : 0;
  }
  const count = Math.max(1, queries.length);
  return {
    query_count: queries.length,
    mrr: mrr / count,
    ndcg_at_10: ndcg10 / count,
    recall_at_10: recall10 / count,
  };
}

function weightMap(weights: number[]): LegalFeatureWeights {
  return Object.fromEntries(
    LEGAL_FEATURE_NAMES.map((name, index) => [name, weights[index]]),
  ) as LegalFeatureWeights;
}

async function main() {
  const options = cli(Deno.args);
  const golds = await jsonl<Gold>(options.gold);
  const poolList = await jsonl<Pool>(options.pools);
  const pools = new Map(poolList.map((pool) => [pool.query_id, pool]));
  const trainQueries = buildQueries(golds, pools, "train");
  const devQueries = buildQueries(golds, pools, "dev");
  const trainingPairs = pairs(trainQueries);
  const trials = [0, 0.0001, 0.001, 0.01].map((l2) => {
    const weights = train(trainingPairs, l2);
    return {
      l2,
      weights,
      train: evaluate(trainQueries, weights),
      dev: evaluate(devQueries, weights),
    };
  });
  trials.sort((left, right) =>
    right.dev.ndcg_at_10 - left.dev.ndcg_at_10 || right.dev.mrr - left.dev.mrr
  );
  const best = trials[0];
  const groups: Record<string, LegalFeatureName[]> = {
    retrieval: [
      "metric_cosine_similarity",
      "ann_rank_score",
      "armenian_fts_score",
      "fts_rank_score",
      "identifier_match",
      "rrf_score",
    ],
    exact: [
      "exact_phrase_match",
      "exact_title_match",
      "document_number_match",
      "article_match",
      "part_match",
      "point_match",
      "subpoint_match",
      "case_number_match",
      "date_match",
      "canonical_key_match",
    ],
    legal: [
      "query_intent_match",
      "content_domain_match",
      "legal_domain_match",
      "authority_level",
      "jurisdiction_match",
      "document_type_match",
      "source_type_match",
      "current_version_signal",
      "norm_status_signal",
      "status_eligibility",
      "effective_date_validity",
      "specific_provision_bonus",
      "source_quality",
      "chunk_quality",
      "text_completeness",
    ],
    diversity: [
      "exact_duplicate_penalty",
      "near_duplicate_penalty",
      "document_repetition_penalty",
      "source_diversity_bonus",
    ],
  };
  const ablationCandidates = Object.entries(groups).map(([group, names]) => {
    const weights = [...best.weights];
    for (const name of names) weights[LEGAL_FEATURE_NAMES.indexOf(name)] = 0;
    return {
      group,
      weights,
      train: evaluate(trainQueries, weights),
      dev: evaluate(devQueries, weights),
    };
  });
  const ablation = Object.fromEntries(
    ablationCandidates.map((candidate) => [candidate.group, {
      train: candidate.train,
      dev: candidate.dev,
    }]),
  );
  const selected = [
    { group: null, weights: best.weights, train: best.train, dev: best.dev },
    ...ablationCandidates,
  ].sort((left, right) =>
    right.dev.ndcg_at_10 - left.dev.ndcg_at_10 ||
    right.dev.mrr - left.dev.mrr ||
    right.train.ndcg_at_10 - left.train.ndcg_at_10
  )[0];
  const output = {
    evidence_class: "PROVISIONAL_NON_EXPERT_TRAIN_DEV_ONLY",
    release_eligible: false,
    test_split_used_for_tuning: false,
    training_queries: trainQueries.length,
    dev_queries: devQueries.length,
    pair_count: trainingPairs.length,
    selected_l2: best.l2,
    selected_post_training_ablation: selected.group,
    selected_weights: weightMap(selected.weights),
    train_metrics: selected.train,
    dev_metrics: selected.dev,
    trials: trials.map((trial) => ({
      l2: trial.l2,
      train: trial.train,
      dev: trial.dev,
    })),
    ablation,
  };
  await Deno.writeTextFile(
    options.output,
    JSON.stringify(output, null, 2) + "\n",
  );
  console.log(JSON.stringify(output, null, 2));
}

await main();
