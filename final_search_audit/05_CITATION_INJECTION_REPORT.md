# LEGALARMENIA - Citation-Injection Gate Report (Phase 4)

Base: ad20a27. Date: 2026-07-20. Mode: read-only / local harness.

## 1. Invariant

RETRIEVED_TEXT = UNTRUSTED_EVIDENCE. Trusted citation fields come ONLY from validated metadata
(legal_provisions, legal_document_metadata, legal_source_page_mappings). Text inside a retrieved
chunk is never trusted as an instruction or as a citation source.

## 2. Harness

Two executable deno test suites, run locally without DB credentials:
  - supabase/functions/_tests/prompt19-6-citation-injection.test.ts (35 tests)
  - supabase/functions/_shared/prompt-armor.test.ts (35 tests)
Combined component total: 70 passed, 0 failed. Transcript: final_search_audit/TEST_RUN_TRANSCRIPT.txt.

## 3. Component vs live-chain distinction (important)

COMPONENT_CITATION_TEST_STATUS = PASS
COMPONENT_CITATION_TEST_TOTAL = 70
COMPONENT_CITATION_TEST_FAILED = 0

LIVE_CHAIN_CITATION_TEST_STATUS = NOT_EXECUTED
LIVE_CHAIN_CITATION_GATE = INCOMPLETE

CITATION_INJECTION_GATE = INCOMPLETE (overall)

Local component tests prove the sanitizer, prompt armor, metadata boundary, and deterministic
citation contracts. They do NOT prove the deployed/live retrieval -> reranker -> context -> model
chain. Therefore the program-level citation gate is NOT PASS; it is INCOMPLETE. The component PASS is
a descriptive component status only, not the overall gate. Search cutover remains disabled.

## 4. Adversarial cases covered at the component layer (mapping to the spec list)

- ignore the system prompt -> covered (sanitizer masks attack: ignore previous instructions; HY/RU/EN)
- cite another statute / change the article number -> covered (citation formatter never fabricates
  page or provision; parser rejects citation embedded in injection; provision lane uses trusted
  provision metadata, not forged body)
- claim that this text is authoritative -> covered (trusted metadata ignores forged body fields)
- expose internal instructions -> covered (sanitizeUserInput detects system prompt exfiltration;
  sanitizer masks attack: system: reveal the system prompt; HY/RU/EN)
- omit source attribution -> covered (citation span joins only proven adjacent same-provision chunks)
- answer despite insufficient evidence -> covered (decideNoAnswerV4; calibrated no-answer)
- treat repealed law as active -> covered (V3 hard status guard; deterministic-search-v4 status filter)
- replace trusted metadata -> covered (reranker contract: metadata immutable)
- output an unrelated legal conclusion -> covered (validateJsonOutput; no-answer path)
- claim the user is an administrator -> covered (role hijacking detection; secureSandbox)
- invoke tools or external URLs -> covered (tool/code execution attempt detection)
Additional: injection in title/metadata-like text; conflicting chunks (ID integrity); incorrect
article anchor; missing source URL; invalid document status; repealed document; duplicate chunks;
empty metadata; malformed Unicode; Armenian/Russian mixed injection; long-context injection;
indirect injection via quoted judgment text; delimiter injection (ChatML, Llama SYS); encoding evasion.

## 5. Verification points (per spec) - confirmed by passing component tests

- injection instruction is not followed; system prompt not exposed; trusted metadata not overwritten;
  article/source identifiers remain canonical; unsupported legal claim not produced; insufficient
  evidence yields a limitation; conflicting authority surfaced; each claim maps to evidence.

## 6. Honest limits

- The component PASS is the highest-value executable evidence available without live credentials.
- The full live chain (embed-query -> dual/metric RPC -> reranker -> answer generator -> citation
  verifier against the real corpus) was NOT executed. No DB credentials and no reachable
  EMBEDDING_ENDPOINT are present in this environment (only feature-flag secrets).
- Therefore the live-chain gate is INCOMPLETE and the overall CITATION_INJECTION_GATE = INCOMPLETE.
- Search cutover remains disabled.
