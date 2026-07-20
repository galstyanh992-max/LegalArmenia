# RAG Verdict

Generated (UTC): 2026-07-20T15:55:00Z

FINAL_VERDICT (RAG): BLOCKED_RAG_CITATION_GATE

## Gates

- RAG_COMPONENT_TESTS: PASS (component citation tests pass; known checkpoint 70/70)
- LIVE_CHAIN_CITATION: NOT_EXECUTED (BLOCKED — no live embedding endpoint / retrieval RPC access)
- CITATION_INJECTION_GATE: INCOMPLETE (component PASS, live NOT_EXECUTED)
- METRIC_COVERAGE: NOT_EXECUTED (CURRENT_TRUE_METRIC_MISSING_COUNT = UNKNOWN; prior 162209 not reused)
- RETRIEVAL_EVALUATION: NOT_EXECUTED (BLOCKED)
- UNSUPPORTED_CLAIM_GATE: NOT_EXECUTED
- NO_ANSWER_GATE: NOT_EXECUTED
- SEARCH_CUTOVER: OFF (not approved)

See rag_closure/ for full detail. Cutover stays OFF until the live endpoint and retrieval caller are unblocked and the live gates pass.
