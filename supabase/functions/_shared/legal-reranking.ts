import type { MetricCorpusRow } from "./metric-search.ts";
import type { StatusScope } from "./rag-types.ts";
import {
  type LegalFeatureVector,
  type LegalScoredRow,
  scoreLegalCandidates,
} from "./legal-feature-scorer.ts";
import {
  loadRerankerConfig,
  requestRerank,
  type RerankerConfig,
  type RerankerFailure,
} from "./reranker-client.ts";

export const NO_ANSWER_TEXT =
  "В подключённом корпусе недостаточно подтверждённой информации для надёжного ответа.";

export interface NoAnswerSignals {
  retrieval_relevance: number;
  status_eligibility: number;
  authority: number;
  evidence_sufficiency: number;
  contradiction: number;
  citation_support: number;
}

export interface NoAnswerDecision {
  answerable: boolean;
  text: string | null;
  reasons: string[];
  signals: NoAnswerSignals;
  calibration: "train_dev_v2_unreleased";
  support_score: number;
}

export interface RankedMetricRow extends MetricCorpusRow {
  legal_feature_score: number;
  reranker_score: number | null;
  final_score: number;
  legal_features: LegalFeatureVector;
}

export interface LegalRerankingResult {
  rows: RankedMetricRow[] | MetricCorpusRow[];
  enabled: boolean;
  reranker_ok: boolean;
  degraded: boolean;
  degraded_reason?: RerankerFailure["reason"];
  retrieval_route:
    | "identifier+metric_hy+fts"
    | "identifier+fts"
    | "identifier+metric_hy+fts+deterministic_legal_score"
    | "identifier+metric_hy+fts+deterministic_legal_score+cross_encoder";
  model?: string;
  revision?: string;
  latency_ms?: number;
  no_answer?: NoAnswerDecision;
}

function clamp(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

function envNumber(
  name: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const raw = typeof Deno !== "undefined"
    ? Number(Deno.env.get(name))
    : Number.NaN;
  return Number.isFinite(raw) ? Math.min(max, Math.max(min, raw)) : fallback;
}

function validStatus(row: MetricCorpusRow, scope: StatusScope): boolean {
  if (row.status_eligible !== true) return false;
  if (scope === "current") return row.norm_status === "active";
  if (scope === "extended") {
    return row.norm_status === "active" || row.norm_status === "unknown";
  }
  return ["active", "unknown", "repealed"].includes(row.norm_status);
}

function validDate(row: MetricCorpusRow, effectiveAt?: string | null): boolean {
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

function diversify(rows: RankedMetricRow[], limit: number): RankedMetricRow[] {
  const result: RankedMetricRow[] = [];
  const documents = new Map<string, number>();
  const sources = new Set<string>();
  const duplicateGroups = new Set<string>();
  const pending = [...rows];
  while (pending.length && result.length < limit) {
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
    result.push(row);
    documents.set(row.document_id, (documents.get(row.document_id) ?? 0) + 1);
    sources.add(row.source ?? "unknown");
    duplicateGroups.add(row.duplicate_group);
  }
  return result;
}

export function decideNoAnswer(
  rows: RankedMetricRow[],
  options: {
    rerankerOk: boolean;
    statusScope: StatusScope;
    query?: string;
    supportThreshold?: number;
  },
): NoAnswerDecision {
  const top = rows[0];
  const relevant = rows.filter((row) => row.final_score >= 0.25);
  const statuses = new Set(relevant.map((row) => row.norm_status));
  const signals: NoAnswerSignals = {
    retrieval_relevance: clamp(top?.final_score ?? 0),
    status_eligibility: clamp(top?.legal_features.status_eligibility ?? 0),
    authority: clamp(top?.legal_features.authority_level ?? 0),
    evidence_sufficiency: clamp(relevant.length / 3),
    contradiction:
      options.statusScope === "current" && statuses.has("active") &&
        (statuses.has("unknown") || statuses.has("repealed"))
        ? 1
        : 0,
    citation_support: clamp(
      top
        ? Math.max(
          top.legal_features.article_match,
          top.legal_features.part_match,
          top.legal_features.point_match,
          top.legal_features.subpoint_match,
          top.legal_features.document_number_match,
          top.legal_features.case_number_match,
          top.legal_features.date_match,
        )
        : 0,
    ),
  };
  const supportScore = clamp(
    0.35 * signals.retrieval_relevance +
      0.15 * signals.authority +
      0.20 * signals.evidence_sufficiency +
      0.20 * signals.citation_support +
      0.10 * (1 - signals.contradiction),
  );
  const reasons: string[] = [];
  if (!top) reasons.push("NO_RELEVANT_CANDIDATE");
  if (signals.status_eligibility < 1) reasons.push("STATUS_INELIGIBLE");
  const threshold = options.supportThreshold ?? 0.526;
  if (supportScore < threshold) {
    reasons.push("CALIBRATED_SUPPORT_BELOW_THRESHOLD");
    if (!options.rerankerOk) {
      reasons.push("RERANKER_UNAVAILABLE_LOW_DETERMINISTIC_SUPPORT");
    }
  }
  if (signals.retrieval_relevance < 0.18 && signals.citation_support < 0.2) {
    reasons.push("WEAK_RETRIEVAL_EVIDENCE");
  }
  if (signals.contradiction > 0.5 && signals.citation_support < 0.5) {
    reasons.push("CONTRADICTORY_EVIDENCE");
  }
  const exactLookup =
    /(?:հոդված(?:ի|ը)?|стать(?:я|и|ю)|article)\s*[0-9]+|\b[A-ZА-Я]{2,}[-/]?[A-ZА-Я0-9-]*\d[A-ZА-Я0-9-]*\b/iu
      .test(options.query ?? "");
  if (exactLookup && signals.citation_support < 0.5) {
    reasons.push("EXACT_LOOKUP_UNSUPPORTED");
  }
  if (
    options.statusScope === "current" && relevant.length > 0 &&
    relevant.every((row) => row.norm_status !== "active")
  ) {
    reasons.push("CURRENT_SCOPE_ONLY_NONCURRENT_SUPPORT");
  }
  const answerable = reasons.length === 0;
  return {
    answerable,
    text: answerable ? null : NO_ANSWER_TEXT,
    reasons,
    signals,
    calibration: "train_dev_v2_unreleased",
    support_score: supportScore,
  };
}

export async function applyLegalReranking(
  params: {
    query: string;
    rows: MetricCorpusRow[];
    statusScope: StatusScope;
    effectiveAt?: string | null;
    outputLimit: number;
  },
  testOptions: { config?: RerankerConfig; fetcher?: typeof fetch } = {},
): Promise<LegalRerankingResult> {
  const config = testOptions.config ?? loadRerankerConfig();
  const metricRoute = params.rows.some((row) => row.ann_rank != null)
    ? "identifier+metric_hy+fts" as const
    : "identifier+fts" as const;
  if (!config.enabled) {
    return {
      rows: params.rows,
      enabled: false,
      reranker_ok: false,
      degraded: false,
      retrieval_route: metricRoute,
    };
  }

  const guarded = params.rows.filter((row) =>
    validStatus(row, params.statusScope) && validDate(row, params.effectiveAt)
  );
  const deterministic = scoreLegalCandidates(params.query, guarded, {
    statusScope: params.statusScope,
    effectiveAt: params.effectiveAt,
  }).sort((a, b) =>
    b.deterministic_score - a.deterministic_score ||
    a.row.chunk_id.localeCompare(b.row.chunk_id)
  );
  const candidateLimit = Math.min(
    100,
    Math.max(50, Math.trunc(config.maxBatchSize)),
  );
  const candidates = deterministic.slice(0, candidateLimit);
  const reranker = await requestRerank(
    params.query,
    candidates.map((candidate) => candidate.row),
    {
      config,
      fetcher: testOptions.fetcher,
    },
  );
  const scores = reranker.ok
    ? new Map(
      reranker.results.map((
        score,
      ) => [score.candidate_id, score.normalized_score]),
    )
    : new Map<string, number>();
  const crossEncoderWeight = envNumber(
    "RERANKER_CROSS_ENCODER_WEIGHT",
    0.65,
    0,
    1,
  );
  const ranked = candidates.map(
    (candidate: LegalScoredRow): RankedMetricRow => {
      const cross = scores.get(candidate.row.chunk_id);
      const finalScore = reranker.ok && cross != null
        ? crossEncoderWeight * cross +
          (1 - crossEncoderWeight) * candidate.deterministic_score
        : candidate.deterministic_score;
      return {
        ...candidate.row,
        legal_feature_score: candidate.deterministic_score,
        reranker_score: cross ?? null,
        final_score: clamp(finalScore),
        legal_features: candidate.features,
      };
    },
  ).sort((a, b) =>
    b.final_score - a.final_score || a.chunk_id.localeCompare(b.chunk_id)
  );
  const outputLimit = Math.min(
    20,
    Math.max(10, Math.trunc(params.outputLimit)),
  );
  const diversified = diversify(ranked, outputLimit);
  const noAnswer = decideNoAnswer(diversified, {
    rerankerOk: reranker.ok,
    statusScope: params.statusScope,
    query: params.query,
  });
  const rows = noAnswer.answerable ? diversified : [];
  if (reranker.ok) {
    return {
      rows,
      enabled: true,
      reranker_ok: true,
      degraded: false,
      retrieval_route:
        "identifier+metric_hy+fts+deterministic_legal_score+cross_encoder",
      model: reranker.model,
      revision: reranker.revision,
      latency_ms: reranker.latency_ms,
      no_answer: noAnswer,
    };
  }
  return {
    rows,
    enabled: true,
    reranker_ok: false,
    degraded: true,
    degraded_reason: reranker.reason,
    retrieval_route: "identifier+metric_hy+fts+deterministic_legal_score",
    latency_ms: reranker.latency_ms,
    no_answer: noAnswer,
  };
}
