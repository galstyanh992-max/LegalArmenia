-- Additive rollback. Legacy dual/Qwen schema and data remain untouched.
drop function if exists public.search_legal_corpus_metric(
  text, vector, public.content_domain, text, date, integer, integer, integer
);

drop index if exists public.documents_metric_search_fts_idx;
