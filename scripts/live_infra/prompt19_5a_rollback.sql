-- Prompt 19.5A rollback: remove only the additive Metric RPC and its supporting index.
-- Execute only after disabling any shadow caller and confirming old dual RPC health.
begin;

drop function if exists public.search_legal_corpus_metric(
  text,
  vector,
  public.content_domain,
  text,
  date,
  integer,
  integer,
  integer
);

drop index if exists public.documents_metric_search_fts_idx;

notify pgrst, 'reload schema';

commit;
