# LEGALARMENIA - Reranker Gate (Phase 6)

Base: ad20a27. Date: 2026-07-20.

## 1. Reranker in the live chain

- vector-search -> search_legal_corpus_dual returns RRF-ranked candidates.
- legal-chat -> _shared/rag-search.ts applies applyTemporalValidation + rankLegalSources
  (source-hierarchy-engine) after retrieval.
- Deterministic scorers v3/v4 (_shared/deterministic-search-v3.ts, -v4.ts) provide identifier/
  article/title priority, duplicate suppression, effective-date filtering, low-confidence
  rejection, and no-answer decision. These are the production reranking logic (no external ML
  reranker is wired; rerank_ok=false / RERANKER_NOT_CONFIGURED in the active path).
- V3 structured-metadata path (_shared/metric-search-v3.ts) adds provision lane + authority
  metadata joins, but is shadow-only (flags OFF).

## 2. Executable evidence (local, no DB)

| Suite | Tests | Result | Key invariants |
|-------|-------|--------|-----------------|
| legal-reranker-contract.test.ts | 9 | PASS | no ID invent/omit/dup; injection stays data; status guard; metadata immutable; no experimental reranker in prod; legacy flag cannot reactivate; timeout circuit; non-finite/missing/duplicate scores rejected; calibrated no-answer |
| deterministic-search-v4.test.ts | 6 steps | PASS | ranks eligible; filters ineligible status; includes V4 scores; collapses duplicates; answerable vs not-answerable |
| v3-shadow.test.ts | 9 | PASS | flags OFF default; cannot promote V3 to primary; telemetry sanitized (no tokens/keys/query text); timeout classified; RPC errors classified |

## 3. Behavioral proofs NOT executed (need live run)

- Reranking cannot surface inactive law versions against the real corpus (status guard logic is
  tested, but end-to-end against real supersession data is not).
- Reranking cannot mix unrelated articles across documents in real results.
- Reranking cannot overwrite citation metadata from forged chunk text in a live result set.
- Latency under load and timeout fallback rate against the real corpus.
These require the live retrieval run (see 07) and the citation-injection live-chain confirmation.

## 4. Gate status

COMPONENT_RERANKER_TEST_STATUS = PASS (structural/contract invariants hold: 24/24 tests pass).
LIVE_CHAIN_RERANKER_GATE = INCOMPLETE (requires live run + credentials).
RERANKER_GATE = INCOMPLETE (overall; component PASS is descriptive only).
No production reranker is enabled (rerank_ok=false); no experimental reranker is called in the
production runtime; the legacy enabled flag cannot reactivate it. Do not deploy or cut over.
