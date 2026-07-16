# 133 — PRODUCTION CUTOVER PLAN

## Prerequisites
1. All Phase 20 gates pass
2. Legal review completed (gold adjudication)
3. Operator shadow verification pass
4. Operator explicit authorization

## Cutover Steps
1. Apply migration 20260716000100 (additive schema)
2. Apply migration 20260716000200 (RPC V3)
3. Run metadata backfill (non-dry-run)
4. Enable feature flag for V3/V4
5. Monitor shadow metrics
6. Switch user route to V3
7. Monitor for 48 hours
8. If issues: disable feature flag (instant rollback)

## Rollback
1. Disable feature flag (instant, no data loss)
2. Drop V3 function (rollback migration)
3. Drop additive tables (rollback migration)
4. V1, V2, dual RPC all remain operational

## Authorization
PRODUCTION_CUTOVER_APPROVAL_REQUIRED
No production cutover without separate explicit operator authorization.
