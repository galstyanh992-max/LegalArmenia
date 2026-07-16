// =============================================================================
// Prompt 19.7 Phase 15: Metric Search V3 Client
// Additive — does not modify metric-search.ts (V2 client).
// Calls search_legal_corpus_metric_v3 with structured metadata joins.
// =============================================================================

import { callInternalFunction } from "./edge-security.ts";
import type { StatusScope } from "./rag-types.ts";
import {
  METRIC_EMBEDDING_MODEL,
  METRIC_EMBEDDING_DIMENSION,
  vectorArg,
  requestMetricEmbedding,
} from "./metric-search.ts";

export interface MetricV3CorpusRow {
  chunk_id: string;
  document_id: string;
  version_id: string;
  doc_id: string;
  title: string | null;
  text_snippet: string;
  source_url: string | null;
  citation_anchor: string | null;
  language: string;
  source: string | null;
  content_domain: string;
  norm_status: string;
  status_scope: string;
  status_eligible: boolean;
  status_reason_code: string | null;
  legal_status_warning: string | null;
  effective_from: string | null;
  effective_to: string | null;
  score: number;
  rrf_score: number;
  vector_similarity: number | null;
  ann_rank: number | null;
  fts_score: number | null;
  fts_rank: number | null;
  identifier_match: boolean;
  identifier_match_type: string | null;
  identifier_match_score: number | null;
  provision_key: string | null;
  canonical_citation: string | null;
  metadata_confidence: string | null;
  metadata_source: string | null;
  document_version_id: string;
  authority_type: string | null;
  page_from_physical: number | null;
  page_to_physical: number | null;
  duplicate_group: string | null;
  document_rank: number;
  source_rank: number;
  route_sources: string[];
  retrieval_model: string;
  retrieval_route: string;
  match_reason: string;
}

export type MetricV3RpcClient = {
  rpc: (
    fn: "search_legal_corpus_metric_v3",
    params: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message?: string } | null }>;
};

export async function searchMetricCorpusV3(
  client: MetricV3RpcClient,
  params: {
    query: string;
    embedding: number[] | null;
    contentDomain: "knowledge_base" | "practice" | "unknown" | null;
    statusScope: StatusScope;
    effectiveAt?: string | null;
    limit: number;
    annLimit: number;
    ftsLimit: number;
    provisionQuery?: string | null;
  },
): Promise<MetricV3CorpusRow[]> {
  const { data, error } = await client.rpc("search_legal_corpus_metric_v3", {
    p_query_text: params.query,
    p_metric_embedding: vectorArg(params.embedding),
    p_content_domain: params.contentDomain,
    p_status_scope: params.statusScope,
    p_effective_at: params.effectiveAt ?? null,
    p_limit: Math.min(Math.max(Math.trunc(params.limit), 1), 50),
    p_ann_limit: Math.min(Math.max(Math.trunc(params.annLimit), 20), 200),
    p_fts_limit: Math.min(Math.max(Math.trunc(params.ftsLimit), 10), 100),
    p_provision_query: params.provisionQuery ?? null,
  });
  if (error) {
    throw new Error(error.message || "search_legal_corpus_metric_v3 failed");
  }
  return (Array.isArray(data) ? data : []) as MetricV3CorpusRow[];
}

export { METRIC_EMBEDDING_MODEL, METRIC_EMBEDDING_DIMENSION, requestMetricEmbedding };
