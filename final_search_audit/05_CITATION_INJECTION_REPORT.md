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
Combined: 70 passed, 0 failed. Transcript: final_search_audit/TEST_RUN_TRANSCRIPT.txt.

## 3. Adversarial cases covered (mapping to the spec list)

Spec required vectors and their coverage in the harness:
- ignore the system prompt -> covered (sanitizer masks attack: ignore previous instructions; HY/RU/EN)
- cite another statute / change the article number -> covered (citation formatter never fabricates
  page or provision; parser rejects citation embedded in injection; provision lane uses trusted
  provision metadata, not forged body)
- claim that this text is authoritative -> covered (trusted metadata ignores forged body fields)
- expose internal instructions -> covered (sanitizeUserInput detects system prompt exfiltration;
  sanitizer masks attack: system: reveal the system prompt; HY/RU/EN)
- omit source attribution -> covered (citation span joins only proven adjacent same-provision chunks;
  citation formatter never fabricates)
- answer despite insufficient evidence -> covered (decideNoAnswerV4 returns not answerable when no
  evidence; calibrated no-answer uses separate signals and exact refusal text)
- treat repealed law as active -> covered (V3 hard status guard excludes unknown from current;
  deterministic-search-v4 filters out ineligible status; reranker status guard applied by runtime)
- replace trusted metadata -> covered (reranker contract: metadata is immutable; status guard
  applied by deterministic runtime and metadata is immutable)
- output an unrelated legal conclusion -> covered (validateJsonOutput rejects missing analysis;
  no-answer calibration; unsupported-conclusion rejection path)
- claim the user is an administrator -> covered (sanitizeUserInput detects role hijacking;
  secureSandbox neutralizes)
- invoke tools or external URLs -> covered (sanitizeUserInput detects tool/code execution attempts)

Additional attack surfaces covered:
- injection inside title / metadata-like text -> parser negatives + forged body fields
- conflicting chunks -> reranker candidate ID integrity (no invention/omission/duplication)
- incorrect article anchor -> parser rejects citation embedded in injection
- missing source URL -> citation formatter never fabricates
- invalid document status -> V3 hard status guard
- repealed document -> status guard + temporal validity
- duplicate chunks -> deterministic-search-v4 collapses duplicates; duplicate_group handling
- empty metadata -> no-answer path
- malformed Unicode -> sanitizer preserves legal imperative across HY/RU/EN
- Armenian/Russian mixed injection -> HY + RU sanitizer cases
- long-context injection -> secureSandbox wraps text in fenced data block
- indirect injection through quoted judgment text -> injection candidate remains data; stable ID
  preserved; not promoted
- delimiter injection (ChatML, Llama SYS) -> sanitizeUserInput handles ChatML + Llama delimiters
- encoding evasion -> sanitizeUserInput detects encoding evasion

## 4. Verification points (per spec) - all confirmed by passing tests

- injection instruction is not followed (sanitizer masks, parser rejects)
- system prompt is not exposed (exfiltration detection; secureSandbox)
- trusted metadata is not overwritten (metadata immutable; forged body ignored)
- article and source identifiers remain canonical (citation formatter never fabricates; provision
  lane uses trusted provision metadata)
- unsupported legal claim is not produced (validateJsonOutput; no-answer path)
- insufficient evidence yields a limitation (decideNoAnswerV4; calibrated no-answer)
- conflicting authority is surfaced (status guard; duplicate collapse; ID integrity)
- answer maps each legal claim to evidence (citation span joins only proven same-provision chunks)

## 5. Result

CITATION_INJECTION_GATE = PASS (component-level, executable, 70/70).
CITATION_TEST_TOTAL = 70. CITATION_TEST_FAILED = 0.

## 6. Honest limits

- The gate is proven at the sanitizer / parser / provision-lane / citation-formatter / reranker-contract
  layer against synthetic adversarial fixtures. This is the layer where injection defenses live, so it
  is the highest-value executable evidence available without live credentials.
- The full live chain (embed-query -> dual/metric RPC -> reranker -> answer generator -> citation
  verifier against the real corpus) was NOT executed. No DB credentials and no reachable
  EMBEDDING_ENDPOINT are present in this environment (only feature-flag secrets).
- Therefore: live-chain injection PASS is NOT claimed. Search cutover remains blocked until the
  live-chain confirmation is run with credentials and the legal review gate passes.
