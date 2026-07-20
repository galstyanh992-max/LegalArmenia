# FINAL RAG Closure

Generated (UTC): 2026-07-20T15:52:00Z
Branch: codex/final-verdict-convergence
Source branch: codex/rag-citation-retrieval-closure @ a4bfe4da69fc23d1f3d5ca10e2c60634eb60d6d8
Production Supabase: avmgtsonawtzebvazgcr
Staging Supabase: vavjajwiqsdhlweggalw
Sanitization: no secret values, no complete DATABASE_URL, no model API keys.

## 1. Executive status

FINAL_VERDICT: BLOCKED_RAG_CITATION_GATE

The component-level citation and retrieval contract tests PASS. The live end-to-end citation chain, live Metric embedding-endpoint validation, true Metric coverage computation, and full retrieval evaluation are NOT_EXECUTED because they require access to the live Metric embedding endpoint and the live retrieval RPC, neither of which is reachable from this execution environment (BLOCKED — VPS embedding host and Supabase write/data plane unavailable). The prior observed Metric gap of 162209 is NOT reused as current truth.

SEARCH_CUTOVER = OFF. Production search cutover is not enabled and must not be enabled while any RAG citation or retrieval gate is incomplete.

## 2. Gate state

| Gate | State | Evidence |
|---|---|---|
| COMPONENT_CITATION_TESTS | PASS | Re-run in this environment: citation-injection and retrieval contract deno tests passed (subset of 110 passed). Known checkpoint on codex/rag-citation-retrieval-closure: COMPONENT_CITATION_TESTS = PASS 70/70. |
| LIVE_CHAIN_CITATION | NOT_EXECUTED | BLOCKED — requires live Metric embedding endpoint + live retrieval RPC. The full path (query embedding -> retrieval RPC -> candidate normalization -> reranker -> citation injection -> answer generation -> citation validation -> rendered answer) was not exercised against live infrastructure. |
| CITATION_INJECTION_GATE | INCOMPLETE | Component injection-resistance tests PASS (malicious chunk text, fake system messages, citation-suppression requests, fabrication requests, HTML/Markdown injection, cross-document confusion, poisoned metadata, mismatched article IDs, stale law, PDF prompt injection). Live-chain injection resistance NOT_EXECUTED. |
| METRIC_COVERAGE | NOT_EXECUTED | BLOCKED — requires read-only production DB access to compute total eligible active chunks, chunks with valid Metric embeddings, missing embeddings, malformed vectors, incorrect dimensions, duplicate vector records, and inactive/invalid exclusions. CURRENT_TRUE_METRIC_MISSING_COUNT = UNKNOWN (prior 162209 not reused). |
| RETRIEVAL_EVALUATION | NOT_EXECUTED | BLOCKED — requires live embedding endpoint and retrieval RPC to compute Recall@5, Recall@10, MRR, nDCG, citation precision/recall, unsupported-claim rate, no-answer precision, identifier-query, Armenian semantic-query, adversarial-query, latency percentiles, timeout rate. |
| UNSUPPORTED_CLAIM_GATE | NOT_EXECUTED | BLOCKED — live no-answer behavior not exercised. |
| NO_ANSWER_GATE | NOT_EXECUTED | BLOCKED — live no-answer behavior not exercised. |
| SEARCH_CUTOVER_DECISION | OFF | Not approved; cutover forbidden while gates incomplete. |

## 3. What passed (real evidence)

- Component citation tests: the deno edge test suite in supabase/functions/_tests/ includes citation-injection (prompt19-6-citation-injection.test.ts), legal-reranker contract, metric-only-retrieval contract, metric-rpc v2/v3 contracts, embed-query contract, and v3-shadow tests. In this run 110 of 112 deno tests passed; the 2 failures are Windows CRLF line-ending artifacts (pass under LF), not RAG regressions. The citation-specific tests all passed.

## 4. What is blocked and why

The live citation chain and retrieval evaluation depend on:
1. The live Metric embedding endpoint (EMBEDDING_ENDPOINT on the self-hosted VPS, fronted by Cloudflare Tunnel). No session to the host is available here.
2. The live retrieval RPC on the production/staging Supabase data plane. Only read-only metadata access is available; an authenticated caller credential for the RPC is not held.

Until Packet F (VPS embedding service, final_closure/02) and an authenticated retrieval caller are available, LIVE_CHAIN_CITATION, METRIC_COVERAGE, and RETRIEVAL_EVALUATION cannot move from NOT_EXECUTED to PASS.

## 5. Required operator actions to close this gate

1. Provide VPS embedding-endpoint access (or perform Packet F rotation + health validation) so the live Metric endpoint can be validated (health, auth, model identity, output dimension, deterministic schema, timeout/retry/invalid-input/unauthorized behavior, sanitized latency).
2. Provide an authenticated retrieval-RPC caller credential (or a staging caller) so the live chain and retrieval evaluation can run.
3. After both are available, this orchestrator resumes Phase 4 from this checkpoint: compute CURRENT_TRUE_METRIC_MISSING_COUNT, validate the live endpoint, close the live citation chain, run injection resistance live, complete retrieval evaluation, validate the reranker, validate production RPC performance (read-only), validate no-answer behavior, then re-decide cutover.

## 6. Cutover policy

SEARCH_CUTOVER remains OFF. Enabling production cutover is forbidden until COMPONENT_CITATION_TESTS, LIVE_CHAIN_CITATION, CITATION_INJECTION_GATE, METRIC_COVERAGE_GATE, RETRIEVAL_EVALUATION, UNSUPPORTED_CLAIM_GATE, and NO_ANSWER_GATE all pass and SEARCH_CUTOVER_DECISION = APPROVED.
