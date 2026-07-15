# 93 — Metric RPC Shadow Smoke

## Passed controls

- RPC exists and is visible through PostgREST.
- Service-only grants are enforced.
- Malformed scope is rejected deterministically.
- Malformed vector is rejected deterministically.
- Anonymous direct RPC execution is denied.
- Calls were read-only; corpus writes: `0`.
- Production frontend and `legal-chat` were not switched.

## Runtime blocker

The server-side read-only smoke call against the production corpus was cancelled by PostgreSQL SQLSTATE `57014` after the function's `60s` statement timeout. The timeout occurred inside `search_legal_corpus_metric` while executing its combined Metric ANN, identifier, metadata FTS, chunk FTS, fusion, and enrichment CTE plan.

Consequently these required live assertions are not proven:

- current scope returns active only;
- extended scope retrieves unknown with warning and excludes repealed;
- historical scope retrieves repealed with warning;
- Armenian semantic, Russian-to-Armenian, exact identifier, unknown-only, historical, and no-answer result quality;
- live ANN latency and successful Metric/FTS fusion.

Status contamination cannot be measured because no result set completed. It is not reported as zero.

Result: `LIVE_SHADOW_BLOCKED_BY_RPC_STATEMENT_TIMEOUT`.
