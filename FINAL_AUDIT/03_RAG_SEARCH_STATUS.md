# 03 — RAG / Search Status

## Corpus integrity (production, live)
- documents 218,299 · current_versions 218,299 · chunks 1,489,780 · embeddings 1,489,780.
- success 1,489,777 · not-success 3 · null vectors 0 · chunks missing any embedding 3.
- metric model armenian-text-embeddings-2-large, dim 1024; also qwen3-embedding-0.6b.
- metric-model embeddings 1,327,574 → **162,209 chunks (~11%) lack a metric embedding**
  (metric-only coverage gap).

## Architecture (live function inventory)
search_legal_corpus, search_legal_corpus_dual, search_legal_corpus_metric,
search_legal_corpus_metric_v2, search_legal_corpus_metric_v3, search_legal_unit_chunks_preview.
V3 service-role-only; V3 primary + shadow flags OFF; no cutover authorized.

## Gates
- RETRIEVAL_EVALUATION = INCOMPLETE (needs harness + embedding endpoint credential).
- RERANKER_BEHAVIORAL_PROOF = INCOMPLETE (needs harness).
- CITATION_INJECTION_GATE = INCOMPLETE (adversarial harness not run; not assertable from code).
- LEGAL_REVIEW_GATE = BLOCKED_EXTERNAL_LEGAL_REVIEW (external; not substituted by model review).

## Cutover readiness
SEARCH_CUTOVER_BLOCKED_BY_LEGAL_REVIEW (also: citation gate INCOMPLETE; metric-coverage gap;
evaluation unexecuted). Do NOT enable production search cutover. Do NOT re-embed without
explicit authorization.
