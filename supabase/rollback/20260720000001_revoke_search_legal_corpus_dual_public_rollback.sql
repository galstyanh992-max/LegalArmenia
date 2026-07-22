-- ROLLBACK for 20260720000001_revoke_search_legal_corpus_dual_public.sql
-- Restores the EXACT baseline ACL captured at GATE 0 (2026-07-21).
-- ACL_BEFORE: PUBLIC=EXECUTE, anon=EXECUTE, authenticated=EXECUTE, service_role=EXECUTE
-- (postgres owner retains implicit EXECUTE regardless.)
-- Run ONLY if GATE 4 verification fails or any rollback trigger fires.

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
) to public;

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
) to anon;

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
) to authenticated;

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
