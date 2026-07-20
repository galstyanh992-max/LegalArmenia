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
component layer (all RAG-relevant suites pass). Live-run gates remain blocked on credentials / legal
review, not on defects, so additional loops cannot close them without external inputs.

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
Not re-verified live this session (no DB credentials). Prior live capture (FINAL_03, NOT re-asserted
as current PASS): Metric-model (armenian-text-embeddings-2-large, dim 1024) success embeddings =
1,327,574. CURRENT_METRIC_TOTAL = UNKNOWN.

## G. QWEN_LEGACY_TOTAL
Legacy qwen3-embedding-0.6b rows present in embeddings table (Qwen runtime removed from the query
path; rows retained). Exact count not re-verified live this session. CURRENT_QWEN_LEGACY_TOTAL =
UNKNOWN.

## H. METRIC COVERAGE TERMINOLOGY
PRIOR_OBSERVED_METRIC_GAP = 162209 (came from a prior live capture; it was NOT re-counted in this
loop; structurally it represents chunks without a successful Metric embedding row; those chunks
remain reachable through FTS; this is a potential Metric-only ANN coverage gap; the actual
REEMBED_REQUIRED subset is unknown until read-only classification queries are executed; full
re-embedding is not authorized).
CURRENT_TRUE_METRIC_MISSING_COUNT = UNKNOWN.
METRIC_COVERAGE_LIVE_REVERIFICATION = BLOCKED_DATABASE_ACCESS.
No current unverified count is labeled TRUE. See 02_METRIC_COVERAGE_RECONCILIATION.md.

## I. METRIC_COVERAGE_CLASSIFICATION
Structural meaning (prior-observed): 162209 = chunks the Metric-only ANN lane cannot reach; reachable
via the always-on BM25/FTS lane today; a potential coverage gap for the Metric-only cutover lane, NOT
missing legal content. Per-class decomposition (A REEMBED_REQUIRED / B DOCUMENT_COVERED_BY_METRIC_
SIBLING / C DUPLICATE_LEGACY_ROW / D NOT_SEARCH_ELIGIBLE / E REQUIRES_METADATA_RECONSTRUCTION /
F UNKNOWN) requires the READ_ONLY classification queries in 02. The actual REEMBED_REQUIRED subset is
UNKNOWN. Live re-count = BLOCKED_DATABASE_ACCESS. No re-embedding started or authorized.

## J. CITATION_INJECTION_GATE
CITATION_INJECTION_GATE = INCOMPLETE (overall).
- COMPONENT_CITATION_TEST_STATUS = PASS (descriptive component status only)
- COMPONENT_CITATION_TEST_TOTAL = 70
- COMPONENT_CITATION_TEST_FAILED = 0
- LIVE_CHAIN_CITATION_TEST_STATUS = NOT_EXECUTED
- LIVE_CHAIN_CITATION_GATE = INCOMPLETE
Local component tests prove the sanitizer, prompt armor, metadata boundary, and deterministic
citation contracts. They do NOT prove the deployed/live retrieval -> reranker -> context -> model
chain. Therefore the program-level citation gate is NOT PASS; it is INCOMPLETE. Search cutover
remains disabled. See 04/05.

## K. COMPONENT_CITATION_TEST_TOTAL
70 (35 citation-injection + 35 prompt-armor).

## L. COMPONENT_CITATION_TEST_FAILED
0 (of the 70 component citation/armor tests).

## M. RETRIEVAL_EVALUATION_STATUS
INCOMPLETE (BLOCKED on credentials). Live metrics not computed. See 06/07.

## N. RECALL_AT_10
NOT_MEASURED.

## O. MRR_AT_10
NOT_MEASURED.

## P. EXACT_PROVISION_HIT
NOT_MEASURED.

## Q. INACTIVE_LAW_LEAKAGE
NOT_MEASURED_LIVE. Component-level guard proven (V3 hard status guard excludes unknown from current;
deterministic-search-v4 filters ineligible status; reranker status guard applied) = 0 leakage at
the component layer. Live-chain leakage measurement requires a live run.

## R. NO_ANSWER_PRECISION
NOT_MEASURED_LIVE. Component-level no-answer logic verified (decideNoAnswerV4; calibrated no-answer).

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
DISABLED_NOT_AUTHORIZED. V3 primary flag = OFF; V3 shadow flag = OFF. No cutover.

## X. DATABASE_CHANGE_STATUS
NO_CHANGES. PRODUCTION_MODE = READ_ONLY. No UPDATE/INSERT/DELETE/ALTER/CREATE/DROP/migration apply/
Edge deploy/secret/flag change performed. Staging untouched. No production writes.

## Y. PRODUCTION_FLAG_CHANGE_STATUS
NONE. V3 primary = OFF; V3 shadow = OFF; LEGAL_SEARCH_PRIMARY unchanged. No flag changes.

## Z. FINAL_VERDICT
FINAL_VERDICT = BLOCKED_RAG_CITATION_GATE.
Co-blockers:
  - BLOCKED_DATABASE_ACCESS (live Metric coverage re-count; live retrieval run; live citation/reranker chain)
  - BLOCKED_RETRIEVAL_EVALUATION (retrieval metrics INCOMPLETE)
  - BLOCKED_EXTERNAL_LEGAL_REVIEW (legal review gate)
Not SEARCH_CUTOVER_READY. No cutover-ready claim exists. Search cutover remains OFF.
RAG_TECHNICAL_GATE_PASS_LEGAL_REVIEW_PENDING is NOT granted because the citation/retrieval/reranker
live-chain gates are not PASS (only component-level), and Metric coverage is not live-reverified.

## AA. COMPLETE_REPOSITORY_TEST_STATUS (test-failure disclosure)
- RAG/citation-specific suites PASS locally: prompt19-6-citation-injection (35/35), prompt-armor
  (35/35), legal-reranker-contract (9/9), v3-shadow (9/9), metric-rpc-v3 (5), metric-only-retrieval
  (5), deterministic-search-v4 (6). Transcript: final_search_audit/TEST_RUN_TRANSCRIPT.txt.
- Two UNRELATED migration-format tests fail LOCALLY on this Windows checkout:
  hotfix-admin-set-user-role.contract.test.ts (3 steps) and
  hotfix-default-privileges.contract.test.ts (1 step). Root cause: core.autocrlf=true on Windows
  converts LF to CRLF in the working tree; these contract tests assert LF endings / exact substring
  matches. The committed blobs are LF (verified: admin 121 LF/0 CR; priv 18 LF/0 CR). The underlying
  security content (revoke + grant execute to service_role) IS present in the migrations.
- These failures were NOT repaired in the RAG branch. Migrations were NOT changed to silence a
  Windows-local formatting artifact.
- The complete repository test suite is NOT claimed green locally. The 2 failures are environmental
  (CRLF on Windows), not RAG/search/security defects.
- GitHub Actions / Linux: the CI workflow (.github/workflows/tests.yml) runs the same
  deno test -A --no-check supabase/functions/_tests/ on ubuntu-latest. On Linux, actions/checkout
  preserves LF endings in the working tree, so the two migration-format tests PASS there. The
  RAG/citation suites are platform-independent and PASS on both.

## AB. EXACT_NEXT_ACTION
1. Provide READ_ONLY credentials for production Supabase (avmgtsonawtzebvazgcr) and a reachable
   EMBEDDING_ENDPOINT (no localhost/private IP).
2. Run the READ_ONLY Metric-coverage classification queries in 02_METRIC_COVERAGE_RECONCILIATION.md
   to convert CURRENT_TRUE_METRIC_MISSING_COUNT from UNKNOWN and isolate the true REEMBED_REQUIRED
   subset. Do NOT re-embed the full corpus; re-embed only the verified REEMBED_REQUIRED subset and
   only with explicit authorization.
3. Run scripts/run_rag_eval.ts against prompt19_2_gold_dev.jsonl (train/dev) with --allow-production
   read-only; then run the frozen test set ONCE. Split results by language/query-type/status-scope/
   domain/exact-vs-semantic/engineering-vs-legal. Record metrics in 06_RETRIEVAL_METRICS.json.
4. Run the citation-injection + reranker harness against the LIVE chain (embed-query -> dual/metric
   RPC -> reranker -> answer -> citation-verifier) to upgrade LIVE_CHAIN_CITATION_GATE and
   LIVE_CHAIN_RERANKER_GATE from INCOMPLETE to live-chain PASS.
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
