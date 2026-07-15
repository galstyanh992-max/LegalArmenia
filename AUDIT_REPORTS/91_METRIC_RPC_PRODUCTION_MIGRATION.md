# 91 — Metric RPC Production Migration

- Project: `avmgtsonawtzebvazgcr`.
- Migration: `20260714165009_metric_only_rpc_unknown_scope.sql`.
- SHA-256: `3e9942b4640ed8c11a2da1513513e1c6c1e894e19ae334e4e6b47592d3545df7`.
- Migration ledger occurrence after apply: `1`.
- Migration was statically verified before apply: additive; no corpus DML; no Qwen removal; no old dual RPC replacement.
- Created expected objects only: `documents_metric_search_fts_idx` and `search_legal_corpus_metric(...)`.
- Fixed `search_path` and `60s` statement timeout are present.
- Function definition contains no Qwen branch.
- `PUBLIC`, `anon`, `authenticated`: execute denied.
- `service_role`: execute allowed.
- Malformed scope: HTTP `400`, `METRIC_RPC_INVALID_STATUS_SCOPE`.
- Malformed vector: HTTP `400`, `METRIC_RPC_INVALID_VECTOR_DIMENSION`.
- Anonymous direct call: HTTP `401`, permission denied.

## Invariance

| Measure | Before | After | Delta |
| --- | ---: | ---: | ---: |
| documents | 218299 | 218299 | 0 |
| document_versions | 218299 | 218299 | 0 |
| search_chunks | 1489780 | 1489780 | 0 |
| embeddings | 1489780 | 1489780 | 0 |
| active chunks | 779040 | 779040 | 0 |
| unknown chunks | 669292 | 669292 | 0 |
| repealed chunks | 41448 | 41448 | 0 |
| Metric rows | 1327574 | 1327574 | 0 |
| Qwen rows | 162206 | 162206 | 0 |

- Corpus writes: `0`.
- Qwen index hash unchanged: `abe82b4a236a0ac9001736e93c36691b2aecf94ee0443d0702b70ebd47e569a8`.
- Old dual RPC hash unchanged: `dfc9dc94a936763fcce3ca5a9c61059fcb09f02b0b0f931fd8be077aa661eb78`.
- New Metric RPC hash: `d8fa5c336446181b254ceb148a19ad1af61052020a17d600ffa8045867665b73`.

Result: `MIGRATION_APPLIED_INVARIANTS_PASS`.
