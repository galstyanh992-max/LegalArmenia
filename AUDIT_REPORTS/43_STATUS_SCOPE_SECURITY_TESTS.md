# 43 — Status-scope and security tests

## SQL regression coverage

- Scope eligibility and exact warning/reason contracts.
- Invalid scope, empty/oversized query, invalid final/ANN/FTS limits.
- Null, wrong-dimension, non-finite, and zero vector rejection.
- Domain, effective-date, current-version, and Armenian-language filters.
- Identifier, ANN, and FTS lane behavior.
- Exact/near deduplication and document cap.

## Authorization

| Role | Direct EXECUTE |
|---|---|
| PUBLIC | denied |
| anon | denied |
| authenticated | denied |
| service_role | allowed |

The function uses fixed SQL, fixed `search_path`, and no dynamic SQL. Frontend code calls Edge functions and contains no service-role credential.

## Engineering evidence

- Clean local migration replay: pass.
- SQL/RPC suite: pass.
- Transactional rollback test: pass; function and added index removed inside the test transaction.
- Database lint: no new warning/error; only pre-existing dual-RPC warnings.
- Typecheck, lint, 125 unit tests, 38 Edge contract tests, affected Edge-bundle Deno checks, reasoning/pipeline Deno tests, and build: pass.
- Generated local types contain the checked-in Metric RPC signature.
- Static verifier: pass.
- Secret scan: zero hits.
- `.env*` files in diff: none.
- Unexpected local migrations: none.
- Known remote-only baseline migration: `20260714110215_repair_metric_retrieval_quality`; must be reconciled in the production rollout without rewriting applied history.

## Final production read-only check

- Dual RPC MD5 remained `323e1b98f3cc03c44f58da594a732717`; grants and corpus counts remained unchanged.
- New Metric RPC is absent from production, as required by the stop gate.
- Qwen index remained present at 1,332,076,544 bytes with `idx_scan=0`.
- During the local implementation window, deployed retrieval function versions advanced externally from `vector-search=38`, `kb-search=37`, `kb-search-assistant=38`, `kb-unified-search=37` to `39/38/39/38`. This branch performed no deployment; rollout must rebase/reconcile against those live revisions before approval.
