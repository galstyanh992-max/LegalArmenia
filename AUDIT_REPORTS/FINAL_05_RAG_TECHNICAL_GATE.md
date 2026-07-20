# FINAL_05 - RAG Technical Gate (LegalArmenia)

Base: origin/main = ad20a27bc32ba40c364fbe39d969285d4d17171b (no drift vs known baseline).
Branch: codex/rag-citation-retrieval-closure. Worktree: D:\1V\LegalArmenia-rag-closure.
Date: 2026-07-20. Mode: READ_ONLY production catalog. Loop count: 1.
Final audit documentation branch (NOT modified): codex/final-closure-master-loop (head 921ed3d).

## A. BASE_SHA
ad20a27bc32ba40c364fbe39d969285d4d17171b

## B. BRANCH
codex/rag-citation-retrieval-closure

## C. LOOP_COUNT
1 (OBSERVE -> FORM HYPOTHESES -> DEFINE GATES -> IMPLEMENT/EXECUTE LOCAL HARNESS -> RUN TESTS ->
ADVERSARIAL ATTACK via citation-injection suite -> ANALYZE -> DECIDE). No repair required at the
component layer (all RAG-relevant suites pass). Live-run gates remain blocked on credentials, not on
defects, so additional loops cannot close them without external inputs.

## D. ACTIVE_SEARCH_RPC
- search_legal_corpus_dual (plpgsql, SECURITY DEFINER, public/anon/authenticated/service_role;
  stmt_timeout 60s) - public KB browse path (kb-unified-search) and the legal-chat vector-search path.
- search_legal_corpus_metric (V1, plpgsql, SECURITY INVOKER, service_role only; stmt_timeout 60s;
  force_custom_plan) - Metric primary path (kb-search, kb-search-assistant).
- search_legal_corpus_metric_v3 (plpgsql, SECURITY INVOKER, service_role only; stmt_timeout 15s) -
  shadow-only (flags OFF).
Dead/legacy: search_legal_corpus (DEAD), match_search_chunks (DEAD). v2 present but not wired.

## E. ACTIVE_SEARCH_CALLERS
- kb-search/index.ts, kb-search-assistant/index.ts -> search_legal_corpus_metric
- kb-unified-search/index.ts -> search_legal_corpus_dual (keyword-only)
- vector-search/index.ts -> search_legal_corpus_dual (metric+fts when embedding available)
- _shared/metric-search-v3.ts, _shared/v3-shadow.ts -> search_legal_corpus_metric_v3 (shadow)
- _shared/rag-search.ts lookupByAnchors -> lookup_by_citation
- Browser: src/hooks/useKnowledgeBase.ts -> supabase.functions.invoke(kb-unified-search)

## F. METRIC_TOTAL
Not re-verified live this session (no DB credentials). Prior live capture (FINAL_03, not re-asserted
as PASS): Metric-model (armenian-text-embeddings-2-large, dim 1024) success embeddings = 1,327,574.

## G. QWEN_LEGACY_TOTAL
Legacy qwen3-embedding-0.6b rows present in embeddings table (Qwen runtime removed from the query
path; rows retained). Exact count not re-verified live this session.

## H. TRUE_METRIC_MISSING_COUNT
162,209 per prior live capture (FINAL_03) = chunks with no successful
armenian-text-embeddings-2-large embedding (~10.9% of 1,489,780 chunks). Live re-verification
requires READ_ONLY DB access (not available). See 02_METRIC_COVERAGE_RECONCILIATION.md.

## I. METRIC_COVERAGE_CLASSIFICATION
Meaning RECONCILED structurally: 162,209 = chunks the Metric-only ANN lane cannot reach; reachable
via the always-on BM25/FTS lane today; a coverage gap for the Metric-only cutover lane, NOT missing
legal content. Per-class decomposition (A REEMBED_REQUIRED / B DOCUMENT_COVERED_BY_METRIC_SIBLING /
C DUPLICATE_LEGACY_ROW / D NOT_SEARCH_ELIGIBLE / E REQUIRES_METADATA_RECONSTRUCTION / F UNKNOWN)
requires the READ_ONLY classification queries in 02; expected REEMBED_REQUIRED is small (bounded by
the ~3 not-success rows plus any class E/F). Live re-count = BLOCKED_DATABASE_ACCESS.
No re-embedding started or authorized.

## J. CITATION_INJECTION_GATE
PASS_COMPONENT_LEVEL (70/70 executable tests pass: prompt19-6-citation-injection 35/35 +
prompt-armor 35/35). Live-chain confirmation PENDING credentials. See 04/05.

## K. CITATION_TEST_TOTAL
70 (35 citation-injection + 35 prompt-armor). Plus reranker/V3 contract suites (see L/M) = 52
RAG-search contract tests + 37 prompt-armor/deterministic-v4 = broader 121+ passing; only 2
unrelated migration-formatting contract tests fail on CRLF (Windows checkout artifact, not RAG).

## L. CITATION_TEST_FAILED
0 (of the 70 citation-injection + prompt-armor tests).

## M. RETRIEVAL_EVALUATION_STATUS
INCOMPLETE (BLOCKED on credentials). Live metrics not computed. See 06/07.

## N. RECALL_AT_10
NOT_MEASURED (requires live run).

## O. MRR_AT_10
NOT_MEASURED.

## P. EXACT_PROVISION_HIT
NOT_MEASURED.

## Q. INACTIVE_LAW_LEAKAGE
NOT_MEASURED live. Component-level guard proven (V3 hard status guard excludes unknown from current;
deterministic-search-v4 filters ineligible status; reranker status guard applied) = 0 leakage at the
component layer. Live-chain leakage measurement requires a live run.

## R. NO_ANSWER_PRECISION
NOT_MEASURED live. Component-level no-answer logic verified (decideNoAnswerV4; calibrated no-answer).

## S. P50_LATENCY
NOT_MEASURED (requires live run). Budgets: dual 60s; vector-search 8s; embed-query 20s.

## T. P95_LATENCY
NOT_MEASURED.

## U. LEGAL_REVIEW_PACKAGE
PREPARED: 10_LEGAL_REVIEW_PACKAGE.csv (280 queries, reviewer fields blank) +
11_LEGAL_REVIEW_GUIDE.md + existing AUDIT_REPORTS/artifacts/prompt19_3_review/review_batch_a/b.jsonl
(2800 candidate pairs). Status PREPARED_PENDING_REAL_REVIEWERS.

## V. LEGAL_REVIEW_GATE
BLOCKED_EXTERNAL_LEGAL_REVIEW (reviewer_a_completed=0, reviewer_b_completed=0, adjudicated=0,
legal_approval_claimed=false). AI does not fill reviewer fields.

## W. SEARCH_CUTOVER_STATUS
DISABLED / NOT_AUTHORIZED. V3 primary flag = OFF; V3 shadow flag = OFF. No cutover.

## X. DATABASE_CHANGE_STATUS
NONE. PRODUCTION_MODE = READ_ONLY. No UPDATE/INSERT/DELETE/ALTER/CREATE/DROP/migration apply/Edge
deploy/secret/flag change performed. Staging untouched. No production writes.

## Y. PRODUCTION_FLAG_CHANGE_STATUS
NONE. V3 primary = OFF; V3 shadow = OFF; LEGAL_SEARCH_PRIMARY unchanged. No flag changes.

## Z. FINAL_VERDICT
BLOCKED_RAG_CITATION_GATE (with coupled blockers):
  - RETRIEVAL_EVALUATION = INCOMPLETE (BLOCKED on DB/endpoint credentials)
  - LEGAL_REVIEW_GATE = BLOCKED_EXTERNAL_LEGAL_REVIEW
  - METRIC coverage live re-verification = BLOCKED_DATABASE_ACCESS (figure reconciled structurally)
  - CITATION_INJECTION live-chain confirmation = PENDING credentials (component-level PASS)
  - RERANKER live behavioral proof = PENDING credentials (component-level PASS)
Not SEARCH_CUTOVER_READY. Search cutover remains OFF.
Allowed-verdict match: this is BLOCKED_RAG_CITATION_GATE (primary), with coupled
BLOCKED_EXTERNAL_LEGAL_REVIEW and BLOCKED on credentials for live retrieval/coverage/reranker.
RAG_TECHNICAL_GATE_PASS_LEGAL_REVIEW_PENDING is NOT granted because the citation/retrieval/reranker
live-chain gates are not PASS (only component-level), and Metric coverage is not live-reverified.

## AA. EXACT_NEXT_ACTION
1. Provide READ_ONLY credentials for production Supabase (avmgtsonawtzebvazgcr) and a reachable
   EMBEDDING_ENDPOINT (no localhost/private IP).
2. Run the READ_ONLY Metric-coverage classification queries in 02_METRIC_COVERAGE_RECONCILIATION.md to
   isolate the true REEMBED_REQUIRED subset. Do NOT re-embed the full corpus; re-embed only the
   verified REEMBED_REQUIRED subset and only with explicit authorization.
3. Run scripts/run_rag_eval.ts against prompt19_2_gold_dev.jsonl (train/dev) with --allow-production
   read-only; then run the frozen test set ONCE. Split results by language/query-type/status-scope/
   domain/exact-vs-semantic/engineering-vs-legal. Record metrics in 06_RETRIEVAL_METRICS.json.
4. Run the citation-injection + reranker harness against the LIVE chain (embed-query -> dual/metric
   RPC -> reranker -> answer -> citation-verifier) to upgrade CITATION_INJECTION_GATE and
   RERANKER_GATE from component-level PASS to live-chain PASS.
5. Deliver 10_LEGAL_REVIEW_PACKAGE.csv + review batches to a qualified Armenian-licensed lawyer;
   collect reviewer A/B judgments; adjudicate disagreements. Do NOT use AI to fill reviewer fields.
6. Only after citation gate = live PASS, retrieval thresholds pass, inactive-law leakage = 0 live,
   trusted citation metadata intact, legal review passes, performance passes, and no blocking Metric
   coverage defect remains: re-evaluate SEARCH_CUTOVER_READY. Until then, search cutover stays OFF.

## Evidence
final_search_audit/01..11 + TEST_RUN_TRANSCRIPT.txt. Executable: deno test -A --no-check
supabase/functions/_tests/{prompt19-6-citation-injection,legal-reranker-contract,v3-shadow,
metric-rpc-v3,metric-only-retrieval}.test.ts + _shared/{prompt-armor,deterministic-search-v4}.test.ts.
All RAG-relevant suites PASS. No production data mutated. No PR opened or merged.
