# 40 — Metric-only RPC implementation

## Scope

- Branch: `codex/prompt-19-1-metric-rpc`
- Base: `origin/main@9ed47926b0e08ad2bc9e57155c9b1dc69eab617f`
- Additive migration: `supabase/migrations/20260714165009_metric_only_rpc_unknown_scope.sql`
- Rollback: `supabase/rollback/20260714165009_metric_only_rpc_unknown_scope_rollback.sql`
- Production writes/deployments: none

## RPC

```sql
search_legal_corpus_metric(
  p_query_text text,
  p_metric_embedding vector(1024),
  p_content_domain content_domain default null,
  p_status_scope text default 'current',
  p_effective_at date default null,
  p_limit integer default 15,
  p_ann_limit integer default 100,
  p_fts_limit integer default 50
)
```

The migration adds a static PL/pgSQL Metric-only search function and a metadata FTS GIN index. It does not change or drop `search_legal_corpus_dual`, Qwen rows, or Qwen indexes.

## Retrieval contract

- Identifier lane: exact title, canonical key, document/case/legal number, citation, date, article/unit/part/point/paragraph and exact phrase signals.
- ANN lane: only `armenian-text-embeddings-2-large`, 1024 dimensions, cosine distance.
- FTS lane: Armenian chunk text plus document metadata and legal identifiers.
- Shared eligibility: status scope, current version, Armenian language, domain, and effective date are applied in every lane.
- Fusion: weighted RRF (`identifier=3.0`, `metric=1.5`, `fts=1.0`), exact/near duplicate collapse, three chunks per document, and source round-robin.
- Raw evidence remains independent: vector similarity/rank, FTS score/rank, identifier match, RRF score, duplicate group, document rank, and route sources.
- RRF is not exposed as confidence. No reranker was added.

## Validation and privileges

- Scope: `current|extended|historical`.
- Limits: final `1..50`, ANN `20..200`, FTS `10..100`.
- Query: required and bounded.
- Vector: required, exactly 1024, finite, non-zero.
- Fixed `search_path`, 60-second statement timeout, no dynamic SQL.
- `PUBLIC`, `anon`, and `authenticated`: EXECUTE revoked.
- `service_role`: EXECUTE granted.

## Callers migrated locally

- Edge: `vector-search`, `kb-search`, `kb-search-assistant`, `kb-unified-search`.
- Shared: `_shared/rag-search.ts`, `_shared/rag-types.ts`, and the typed reasoning→retrieval handoff in `_shared/legal-pipeline-orchestrator.ts`.
- Shared-module deploy consumers checked: `ai-analyze`, `legal-chat`, `generate-document`, `generate-complaint`; `ai-analyze` now takes the authoritative reasoning result from the pipeline.
- Frontend: `useKnowledgeBase`, `useLegalPracticeKB`, `KBSearchPanel`.
- Types/tests: generated Supabase types and retrieval/telemetry/temporal contract tests.

Defaults are `current` for legal-answer RAG, `extended` for research/search UI, and `historical` only when explicitly requested.
