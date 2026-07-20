-- =============================================================================
-- RAG hardening: remove anonymous / public / authenticated EXECUTE on the
-- retrieval RPC so it can only be invoked server-side (Edge Functions use the
-- service_role key). Previously the function was GRANTed to public/anon/
-- authenticated (see baseline 20260712120002_versioned_baseline_20260712.sql),
-- which let any holder of the anon key call search_legal_corpus_dual directly
-- with a crafted embedding vector, bypassing embed-query, prompt-armor and
-- rate limiting. This is a read-only authorization tightening (no data change,
-- no function body change).
-- =============================================================================

-- Revoke all existing grants on the retrieval function.
revoke execute on function public.search_legal_corpus_dual(
  p_query_text text,
  p_metric_embedding vector,
  p_qwen_embedding vector,
  p_content_domain content_domain,
  p_norm_status normalized_status,
  p_limit integer,
  p_metric_limit integer,
  p_qwen_limit integer,
  p_bm25_limit integer,
  p_effective_at date
) from public, anon, authenticated, service_role;

-- Re-grant ONLY to service_role: edge functions call this RPC server-side with
-- the service_role key. Frontend retrieval must go through the vector-search
-- edge function, never call the RPC directly.
grant execute on function public.search_legal_corpus_dual(
  p_query_text text,
  p_metric_embedding vector,
  p_qwen_embedding vector,
  p_content_domain content_domain,
  p_norm_status normalized_status,
  p_limit integer,
  p_metric_limit integer,
  p_qwen_limit integer,
  p_bm25_limit integer,
  p_effective_at date
) to service_role;