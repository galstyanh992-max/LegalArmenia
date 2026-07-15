# 97 — Metric RPC V2 Implementation

## Additive objects

- `search_legal_corpus_metric_v2(text, vector, content_domain, text, date, integer, integer, integer)`.
- Migration `20260715023423_metric_rpc_v2_performance.sql`.
- SHA-256 `93e1a10f6d7a2bfdcf72513282aeab492d8b5f4679b6d2a2d0b08d76f1263b2d`.
- Corrective migration `20260715024359_metric_rpc_v2_runtime_qualification_fix.sql`.
- SHA-256 `43c2b73a947ee3dae74e1d7777fcf9c161e1defa9c8b4d607a625636d916cfc7`.

The corrective migration qualifies two V2-only CTE columns that collided with PL/pgSQL output variables. Both versions occur once in the production ledger. Clean replay applies all 11 migrations successfully.

## Design

- Metric candidates are selected from IVFFlat before chunk/version/status joins.
- ANN input is bounded to at most 2,000 and normally `5 × p_ann_limit`.
- Identifier matching uses separate index-compatible canonical, ARLIS, document-number, citation, and article branches.
- Full-corpus `lower(btrim(search_chunks.text))` equality was removed.
- Chunk/document FTS candidates are bounded before rank calculation.
- Fusion input is bounded by lane limits.
- Current/extended/historical eligibility and warnings are preserved.
- Metric model remains `armenian-text-embeddings-2-large`; no Qwen branch exists.
- Security invoker, fixed search path, custom plan, 15-second safety timeout.
- Execute: service-role only; anon/authenticated denied.

Old V1 and old dual RPC definitions were not replaced. PostgREST discovery and grants passed.
