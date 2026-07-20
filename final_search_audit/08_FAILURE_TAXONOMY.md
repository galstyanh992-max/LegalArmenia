# LEGALARMENIA - Failure Taxonomy (Phase 6)

Base: ad20a27. Date: 2026-07-20.

## 1. Status

No live retrieval run was executed this session (see 07_RETRIEVAL_EVALUATION.md: BLOCKED on
credentials). Therefore there are no live failed queries to classify. This document records the
classification schema and the structural failure modes verified NOT to occur by contract tests.

## 2. Failure classification schema (per spec)

For every failed query, classify into exactly one:
  1. candidate-generation failure (ANN + FTS both returned nothing)
  2. Metric embedding failure (embed-query unavailable / non-finite / wrong dimension)
  3. FTS failure (ts_query matched nothing; tokenizer gap)
  4. identifier parser failure (article/part/point not parsed; HY/RU/EN variants)
  5. metadata failure (legal_provisions / legal_document_metadata missing or low-confidence)
  6. status filtering failure (norm_status mis-set; active-vs-repealed mis-classification)
  7. version selection failure (document_versions.is_current wrong; supersession not resolved)
  8. reranker failure (ID invention/omission/duplication; non-finite score; wrong ordering)
  9. citation selection failure (fabricated anchor; span across different provisions)
  10. answer-generation failure (unsupported legal conclusion; missing source attribution)
  11. insufficient corpus evidence (genuinely no supporting chunk in corpus)
  12. invalid expected label (gold label wrong; engineer/lawyer disagreement)

## 3. Structural modes verified NOT to occur (executable, contract tests)

- Reranker failure modes (legal-reranker-contract.test.ts, 9 pass):
  * cannot invent, omit, or duplicate candidate IDs
  * prompt-injection candidate remains data; stable ID preserved (not promoted)
  * status guard applied by deterministic runtime; metadata immutable
  * production runtime never calls experimental reranker
  * legacy enabled flag cannot reactivate experimental reranker
  * real abort timeout retries once and opens the circuit
  * non-finite, missing, and duplicate response scores are rejected
  * calibrated no-answer uses separate signals and exact refusal text
- Deterministic scorer v4 (deterministic-search-v4.test.ts, 6 pass):
  * filters out ineligible status
  * collapses duplicates
  * returns not-answerable when no evidence
- Provision parser (prompt19-6-citation-injection.test.ts, 35 pass):
  * parses HY/RU/EN article/part/point; rejects false citations from numbers in text
  * rejects citation embedded in injection
- Citation formatter:
  * never fabricates page or provision; span joins only proven adjacent same-provision chunks

These cover failure modes 4, 6, 8, 9, 10 (partial) at the component layer.

## 4. Modes NOT verifiable without a live run

Modes 1, 2, 3, 5, 7, 11, 12 require a live retrieval run against the corpus to observe and classify
real failures. Specifically:
- Metric embedding failure (2): needs embed-query reachable; unavailable here.
- FTS failure (3) and identifier parser failure (4 live): need real queries against real chunks.
- metadata failure (5) and version selection (7): need legal_provisions/legal_document_metadata
  coverage data and document_versions supersession against the live corpus.
- insufficient corpus evidence (11) vs invalid expected label (12): need the live run + the legal
  reviewer to disambiguate.

## 5. Tuning discipline (per spec)

- Do NOT tune the system against the blind test set.
- Any repair uses train/dev only; the blind test set stays frozen.
- Create a minimal coherent change; add regression tests; rerun train/dev; run blind ONCE after
  freeze.
- Do not deploy or cut over.

## 6. Conclusion

FAILURE_TAXONOMY = SCHEMA_DEFINED; no live failures classified (no live run).
Pending a live run, this taxonomy is the framework into which any observed failure will be slotted.
