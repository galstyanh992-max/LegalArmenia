# 139 — FINAL REPORT CONSISTENCY AUDIT

## Method
Independent audit of commit 01ad8a7 on branch codex/prompt-19-7-structured-metadata-loop.
Verified each claimed gate against actual executed evidence.

## Verdict Consistency Table

| Gate | Claimed Status | Actual Evidence | Evidence File | Executed? | Correct Status |
|------|---------------|-----------------|---------------|-----------|----------------|
| Source inventory | COMPLETE | 184,277 files, SHA-256 hashed | source_inventory_summary.json | YES | PASS |
| PDF classification | PASS | 2,000 sample, 98.7% text-based | pdf_classification_summary.json | YES (sample) | PASS (sample) |
| Metadata reconstruction | PARTIAL | 5,000 sample, 15.1% article | provision_reconstruction_summary.json | YES (sample) | PARTIAL |
| Migration replay | PASS (implied) | NOT EXECUTED — no local Supabase instance | N/A | NO | NOT_EXECUTED |
| RPC V3 | PASS (contract) | 4 mock contract tests | metric-rpc-v3.contract.test.ts | YES (mock only) | CONTRACT_ONLY |
| Scorer V4 | PASS (unit) | 6 unit tests with mock rows | deterministic-search-v4.test.ts | YES (unit only) | UNIT_ONLY |
| Injection | PASS (inherited) | NOT EXECUTED against V4 | N/A | NO | NOT_EXECUTED |
| No-answer | PASS (inherited) | NOT EXECUTED against V4 | N/A | NO | NOT_EXECUTED |
| Citation | PENDING | NOT EXECUTED | N/A | NO | PENDING |
| Exact provision | PENDING | NOT EXECUTED | N/A | NO | PENDING |
| Version accuracy | PENDING | NOT EXECUTED | N/A | NO | PENDING |
| Authority accuracy | PENDING | NOT EXECUTED | N/A | NO | PENDING |
| Page mapping | PARTIAL | 0% coverage, boost active | N/A | NO | ABSENT |
| Tenant isolation | PENDING | NOT EXECUTED — no staging | N/A | NO | NOT_EXECUTED |
| Staging | BLOCKED | No staging environment | N/A | NO | NOT_EXECUTED |
| Legal review | PENDING | No reviewers assigned | N/A | NO | LEGAL_REVIEW_PENDING |
| Shadow | NOT READY | Correct | N/A | NO | NOT_READY |
| Production writes | 0 | Correct — no writes | N/A | N/A | CONFIRMED_0 |

## Critical Contradiction

**Claimed verdict**: `STRUCTURED_SEARCH_ENGINEERING_VERIFIED — TENANT_GATES_PASS — LEGAL_REVIEW_REQUIRED — NO_USER_CUTOVER`

**Problem**: The verdict contains `TENANT_GATES_PASS` but:
- Report 130 states: "PENDING — Requires staging environment"
- Report 129 states: "TENANT_STAGING_BLOCKED — OPERATOR_ACTION_REQUIRED"
- No tenant isolation tests were executed
- No staging environment exists
- No multi-tenant test data was created
- No RLS isolation tests were run

**`TENANT_GATES_PASS` is FALSE.** No tenant gate was executed, let alone passed.

## Other Unsupported PASS Claims

1. **Injection pass = "V3/V4 inherits V3 sanitizer"**: No adversarial injection set was run against V4. The sanitizer is imported but end-to-end injection testing was not performed.

2. **No-answer = "V4 adds VERSION_NOT_EFFECTIVE reason"**: No no-answer test set was executed against V4. Only unit test with mock data.

3. **RPC V3 "PASS"**: Only contract tests with mock RPC client. V3 was never executed against a real database. The function exists as SQL text but has not been applied or tested.

4. **Scorer V4 "PASS"**: Only unit tests with synthetic mock rows. No E2E, no adversarial sets, no real candidate pools.

## V3 RPC Join Bug

The V3 migration contains a join that will never match:
```sql
left join public.legal_document_metadata ldm 
  on ldm.source_file_id = sc.source_document_id::text
```

`sc.source_document_id` is a UUID (format: `550e8400-e29b-41d4-a716-446655440000`).
`ldm.source_file_id` is text (format: `sf_936c345f8d3e98d8`).

The cast `::text` produces a UUID string, not an `sf_` prefixed ID. **This join will always return NULL.** Authority type and metadata source URL from `legal_document_metadata` will never be populated through this join.

## V4 Page Mapping Boost Issue

V4's `pageMappingScore()` falls back to `search_chunks.page_from`/`page_to` when `legal_source_page_mappings` is empty:
```typescript
if (v3.page_from_physical != null) return 1.0;
const sc = row as any;
if (sc.page_from != null || sc.page_to != null) return 0.50;
```

This means V4 gives a 0.50 page mapping score to any chunk that has `page_from` in the existing `search_chunks` table, even though no `legal_source_page_mappings` backfill has occurred. The boost is **active by default** (`pageMappingBoost` is not `false` unless explicitly disabled). This gives unintended ranking bonuses from pre-existing data, not from the new structured mapping.
