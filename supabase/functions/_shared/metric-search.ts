import { callInternalFunction } from "./edge-security.ts";
import type { MetricRetrievalTelemetry, StatusScope } from "./rag-types.ts";

export const METRIC_EMBEDDING_MODEL =
  "armenian-text-embeddings-2-large" as const;
export const METRIC_EMBEDDING_DIMENSION = 1024 as const;

export interface MetricCorpusRow {
  chunk_id: string;
  document_id: string;
  version_id: string;
  chunk_text: string;
  title: string | null;
  source: string | null;
  language: string;
  content_domain: "knowledge_base" | "practice" | "unknown";
  norm_status: string;
  effective_from: string | null;
  effective_to: string | null;
  status_scope: StatusScope;
  status_eligible: boolean;
  legal_status_warning: string | null;
  status_reason_code: string;
  vector_similarity: number | null;
  fts_rank: number | null;
  identifier_match: number | null;
  identifier_rank: number | null;
  ann_rank: number | null;
  fts_rank_position: number | null;
  rrf_score: number;
  duplicate_group: string;
  source_url: string | null;
  citation_anchor: string | null;
  citation_metadata: Record<string, unknown>;
}

export type MetricRpcClient = {
  rpc: (
    fn: "search_legal_corpus_metric",
    params: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message?: string } | null }>;
};

export function parseStatusScope(
  value: unknown,
  fallback: StatusScope,
): StatusScope | null {
  if (value == null || value === "") return fallback;
  return value === "current" || value === "extended" || value === "historical"
    ? value
    : null;
}

export function vectorArg(vector: number[] | null): string | null {
  if (!Array.isArray(vector) || vector.length !== METRIC_EMBEDDING_DIMENSION) {
    return null;
  }
  return `[${vector.join(",")}]`;
}

export async function requestMetricEmbedding(
  supabaseUrl: string,
  text: string,
  requestId: string,
): Promise<{ vector: number[] | null; error?: string }> {
  try {
    const response = await callInternalFunction(
      `${supabaseUrl}/functions/v1/embed-query`,
      { text },
      { requestId, timeoutMs: 25_000 },
    );
    if (!response.ok) {
      return {
        vector: null,
        error: `METRIC_EMBEDDING_HTTP_${response.status}`,
      };
    }
    const payload = await response.json() as {
      vector?: number[];
      dimension?: number;
    };
    if (
      payload.dimension !== METRIC_EMBEDDING_DIMENSION ||
      !Array.isArray(payload.vector) ||
      payload.vector.length !== METRIC_EMBEDDING_DIMENSION
    ) {
      return { vector: null, error: "METRIC_EMBEDDING_INVALID" };
    }
    if (payload.vector.some((value) => !Number.isFinite(value))) {
      return { vector: null, error: "METRIC_EMBEDDING_NON_FINITE" };
    }
    return { vector: payload.vector };
  } catch (error) {
    return {
      vector: null,
      error: `METRIC_EMBEDDING_UNAVAILABLE:${String(error)}`,
    };
  }
}

export async function searchMetricCorpus(
  client: MetricRpcClient,
  params: {
    query: string;
    embedding: number[] | null;
    contentDomain: "knowledge_base" | "practice" | "unknown" | null;
    statusScope: StatusScope;
    effectiveAt?: string | null;
    limit: number;
    annLimit: number;
    ftsLimit: number;
  },
): Promise<MetricCorpusRow[]> {
  const { data, error } = await client.rpc("search_legal_corpus_metric", {
    p_query_text: params.query,
    p_metric_embedding: vectorArg(params.embedding),
    p_content_domain: params.contentDomain,
    p_status_scope: params.statusScope,
    p_effective_at: params.effectiveAt ?? null,
    p_limit: Math.min(Math.max(Math.trunc(params.limit), 1), 50),
    p_ann_limit: Math.min(Math.max(Math.trunc(params.annLimit), 20), 200),
    p_fts_limit: Math.min(Math.max(Math.trunc(params.ftsLimit), 10), 100),
  });
  if (error) {
    throw new Error(error.message || "search_legal_corpus_metric failed");
  }
  return (Array.isArray(data) ? data : []) as MetricCorpusRow[];
}

export function buildMetricTelemetry(
  statusScope: StatusScope,
  metricAnnOk: boolean,
  fusionOk = true,
): MetricRetrievalTelemetry {
  return {
    embedding_model: METRIC_EMBEDDING_MODEL,
    embedding_dimension: METRIC_EMBEDDING_DIMENSION,
    status_scope: statusScope,
    identifier_ok: fusionOk,
    metric_ann_ok: metricAnnOk,
    fts_ok: fusionOk,
    fusion_ok: fusionOk,
    reranker_mode: "deterministic",
    reranker_ok: false,
    legacy_qwen_used: false,
    degraded: !metricAnnOk || !fusionOk,
    retrieval_route: metricAnnOk
      ? "identifier+metric_hy+fts"
      : "identifier+fts",
  };
}
