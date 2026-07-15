# 92 — PostgREST Schema Verification

- PostgreSQL function exists: `PASS`.
- Expected signature is present: `PASS`.
- PostgREST function discovery: `PASS`.
- Fast validation through `/rest/v1/rpc/search_legal_corpus_metric` returned SQLSTATE `22023` / `METRIC_RPC_QUERY_REQUIRED`.
- `PGRST202` after repair: `0` observed.
- Manual schema reload was unnecessary because PostgREST discovered the function immediately after migration.

Result: `RPC_VISIBLE`.
