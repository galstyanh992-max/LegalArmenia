import { scoreLegalCandidates } from "../../supabase/functions/_shared/legal-feature-scorer.ts";
import {
  decideNoAnswer,
  type RankedMetricRow,
} from "../../supabase/functions/_shared/legal-reranking.ts";
import {
  requestRerank,
  type RerankerConfig,
} from "../../supabase/functions/_shared/reranker-client.ts";
import type { MetricCorpusRow } from "../../supabase/functions/_shared/metric-search.ts";
import type { StatusScope } from "../../supabase/functions/_shared/rag-types.ts";

type Gold = {
  query_id: string;
  query: string;
  intent: string;
  status_scope: StatusScope;
  effective_at: string | null;
  expected_document_ids: string[];
  expected_chunk_ids: string[];
  expected_provisions: string[];
  prohibited_document_ids: string[];
  graded_relevance: Record<string, number>;
  answerable: boolean;
  split: "train" | "dev" | "test";
};

type PoolCandidate = {
  candidate_id: string;
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

type Pool = {
  query_id: string;
  query: string;
  intent: string;
  status_scope: StatusScope;
  answerable: boolean;
  split: "train" | "dev" | "test";
  lane_rankings: { fts: string[]; metric_ann: string[]; rrf: string[] };
  candidates: PoolCandidate[];
};

type QueryRun = {
  query_id: string;
  ranking: string[];
  no_answer: boolean;
  latency_ms: number;
  reranker_ok?: boolean;
  degraded_reason?: string;
  raw_scores?: Array<
    { candidate_id: string; raw_score: number; normalized_score: number }
  >;
  support_score?: number;
  no_answer_reasons?: string[];
};

function args(argv: string[]) {
  const result: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i].startsWith("--")) result[argv[i].slice(2)] = argv[++i] ?? "";
  }
  for (const required of ["gold", "pools", "output", "system"]) {
    if (!result[required]) throw new Error(`--${required} is required`);
  }
  return result;
}

async function readJsonl<T>(path: string): Promise<T[]> {
  return (await Deno.readTextFile(path)).split(/\r?\n/).map((line) =>
    line.trim()
  ).filter(Boolean).map((line) => JSON.parse(line));
}

function asMetric(
  candidate: PoolCandidate,
  scope: StatusScope,
): MetricCorpusRow {
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
    status_eligible: statusEligible(candidate.norm_status, scope),
    legal_status_warning: candidate.norm_status === "unknown"
      ? "Статус действия документа не подтверждён."
      : candidate.norm_status === "repealed"
      ? "Документ утратил силу или помечен как недействующий."
      : null,
    status_reason_code: candidate.norm_status === "active"
      ? "CURRENT_ACTIVE"
      : candidate.norm_status === "unknown"
      ? "UNCONFIRMED_STATUS"
      : "REPEALED_HISTORICAL",
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

function statusEligible(status: string, scope: StatusScope): boolean {
  if (scope === "current") return status === "active";
  if (scope === "extended") return status === "active" || status === "unknown";
  return status === "active" || status === "unknown" || status === "repealed";
}

function effectiveAtEligible(
  row: MetricCorpusRow,
  effectiveAt: string | null,
): boolean {
  if (!effectiveAt) return true;
  const at = Date.parse(effectiveAt);
  if (!Number.isFinite(at)) return false;
  const from = row.effective_from
    ? Date.parse(row.effective_from)
    : Number.NEGATIVE_INFINITY;
  const to = row.effective_to
    ? Date.parse(row.effective_to)
    : Number.POSITIVE_INFINITY;
  return (!Number.isFinite(from) || from <= at) &&
    (!Number.isFinite(to) || at < to);
}

function diversify(rows: RankedMetricRow[], limit = 20): RankedMetricRow[] {
  const output: RankedMetricRow[] = [];
  const documents = new Map<string, number>();
  const sources = new Set<string>();
  const duplicateGroups = new Set<string>();
  const pending = [...rows];
  while (pending.length && output.length < limit) {
    let index = pending.findIndex((row) =>
      (documents.get(row.document_id) ?? 0) < 3 &&
      !duplicateGroups.has(row.duplicate_group) &&
      !sources.has(row.source ?? "unknown")
    );
    if (index < 0) {
      index = pending.findIndex((row) =>
        (documents.get(row.document_id) ?? 0) < 3 &&
        !duplicateGroups.has(row.duplicate_group)
      );
    }
    if (index < 0) break;
    const [row] = pending.splice(index, 1);
    output.push(row);
    documents.set(row.document_id, (documents.get(row.document_id) ?? 0) + 1);
    sources.add(row.source ?? "unknown");
    duplicateGroups.add(row.duplicate_group);
  }
  return output;
}

function percentile(values: number[], q: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * q;
  const low = Math.floor(index);
  const high = Math.ceil(index);
  return sorted[low] + (sorted[high] - sorted[low]) * (index - low);
}

function candidateMap(pool: Pool): Map<string, PoolCandidate> {
  return new Map(
    pool.candidates.map((candidate) => [candidate.chunk_id, candidate]),
  );
}

function relevantDocumentIds(gold: Gold): Set<string> {
  return new Set(gold.expected_document_ids);
}

function dcg(relevances: number[]): number {
  return relevances.reduce(
    (sum, relevance, index) =>
      sum + (2 ** relevance - 1) / Math.log2(index + 2),
    0,
  );
}

function evaluate(
  golds: Gold[],
  pools: Map<string, Pool>,
  runs: Map<string, QueryRun>,
) {
  const answerable = golds.filter((gold) => gold.answerable);
  let recall5 = 0;
  let recall10 = 0;
  let recall20 = 0;
  let precision5 = 0;
  let mrr = 0;
  let ndcg10 = 0;
  let citationDocument = 0;
  let citationProvision = 0;
  let currentContamination = 0;
  let warningCorrect = 0;
  let warningTotal = 0;
  let noAnswerFalsePositive = 0;
  let noAnswerFalseNegative = 0;
  for (const gold of golds) {
    const pool = pools.get(gold.query_id)!;
    const byId = candidateMap(pool);
    const run = runs.get(gold.query_id)!;
    const ranking = run.ranking.map((id) => byId.get(id)).filter((
      value,
    ): value is PoolCandidate => Boolean(value));
    if (gold.answerable && run.no_answer) noAnswerFalseNegative += 1;
    if (!gold.answerable && !run.no_answer) noAnswerFalsePositive += 1;
    if (!gold.answerable) continue;
    const relevantDocs = relevantDocumentIds(gold);
    const recallAt = (k: number) =>
      new Set(
        ranking.slice(0, k).filter((candidate) =>
          relevantDocs.has(candidate.document_id)
        ).map((candidate) => candidate.document_id),
      ).size / Math.max(1, relevantDocs.size);
    recall5 += recallAt(5);
    recall10 += recallAt(10);
    recall20 += recallAt(20);
    precision5 += ranking.slice(0, 5).filter((candidate) =>
      relevantDocs.has(candidate.document_id)
    ).length / 5;
    const first = ranking.findIndex((candidate) =>
      relevantDocs.has(candidate.document_id)
    );
    if (first >= 0) {
      mrr += 1 / (first + 1);
    }
    const relevance = ranking.slice(0, 10).map((candidate) =>
      gold.graded_relevance[candidate.chunk_id] ??
        (relevantDocs.has(candidate.document_id) ? 3 : 0)
    );
    const ideal = Object.values(gold.graded_relevance).sort((a, b) =>
      b - a
    )
      .slice(0, 10);
    ndcg10 += ideal.length
      ? dcg(relevance) / Math.max(dcg(ideal), Number.EPSILON)
      : 0;
    const top = ranking[0];
    if (top && relevantDocs.has(top.document_id)) citationDocument += 1;
    const topCitation = `${top?.citation_anchor ?? ""} ${
      top?.citation_metadata?.document_number ?? ""
    }`.toLocaleLowerCase();
    if (
      !gold.expected_provisions.length ||
      gold.expected_provisions.some((provision) =>
        topCitation.includes(provision.toLocaleLowerCase())
      )
    ) {
      citationProvision += 1;
    }
    if (
      gold.status_scope === "current" &&
      ranking.slice(0, 10).some((candidate) =>
        candidate.norm_status !== "active"
      )
    ) currentContamination += 1;
    const expectedWarning = ranking.find((candidate) =>
      relevantDocs.has(candidate.document_id) &&
      candidate.norm_status !== "active"
    );
    if (expectedWarning) {
      warningTotal += 1;
      if (
        ["unknown", "repealed"].includes(expectedWarning.norm_status)
      ) warningCorrect += 1;
    }
  }
  const n = Math.max(1, answerable.length);
  const noAnswerCount = Math.max(
    1,
    golds.filter((gold) => !gold.answerable).length,
  );
  const latencies = [...runs.values()].map((run) => run.latency_ms);
  return {
    query_count: golds.length,
    answerable_count: answerable.length,
    recall_at_5: recall5 / n,
    recall_at_10: recall10 / n,
    recall_at_20: recall20 / n,
    precision_at_5: precision5 / n,
    mrr: mrr / n,
    ndcg_at_10: ndcg10 / n,
    citation_document_accuracy: citationDocument / n,
    citation_provision_accuracy: citationProvision / n,
    no_answer_false_positive_rate: noAnswerFalsePositive / noAnswerCount,
    no_answer_false_negative_rate: noAnswerFalseNegative / n,
    current_law_contamination: currentContamination / n,
    warning_accuracy: warningTotal ? warningCorrect / warningTotal : 1,
    cross_tenant_leakage: null,
    cross_tenant_measurement:
      "not measurable: frozen corpus rows have no tenant dimension",
    latency_ms: {
      p50: percentile(latencies, 0.5),
      p95: percentile(latencies, 0.95),
      p99: percentile(latencies, 0.99),
    },
    throughput_queries_per_second:
      latencies.reduce((sum, value) => sum + value, 0) > 0
        ? 1000 * latencies.length /
          latencies.reduce((sum, value) => sum + value, 0)
        : null,
    cost_per_query_usd: 0,
    timeout_rate:
      [...runs.values()].filter((run) =>
        run.degraded_reason === "RERANKER_TIMEOUT"
      ).length / Math.max(1, runs.size),
    fallback_correctness: [...runs.values()].filter((run) =>
      run.degraded_reason
    ).every((run) => run.reranker_ok !== true),
  };
}

function baselineRun(system: string, gold: Gold, pool: Pool): QueryRun {
  const started = performance.now();
  const byId = candidateMap(pool);
  let ranking: string[];
  let noAnswer = false;
  let supportScore: number | undefined;
  let noAnswerReasons: string[] | undefined;
  if (system === "A") ranking = pool.lane_rankings.fts;
  else if (system === "B") ranking = pool.lane_rankings.metric_ann;
  else if (system === "C") ranking = pool.lane_rankings.rrf;
  else {
    const eligibleRows = pool.candidates.map((candidate) =>
      asMetric(candidate, gold.status_scope)
    ).filter((row) =>
      row.status_eligible && effectiveAtEligible(row, gold.effective_at)
    );
    const scored = scoreLegalCandidates(
      gold.query,
      eligibleRows,
      {
        statusScope: gold.status_scope,
        effectiveAt: gold.effective_at,
      },
    ).sort((left, right) =>
      right.deterministic_score - left.deterministic_score ||
      left.row.chunk_id.localeCompare(right.row.chunk_id)
    );
    const ranked = scored.map((item): RankedMetricRow => ({
      ...item.row,
      legal_feature_score: item.deterministic_score,
      reranker_score: null,
      final_score: item.deterministic_score,
      legal_features: item.features,
    }));
    const diversified = diversify(ranked);
    const decision = decideNoAnswer(diversified, {
      rerankerOk: false,
      statusScope: gold.status_scope,
      query: gold.query,
    });
    supportScore = decision.support_score;
    noAnswerReasons = decision.reasons;
    noAnswer = system === "D" && !decision.answerable;
    ranking = noAnswer ? [] : diversified.map((row) => row.chunk_id);
  }
  ranking = ranking.filter((id) => byId.has(id));
  return {
    query_id: gold.query_id,
    ranking,
    no_answer: noAnswer,
    latency_ms: performance.now() - started,
    support_score: supportScore,
    no_answer_reasons: noAnswerReasons,
  };
}

async function rerankerRun(
  gold: Gold,
  pool: Pool,
  options: Record<string, string>,
  storedRun?: QueryRun,
): Promise<QueryRun> {
  const config: RerankerConfig = {
    enabled: true,
    endpoint: options.endpoint,
    apiKey: options["api-key"],
    expectedModel: options.model,
    expectedRevision: options.revision,
    timeoutMs: Number(options.timeout ?? "120000"),
    maxBatchSize: 50,
    failureThreshold: 3,
    cooldownMs: 60_000,
  };
  const rows = pool.candidates.map((candidate) =>
    asMetric(candidate, gold.status_scope)
  ).filter((row) =>
    row.status_eligible && effectiveAtEligible(row, gold.effective_at)
  );
  const deterministic = scoreLegalCandidates(gold.query, rows, {
    statusScope: gold.status_scope,
  });
  const byDeterministic = new Map(
    deterministic.map((item) => [item.row.chunk_id, item]),
  );
  const liveResult = storedRun
    ? null
    : await requestRerank(gold.query, rows, { config });
  if (liveResult && !liveResult.ok) {
    const fallback = baselineRun("D", gold, pool);
    return {
      ...fallback,
      reranker_ok: false,
      degraded_reason: liveResult.reason,
      latency_ms: liveResult.latency_ms,
    };
  }
  const unfilteredScores = storedRun?.raw_scores ??
    (liveResult?.ok ? liveResult.results : []);
  const expectedIds = new Set(rows.map((row) => row.chunk_id));
  const scores = unfilteredScores.filter((score) =>
    expectedIds.has(score.candidate_id)
  );
  const scoreIds = new Set(scores.map((score) => score.candidate_id));
  if (
    scores.length !== rows.length || scoreIds.size !== expectedIds.size ||
    [...expectedIds].some((id) => !scoreIds.has(id)) ||
    scores.some((score) =>
      !Number.isFinite(score.raw_score) ||
      !Number.isFinite(score.normalized_score) ||
      score.normalized_score < 0 || score.normalized_score > 1
    )
  ) {
    throw new Error(`invalid stored/live score set for ${gold.query_id}`);
  }
  const crossEncoderWeight = Number(options["cross-encoder-weight"] ?? "0.65");
  if (
    !Number.isFinite(crossEncoderWeight) || crossEncoderWeight < 0 ||
    crossEncoderWeight > 1
  ) {
    throw new Error("--cross-encoder-weight must be within [0, 1]");
  }
  const ranked = scores.map((score): RankedMetricRow => {
    const deterministicItem = byDeterministic.get(score.candidate_id)!;
    return {
      ...deterministicItem.row,
      legal_feature_score: deterministicItem.deterministic_score,
      reranker_score: score.normalized_score,
      final_score: crossEncoderWeight * score.normalized_score +
        (1 - crossEncoderWeight) * deterministicItem.deterministic_score,
      legal_features: deterministicItem.features,
    };
  }).sort((left, right) =>
    right.final_score - left.final_score ||
    left.chunk_id.localeCompare(right.chunk_id)
  );
  const diversified = diversify(ranked);
  const decision = decideNoAnswer(diversified, {
    rerankerOk: true,
    statusScope: gold.status_scope,
    query: gold.query,
  });
  return {
    query_id: gold.query_id,
    ranking: decision.answerable ? diversified.map((row) => row.chunk_id) : [],
    no_answer: !decision.answerable,
    latency_ms: storedRun?.latency_ms ??
      (liveResult?.ok ? liveResult.latency_ms : 0),
    reranker_ok: true,
    raw_scores: unfilteredScores,
    support_score: decision.support_score,
    no_answer_reasons: decision.reasons,
  };
}

async function main() {
  const options = args(Deno.args);
  const golds = await readJsonl<Gold>(options.gold);
  const allPools = await readJsonl<Pool>(options.pools);
  const pools = new Map(allPools.map((pool) => [pool.query_id, pool]));
  const storedRuns = options["scores-from"]
    ? new Map<string, QueryRun>(
      (JSON.parse(await Deno.readTextFile(options["scores-from"])) as {
        runs: QueryRun[];
      })
        .runs.map((run) => [run.query_id, run]),
    )
    : undefined;
  const split = options.split || "all";
  const splitSelected = split === "all"
    ? golds
    : golds.filter((gold) => gold.split === split);
  const limit = Number(options.limit ?? "0");
  const selected = Number.isFinite(limit) && limit > 0
    ? splitSelected.slice(0, Math.trunc(limit))
    : splitSelected;
  const runs = new Map<string, QueryRun>();
  for (const [index, gold] of selected.entries()) {
    const pool = pools.get(gold.query_id);
    if (!pool) throw new Error(`missing pool ${gold.query_id}`);
    const run = ["A", "B", "C", "D", "D-RANK"].includes(options.system)
      ? baselineRun(options.system, gold, pool)
      : await rerankerRun(gold, pool, options, storedRuns?.get(gold.query_id));
    runs.set(gold.query_id, run);
    if ((index + 1) % 10 === 0) {
      console.log(`${options.system}: ${index + 1}/${selected.length}`);
    }
  }
  const metrics = evaluate(selected, pools, runs);
  const scopes = Object.fromEntries(
    [...new Set(selected.map((gold) => gold.status_scope))].map((scope) => [
      scope,
      evaluate(
        selected.filter((gold) => gold.status_scope === scope),
        pools,
        runs,
      ),
    ]),
  );
  const intents = Object.fromEntries(
    [...new Set(selected.map((gold) => gold.intent))].map((intent) => [
      intent,
      evaluate(selected.filter((gold) => gold.intent === intent), pools, runs),
    ]),
  );
  const output = {
    system: options.system,
    model: options.model || null,
    revision: options.revision || null,
    cross_encoder_weight: options["cross-encoder-weight"]
      ? Number(options["cross-encoder-weight"])
      : 0.65,
    split,
    evidence_class: "PROVISIONAL_NON_EXPERT_SHADOW_POOL",
    release_eligible: false,
    metrics,
    by_scope: scopes,
    by_intent: intents,
    runs: [...runs.values()],
  };
  await Deno.writeTextFile(
    options.output,
    JSON.stringify(output, null, 2) + "\n",
  );
  console.log(
    JSON.stringify({ system: options.system, split, metrics }, null, 2),
  );
}

await main();
