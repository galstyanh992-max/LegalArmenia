# LEGALARMENIA - Active Search Architecture (Phase 1)

Base: origin/main = ad20a27bc32ba40c364fbe39d969285d4d17171b (no drift vs known baseline).
Branch: codex/rag-citation-retrieval-closure. Mode: READ_ONLY production catalog.
Date: 2026-07-20. Method: static analysis of repo code + migrations + generated types + local deno contract tests.

## 1. Live search chain (production-equivalent)

Two independent front-end/Edge entry points reach the corpus; both are present in code and tests:

A. Browser knowledge-base browse path:
   useKnowledgeBase.ts -> supabase.functions.invoke(kb-unified-search) -> RPC search_legal_corpus_dual
   (keyword-only; p_metric_embedding=NULL, p_qwen_embedding=NULL) -> RRF over BM25/FTS lanes ->
   client-side buildKbPayload/buildPracticePayload.
   retrieval_mode returned: keyword_only; semantic_ok=false; qwen_semantic_ok=false.
   This path does NOT use Metric embeddings.

B. legal-chat answer-generator path:
   legal-chat/index.ts -> _shared/rag-search.ts searchKB/searchPractice -> callVectorSearch ->
   Edge function vector-search -> embed-query (Metric query embedding) ->
   RPC search_legal_corpus_dual (p_metric_embedding set when embed-query succeeds, else 0) ->
   RRF over metric_hy + bm25_fts lanes -> applyTemporalValidation + rankLegalSources ->
   prompt context builder -> answer generator with citation-verifier.
   Qwen query embedding hard-disabled (qwenEmbedding=null; QWEN_OPTIONAL_FALLBACK_DISABLED).

## 2. RPC inventory (public schema)

| RPC | Lang | Security | search_path | stmt_timeout | plan_cache | ACL execute | Active callers | Status |
|-----|------|----------|-------------|--------------|------------|-------------|----------------|--------|
| search_legal_corpus | sql STABLE | DEFINER | public,extensions,pg_temp | 60s | default | public,anon,authenticated,service_role | none (legacy) | DEAD (retained for rollback) |
| search_legal_corpus_dual | plpgsql STABLE | DEFINER | public,extensions,pg_temp | 60s | default | public,anon,authenticated,service_role | kb-unified-search, vector-search | ACTIVE (dual-primary fallback + KB browse) |
| search_legal_corpus_metric | plpgsql STABLE | INVOKER | public,extensions,pg_temp | 60s | force_custom_plan | service_role only | kb-search, kb-search-assistant | ACTIVE (Metric primary path) |
| search_legal_corpus_metric_v2 | plpgsql STABLE | INVOKER | public | 15s | per-migration | service_role only | none found | PRESENT, not wired to a caller |
| search_legal_corpus_metric_v3 | plpgsql STABLE | INVOKER | public,extensions,pg_temp | 15s | force_custom_plan | service_role only | metric-search-v3.ts + v3-shadow.ts (shadow) | PRESENT, shadow-only; V3 primary/shadow flags OFF |
| search_legal_unit_chunks_preview | sql STABLE | DEFINER | public (only) | default | default | public,anon,authenticated,service_role | legal-unit preview tooling | PRESENT (auxiliary, lexical) |
| match_search_chunks | legacy | - | - | - | - | - | none | DEAD (legacy) |

Notes:
- search_legal_corpus_dual is the only active RPC executable by anon/authenticated; it is SECURITY DEFINER.
  kb-unified-search forwards a user JWT, so this is the public-facing surface.
- All Metric RPCs (v1/v2/v3) are SECURITY INVOKER and service_role-only (no anon/authenticated execute).
  They run with the Edge service_role key.
- V3 RPC is additive; it does not modify v1/v2/dual (migration header + metric-search-v3.ts comment).
- Generated types expose only: search_legal_corpus, search_legal_corpus_dual, search_legal_corpus_metric,
  search_legal_unit_chunks_preview. v2/v3 are NOT in generated types (no generated-type-only caller risk).

## 3. Feature flags / shadow path / fallbacks

- LEGAL_SEARCH_PRIMARY (env) selects metric vs dual primary. _secrets file sets it (value not printed).
- V3 primary flag = OFF, V3 shadow flag = OFF (baseline + _secrets; v3-shadow test asserts defaults OFF
  and refuses to promote V3 to primary).
- V3 shadow path (_shared/v3-shadow.ts) gated by flags + traffic percent; cannot promote V3 to primary
  even if misconfigured (test-verified).
- Timeout fallback: dual stmt_timeout 60s; vector-search passes x-statement-timeout 8000ms;
  embed-query 20s abort. On embedding failure, vector-search sets p_metric_limit=0 and falls back to
  BM25/FTS (retrieval_mode keyword_only / rpc_fallback).
- FTS fallback: websearch_to_tsquery(simple, ...) over search_chunks.fts_vector; always-on BM25 lane.

## 4. Embedding model / endpoint

- Query embedding: embed-query Edge function -> EMBEDDING_ENDPOINT (self-hosted FastAPI,
  scripts/embedding_server.py). Reachability checked (rejects localhost/private IP).
- Model: armenian-text-embeddings-2-large, dimension 1024, query prefix query: (per embed-query comment).
- Index model in embeddings table: armenian-text-embeddings-2-large (dim 1024).
  Legacy qwen3-embedding-0.6b rows also present (Qwen runtime removed from query path; rows retained).
- Legacy OpenAI text-embedding-3-small (1536-dim) report (EMBEDDINGS_QUALITY_REPORT.md, 2026-04-06)
  refers to OLD knowledge_base/legal_practice_kb tables, NOT the current documents/search_chunks/embeddings
  corpus. Do not treat as current.

## 5. Active caller summary (verified by grep)

- kb-search/index.ts and kb-search-assistant/index.ts -> search_legal_corpus_metric (V1 primary).
- kb-unified-search/index.ts -> search_legal_corpus_dual (keyword-only).
- vector-search/index.ts -> search_legal_corpus_dual (metric+fts when embedding available).
- _shared/metric-search-v3.ts and v3-shadow.ts -> search_legal_corpus_metric_v3 (shadow only).
- _shared/rag-search.ts lookupByAnchors -> lookup_by_citation RPC (citation anchor lane).

## 6. Evidence (executable, local, no DB)

Deno contract tests in supabase/functions/_tests/ run locally without DB credentials:
- metric-only-retrieval.contract.test.ts: 5 pass - active callers use correct RPC, service-only ACL,
  generated-type boundary.
- v3-shadow.test.ts: 9 pass - flags OFF by default, cannot promote V3 to primary, telemetry sanitized.
- metric-rpc-v3.contract.test.ts: 5 pass - V3 client contract, provisionQuery handling.
- metric-rpc-v2.contract.test.ts: pass (in suite).
See 04/05/06/07/08/09 for citation/reranker/retrieval evidence and the test-run transcript.

## 7. Gaps / honest limits

- Live behavioral verification of dual-vs-metric primary selection, reranker output against the real
  corpus, and latency under load were NOT executed (no DB/endpoint credentials in this environment).
- The dual RPC remains SECURITY DEFINER + public/anon/authenticated execute. Acceptable because it only
  emits retrieved chunks (no writes), but it is the only public-facing search RPC and requires the
  citation-injection gate to be PASS before cutover.

ACTIVE_SEARCH_RPC = search_legal_corpus_dual (public path) + search_legal_corpus_metric (Metric primary).
