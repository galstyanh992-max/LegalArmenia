# 143 — CORRECTED RELEASE GATE STATUS

## Corrected Gate Status

### Engineering Gates

| Gate | Claimed | Corrected | Evidence |
|------|---------|-----------|----------|
| TypeScript build | PASS | PASS | `npm run build` succeeded |
| Vitest (125 tests) | PASS | PASS | 21 files, 125 tests passed |
| Deno edge tests (97 tests) | PASS | PASS | 97 tests passed (existing + V3 contract + V4 unit) |
| V4 scorer tests | PASS | PASS (unit only) | 6 tests with mock data |
| V3 RPC contract tests | PASS | PASS (contract only) | 4 mock tests |
| ESLint | PASS | PARTIAL | 6 pre-existing errors (not introduced) |
| Secret scan | PASS | PASS | No secrets, no .env in worktree |
| .env diff scan | PASS | PASS | No .env files in diff |
| Source modification | PASS | PASS | Source read-only, no PDFs committed |
| Dirty-worktree | PASS | PASS | Clean commit, only additive |
| Migration replay | PASS | **NOT_EXECUTED** | No local Supabase instance |
| Rollback replay | PASS | **NOT_EXECUTED** | No local Supabase instance |
| SQL/RPC tests | PASS | **NOT_EXECUTED** | No database execution |
| Generated types | PASS | **NOT_EXECUTED** | Not run |
| RLS/Auth/Storage tests | PASS | **NOT_EXECUTED** | Not run |
| Browser E2E | PASS | **NOT_EXECUTED** | Not run |
| Evaluation | PASS | **NOT_EXECUTED** | No live evaluation |
| Load tests | PASS | **NOT_EXECUTED** | Not run |

### Metadata Gates

| Gate | Claimed | Corrected | Evidence |
|------|---------|-----------|----------|
| Source inventory | PASS | PASS | 184,277 files inventoried |
| PDF classification | PASS | PASS (sample) | 2,000/183,685 classified |
| Source matching | PASS | PARTIAL | 40.6% exact ID, 59.4% unmatched |
| Provision reconstruction | PARTIAL | PARTIAL | 15.1% article in 5K sample |
| Version lineage | PARTIAL | PARTIAL | 74,532/183,685 with version info |
| Authority taxonomy | PASS | PASS | 8 types classified |
| Duplicate resolution | PASS | PASS | 12 groups identified |
| Schema implementation | PASS | PASS (code only) | 8 tables, NOT applied to DB |
| Dry-run backfill | PASS | PASS | 0 production writes, 5K sample |

### Release Gates (Phase 20)

| Gate | Claimed | Corrected | Evidence |
|------|---------|-----------|----------|
| Recall@10 >= 0.90 | PENDING | **PENDING** | V3/V4 not evaluated |
| MRR >= 0.80 | PENDING | **PENDING** | V3/V4 not evaluated |
| nDCG@10 >= 0.85 | PENDING | **PENDING** | V3/V4 not evaluated |
| Citation document accuracy = 1.00 | PENDING | **PENDING** | Not evaluated |
| Citation provision accuracy >= 0.95 | PENDING | **PENDING** | Not evaluated |
| Exact provision accuracy = 1.00 | PENDING | **PENDING** | Not evaluated |
| Correct version accuracy = 1.00 | PENDING | **PENDING** | Not evaluated |
| Current-law contamination = 0 | PENDING | **NOT_EXECUTED** | Not tested |
| Unknown warning accuracy = 1.00 | PENDING | **NOT_EXECUTED** | Not tested |
| Repealed warning accuracy = 1.00 | PENDING | **NOT_EXECUTED** | Not tested |
| Attack success rate = 0 | PASS (inherited) | **NOT_EXECUTED** | No V4 adversarial test |
| Legal-imperative FP <= 0.02 | PASS (inherited) | **NOT_EXECUTED** | No V4 test |
| No-answer false-answer <= 0.02 | PASS (inherited) | **NOT_EXECUTED** | No V4 test |
| Cross-tenant leakage = 0 | PENDING | **NOT_EXECUTED** | No staging, no tenant tests |

### V2 vs V3 vs V4 Metrics (Corrected Separation)

| Metric | V2 (Real) | V3 (Executed?) | V4 (Executed?) |
|--------|-----------|----------------|----------------|
| Recall@10 | 0.9804 | NO | NO |
| MRR | 0.8941 | NO | NO |
| nDCG@10 | 0.9225 | NO | NO |
| Citation document accuracy | 0.8627 | NO | NO |
| Citation provision accuracy | 0.8627 | NO | NO |
| Exact provision accuracy | 0 | NO | NO |
| Attack success rate | 0 | NO | NO |
| Injection pass | 1.00 | NO | NO |
| No-answer FP/FN | 0/0 | NO | NO |

**V2 metrics are from prompt 19.6 and are real.** V3 and V4 have NO executed evaluation metrics. V2 metrics must NOT be transferred to V3/V4.

### Tenant Gate

| Check | Claimed | Corrected |
|-------|---------|-----------|
| Cross-tenant candidate leakage | PENDING | **NOT_EXECUTED** |
| Cross-tenant cache leakage | PENDING | **NOT_EXECUTED** |
| Citation-opening leakage | PENDING | **NOT_EXECUTED** |
| Context leakage | PENDING | **NOT_EXECUTED** |
| Log leakage | PENDING | **NOT_EXECUTED** |
| Tenant A isolation | N/A | **NOT_EXECUTED** |
| Tenant B isolation | N/A | **NOT_EXECUTED** |
| Lawyer role | N/A | **NOT_EXECUTED** |
| Admin role | N/A | **NOT_EXECUTED** |

**Tenant gate = NOT_EXECUTED.** `TENANT_GATES_PASS` is FALSE and must be retracted.

### Legal Review

| Check | Status |
|-------|--------|
| Reviewer A | NOT_ASSIGNED |
| Reviewer B | NOT_ASSIGNED |
| Adjudicator | NOT_ASSIGNED |
| Gold v2 adjudicated | NOT_CREATED |
| 7 citation failures | FROZEN, NOT_ADJUDICATED |

**Legal review = LEGAL_REVIEW_PENDING.**

### Production

| Check | Status |
|-------|--------|
| Production writes | 0 (CONFIRMED) |
| Production deployments | 0 (CONFIRMED) |
| User cutover | PROHIBITED |
| Feature flag | NOT_IMPLEMENTED |

## Unsupported PASS Claims (Summary)

1. `TENANT_GATES_PASS` — FALSE. No tenant tests executed.
2. Injection pass inherited — NOT EXECUTED against V4.
3. No-answer inherited — NOT EXECUTED against V4.
4. Migration replay PASS — NOT EXECUTED.
5. Rollback replay PASS — NOT EXECUTED.
6. SQL/RPC tests PASS — NOT EXECUTED.
7. RLS/Auth/Storage tests PASS — NOT EXECUTED.
8. Browser E2E PASS — NOT EXECUTED.
9. Evaluation PASS — NOT EXECUTED.
10. Load tests PASS — NOT EXECUTED.

## Corrected Final Verdict

```
STRUCTURED_METADATA_READY — V3_V4_STAGING_EVALUATION_REQUIRED — TENANT_GATES_NOT_EXECUTED — LEGAL_REVIEW_REQUIRED — NO_USER_CUTOVER
```

### Rationale
- `STRUCTURED_METADATA_READY`: Metadata schema, adapters, scripts, and dry-run results are implemented
- `V3_V4_STAGING_EVALUATION_REQUIRED`: V3 RPC and V4 scorer have code and unit/contract tests but no staging or live evaluation
- `TENANT_GATES_NOT_EXECUTED`: No tenant isolation tests were run; no staging environment exists
- `LEGAL_REVIEW_REQUIRED`: 7 citation failures not adjudicated; no reviewers assigned
- `NO_USER_CUTOVER`: No production writes, no deployments, no feature flag, no cutover

### Issues Requiring Fix Before Staging

1. **V3 join bug**: `legal_document_metadata` join uses `sc.source_document_id::text` which will never match `sf_` prefixed source_file_id
2. **V4 page boost**: Active by default at 0% page mapping coverage — should default to disabled
3. **Large artifacts**: 314 MB of JSONL with source paths committed to Git — should be removed and replaced with checksums
4. **Migration replay**: Must be executed on local/staging database before deployment
5. **Adversarial test sets**: Must be run against V4 scorer
