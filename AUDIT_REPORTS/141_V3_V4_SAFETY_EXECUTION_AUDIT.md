# 141 — V3 V4 SAFETY EXECUTION AUDIT

## RPC V3 Execution Path (Call Graph)

```
request
→ p_query_text validation (QUERY_REQUIRED, TOO_LONG)
→ p_metric_embedding validation (dimension, non-finite, zero vector)
→ status_scope validation (current/extended/historical)
→ provision extraction from query (article/part/point regex)
→ provision_lane (search_chunks.article_number = extracted)
→ legal_provision_lane (legal_provisions.article = extracted, review_status)
→ identifier_lane (doc_number_clean, arlis_doc_id, canonical_key)
→ metric_candidates → metric_raw (ANN with status/temporal guards)
→ chunk_fts_candidates → chunk_fts_raw (FTS with status/temporal guards)
→ lane fusion (RRF with provision lane priority)
→ enriched (joins: legal_provisions, legal_document_metadata, legal_source_page_mappings)
→ deduplicated (duplicate collapse by chunk_text_sha256)
→ document_capped (max 3 per document, source_rank)
→ output (ordered by provision match, source_rank, rrf_score)
```

## V3 Meaningful Use of Metadata

V3 is NOT a simple V2 wrapper. It adds:
1. **Provision lane**: New CTE that queries `search_chunks.article_number` — this is meaningful
2. **Legal provision lane**: New CTE that joins `legal_provisions` — this is meaningful
3. **Metadata enrichment**: 3 left joins in `enriched` CTE — adds provision_key, canonical_citation, authority_type, page mapping

**HOWEVER**: The `legal_document_metadata` join has a **type mismatch bug**:
```sql
left join public.legal_document_metadata ldm 
  on ldm.source_file_id = sc.source_document_id::text
```
- `sc.source_document_id` is UUID → `::text` produces `550e8400-e29b-41d4-...`
- `ldm.source_file_id` is text `sf_936c345f8d3e98d8`
- **This join will NEVER match.** authority_type and meta_source_url will always be NULL.

The `legal_provisions` join uses `lp.chunk_id = sc.chunk_id` which is correct (both UUID).
The `legal_source_page_mappings` join uses `lpm.chunk_id = sc.chunk_id` which is correct (both UUID).

## V3 Execution Status

| Check | Result |
|-------|--------|
| Function created as SQL text | YES |
| Applied to database | NO |
| Executed with real data | NO |
| Contract tests (mock RPC) | YES — 4 tests PASS |
| E2E test | NO |
| Performance measured | NO |
| Returns ECHR in ARLIS-only path | NO — V3 does not filter by source (same as V2) |
| Ambiguous joins | YES — ldm join has type mismatch bug |
| Low-confidence metadata as authoritative | NO — legal_provision_lane filters to pending/approved, confidence affects RRF weight |

## Scorer V4 Safety Execution

### Sanitizer Invocation
V4 calls `rankDeterministicV3()` which calls `sanitizeRankingText()` on each row's `chunk_text`. The sanitizer IS invoked in the V4 code path.

**BUT**: No adversarial injection set was run against V4. The sanitizer's effectiveness against V4's specific scoring path is untested.

### V4 Feature Execution Status

| Feature | Code Present | Executed | Evidence |
|---------|-------------|----------|----------|
| Sanitizer | YES (via V3) | Unit test only | Mock rows, no adversarial set |
| Trusted metadata boundary | YES | Unit test only | Mock rows |
| Status guard | YES | Unit test only | 1 test checks repealed exclusion |
| Temporal guard | YES | NOT TESTED | No temporal test in V4 suite |
| No-answer gate | YES | Unit test only | 2 tests with mock data |
| Page mapping boost | YES | NOT TESTED | Active by default, 0% mapping coverage |
| Version validity guard | YES | NOT TESTED | No test with effective_at |
| Authority boost | YES | NOT TESTED | No test with authority data |
| Canonical source preference | YES | NOT TESTED | No test with source preference |

### Required Metrics (NOT EXECUTED)

| Metric | Status |
|--------|--------|
| Injection pass | NOT_EXECUTED |
| Attack success rate | NOT_EXECUTED |
| Legal-imperative false positive | NOT_EXECUTED |
| No-answer false-answer | NOT_EXECUTED |
| No-answer false-negative | NOT_EXECUTED |
| Status contamination | NOT_EXECUTED |

## V4 Page Boost Active with 0% Mapping

V4's `pageMappingScore()` returns 0.50 for any row with `page_from` or `page_to` in the base MetricCorpusRow (from search_chunks), even when `legal_source_page_mappings` is empty. This means:
- The page boost is **active by default**
- It gives 0.50 * 0.02 = 0.01 bonus to chunks with existing page_from
- This is from pre-existing data, NOT from the new structured mapping
- The boost should be **disabled by default** until page mapping backfill is complete

## Metadata Missingness

| Feature | State | Notes |
|---------|-------|-------|
| Provision | ABSENT for 84.9% of sample | Only 15.1% have article metadata |
| Authority | ABSENT for 73% (unknown) | 27% have identifiable authority |
| Effective date | ABSENT | 0% recovered |
| Version | ABSENT for 59.4% | 40.6% have version info from filename |
| Source URL | PARTIAL (40.6%) | From ARLIS DocID in filename |
| Page mapping | ABSENT | 0% coverage in legal_source_page_mappings |
| Canonical source | PARTIAL | V4 uses source field, not canonical_source_id |

### Missingness Safety Checks

| Check | Result |
|-------|--------|
| Metadata presence alone gives ranking bonus | NO — bonus requires confidence + provision match |
| Missingness penalizes candidate | NO — absent metadata gives 0 boost, not penalty |
| Low-confidence values used as exact citation | NO — legal_provision_lane weights low at 0.50 |
| Page boost disabled at 0% mapping | **NO — boost is ACTIVE by default** |
| Provision feature activates only on trusted join | PARTIAL — provision_lane uses search_chunks.article_number (existing field), legal_provision_lane uses new table |

## Verdict
V3 and V4 have code and unit/contract tests but NO end-to-end safety execution. Adversarial injection, no-answer, status contamination, and temporal guard tests were NOT executed. Page boost is incorrectly active at 0% mapping coverage. V3 has a join type mismatch bug that makes authority metadata enrichment non-functional.
