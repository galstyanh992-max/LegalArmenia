-- Execute only if the additive V2 shadow function must be removed.
-- The user route already remains on the legacy dual RPC.
begin;

drop function if exists public.search_legal_corpus_metric_v2(
  text, vector, public.content_domain, text, date, integer, integer, integer
);

notify pgrst, 'reload schema';
commit;

-- Then mark both V2-only versions reverted in the migration ledger:
-- supabase migration repair --linked --status reverted 20260715024359
-- supabase migration repair --linked --status reverted 20260715023423
