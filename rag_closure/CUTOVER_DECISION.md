# RAG Search Cutover Decision

Generated (UTC): 2026-07-20T15:52:00Z

SEARCH_CUTOVER = OFF
SEARCH_CUTOVER_DECISION = NOT_APPROVED

## Policy

Production search cutover must NOT be enabled while any RAG citation or retrieval gate is incomplete (per non-negotiable safety rule 6).

## Required pass state before cutover

- COMPONENT_CITATION_TESTS = PASS (currently PASS)
- LIVE_CHAIN_CITATION = PASS (currently NOT_EXECUTED)
- CITATION_INJECTION_GATE = PASS (currently INCOMPLETE)
- METRIC_COVERAGE_GATE = PASS or explicitly accepted threshold (currently NOT_EXECUTED)
- RETRIEVAL_EVALUATION = PASS (currently NOT_EXECUTED)
- UNSUPPORTED_CLAIM_GATE = PASS (currently NOT_EXECUTED)
- NO_ANSWER_GATE = PASS (currently NOT_EXECUTED)
- SEARCH_CUTOVER_DECISION = APPROVED (currently NOT_APPROVED)

## Current verdict

FINAL_VERDICT = BLOCKED_RAG_CITATION_GATE. Cutover stays OFF until the operator unblocks the live endpoint and retrieval caller (see rag_closure/FINAL_RAG_CLOSURE.md section 5) and the live gates pass.
