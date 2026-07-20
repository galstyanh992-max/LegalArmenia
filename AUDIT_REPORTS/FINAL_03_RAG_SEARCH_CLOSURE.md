# FINAL_03 — RAG / Search Final Closure

Base: origin/main = ad20a27. Mode: read-only (production catalog). Date: 2026-07-20.

## 3.1 Architecture (live, catalog-verified — names not assumed from old reports)
Search functions actually present in production `public`:
- search_legal_corpus (hybrid, SECURITY DEFINER, open public read)
- search_legal_corpus_dual (metric+qwen dual; 2 edge callers: kb-unified-search, vector-search)
- search_legal_corpus_metric (metric path — primary edge caller in kb-search / kb-search-assistant)
- search_legal_corpus_metric_v2
- search_legal_corpus_metric_v3 (V3)
- search_legal_unit_chunks_preview
Active runtime edge callers (repo): kb-search / kb-search-assistant → `search_legal_corpus_metric`;
`_shared/metric-search-v3.ts` and `_shared/v3-shadow.ts` → `search_legal_corpus_metric_v3`
(shadow path); kb-unified-search / vector-search → `search_legal_corpus_dual`.
V3 remains service-role-only; V3 primary/shadow flags remain OFF per baseline (no cutover).

## 3.2 Corpus integrity (production, live)
- documents = 218,299; current document_versions = 218,299.
- search_chunks = 1,489,780; embeddings = 1,489,780 (1:1).
- embeddings success = 1,489,777; not-success = 3; null vector = 0.
- chunks missing ANY successful embedding = 3 (0.0002%).
- Models present: `armenian-text-embeddings-2-large` (metric, dim = **1024** ✓) and
  `qwen3-embedding-0.6b`.
- Metric-model success embeddings = 1,327,574.
- **Chunks missing a metric-model embedding = 162,209 (~10.9%)** → metric-only vector search
  cannot reach ~11% of the corpus. This is a coverage gap for the metric-only cutover path.
  (Not a security defect. Do NOT trigger a full re-embed without explicit authorization.)

## 3.3 Retrieval evaluation
NOT executed in this session. A defensible evaluation (Recall@5/10, MRR, nDCG, citation accuracy,
faithfulness, no-answer precision, latency p50/p95, timeout rate) requires running the live
pipeline (Metric embedding endpoint + RPCs + reranker) against the engineering and golden
datasets and the multilingual/adversarial query sets. This needs the embedding endpoint key and
controlled execution. Prior engineering-eval numbers exist in historical reports but, per the
non-negotiable rule, stale reports are not treated as current PASS.
Status: **RETRIEVAL_EVALUATION = INCOMPLETE (requires execution harness + endpoint credential).**
Engineering evaluation and legal-expert evaluation are kept strictly separate; no engineering-only
result is promoted to a legal-quality PASS.

## 3.4 Reranker verification
Structural review only (deterministic scorer v3/v4, identifier/article/title priority,
duplicate suppression, effective-date filtering, low-confidence rejection, timeout fallback exist
in `_shared`). A live behavioral proof that reranking cannot surface inactive law versions, mix
unrelated articles, overwrite citation metadata, or promote injected text was NOT executed here.
Status: **INCOMPLETE (requires execution harness).**

## 3.5 Citation-injection gate
An adversarial corpus/query harness (ignore-previous-instructions, swap-law, spoof-authority,
reveal-prompt, replace-article-number, omit-source-url, unsupported-conclusion) was NOT run in
this session. Per the non-negotiable rule, this gate cannot be asserted PASS from code inspection
or from prior reports.
**CITATION_INJECTION_GATE = INCOMPLETE.**
Search cutover remains blocked while this gate is not PASS.

## 3.6 Legal-review gate
Legal-expert evaluation of retrieval/citations is external and not available in this session.
**LEGAL_REVIEW_GATE = BLOCKED_EXTERNAL_LEGAL_REVIEW.** Model review is NOT substituted for it.

## 3.7 Cutover readiness
- Baseline: V3 primary + shadow OFF; no cutover authorized.
- Blockers: legal review (external), citation-injection gate (incomplete), metric-coverage gap
  (162,209 chunks without a metric embedding), and unexecuted retrieval evaluation.
**SEARCH_CUTOVER = DISABLED** (V3 primary + shadow OFF; not authorized). Independent blockers:
LEGAL_REVIEW_GATE = BLOCKED_EXTERNAL_LEGAL_REVIEW, CITATION_INJECTION_GATE = INCOMPLETE,
RETRIEVAL_EVALUATION = INCOMPLETE, METRIC_ONLY_COVERAGE_GAP = 162209. Do not enable production cutover.

## Phase 3 verdict
Real read-only evidence establishes architecture + corpus integrity (healthy, 1024-dim,
near-complete embeddings) and one concrete metric-coverage gap. Evaluation, reranker behavioral
proof, and citation-injection gate are INCOMPLETE (need harness/credential); legal review is
externally BLOCKED. **PHASE VERDICT: BLOCKED_EXTERNAL_LEGAL_REVIEW** (also gated by
CITATION_INJECTION_GATE = INCOMPLETE). Loop count: 1.
Evidence directory: final_search_audit/ (this report + the live query outputs summarized here).
