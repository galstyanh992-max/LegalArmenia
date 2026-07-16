# 42 — Qwen runtime removal implementation

## Removed locally from active runtime

- Qwen embedding requests and payloads.
- `p_qwen_embedding` and `p_qwen_limit` on active callers.
- Qwen semantic state/error fields and route labels.
- Dual-model runtime routing and fake reranker signals.
- Browser direct calls to the dual RPC.

The only approved compatibility reference is `legacy_qwen_used: false`. The runtime scan found eight such references and zero unapproved Qwen references across the six active Edge/shared retrieval contracts.

## Truthful telemetry

- Model: `armenian-text-embeddings-2-large`; dimension: 1024.
- Identifier, Metric ANN, FTS, and fusion signals are independent.
- `reranker_ok` is always `false`; compatibility `rerank_ok` is also false.
- `legacy_qwen_used` is always `false`.
- Metric failure reports `METRIC_EMBEDDING_UNAVAILABLE` and uses identifier+FTS degradation where supported.

## Preserved rollback evidence

- Existing `search_legal_corpus_dual`: unchanged locally and unchanged in production.
- Qwen corpus embeddings: not deleted.
- Qwen index: not deleted.
- Production Qwen index baseline: approximately 1,270 MB, `idx_scan=0`.
- Rollback SQL drops only the new Metric RPC and its new FTS index.

Production functions, secrets, rows, RPCs, and indexes were not modified.

