import type { MetricCorpusRow } from "./metric-search.ts";
import type { StatusScope } from "./rag-types.ts";
import {
  type LegalFeatureVector,
  scoreLegalCandidates,
} from "./legal-feature-scorer.ts";
import type { RerankerConfig } from "./reranker-client.ts";
import {
  decideNoAnswerV2,
  rankDeterministicV2,
} from "./deterministic-search-v2.ts";

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
  reranker_mode: "deterministic";
  reranker_ok: boolean;
  degraded: boolean;
  degraded_reason?: string;
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
  _testOptions: { config?: RerankerConfig; fetcher?: typeof fetch } = {},
): Promise<LegalRerankingResult> {
  const guarded = params.rows.filter((row) =>
    validStatus(row, params.statusScope) && validDate(row, params.effectiveAt)
  );
  const featureMap = new Map(
    scoreLegalCandidates(params.query, guarded, {
      statusScope: params.statusScope,
      effectiveAt: params.effectiveAt,
    }).map((item) => [item.row.chunk_id, item] as const),
  );
  const outputLimit = Math.min(
    20,
    Math.max(10, Math.trunc(params.outputLimit)),
  );
  const v2 = rankDeterministicV2(params.query, guarded, {
    statusScope: params.statusScope,
    effectiveAt: params.effectiveAt,
    limit: outputLimit,
  });
  const ranked = v2.map((item): RankedMetricRow => {
    const base = featureMap.get(item.row.chunk_id)!;
    return {
      ...item.row,
      legal_feature_score: base.deterministic_score,
      reranker_score: null,
      final_score: item.final_score,
      legal_features: base.features,
    };
  });
  const v2Decision = decideNoAnswerV2(params.query, v2, params.statusScope);
  const legacySignals = decideNoAnswer(ranked, {
    rerankerOk: false,
    statusScope: params.statusScope,
    query: params.query,
    supportThreshold: 0,
  }).signals;
  const noAnswer: NoAnswerDecision = {
    answerable: v2Decision.answerable,
    text: v2Decision.answerable ? null : NO_ANSWER_TEXT,
    reasons: v2Decision.reasons,
    signals: legacySignals,
    calibration: "train_dev_v2_unreleased",
    support_score: v2Decision.support_score,
  };
  return {
    rows: noAnswer.answerable ? ranked : [],
    enabled: true,
    reranker_mode: "deterministic",
    reranker_ok: false,
    degraded: false,
    retrieval_route: "identifier+metric_hy+fts+deterministic_legal_score",
    no_answer: noAnswer,
  };
}
