-- Rollback for 20260716000200_metric_rpc_v3
-- Safe: drops only the V3 function. V1, dual RPC, and V2 remain intact.
drop function if exists public.search_legal_corpus_metric_v3(
  text, vector, public.content_domain, text, date, integer, integer, integer, text
);
