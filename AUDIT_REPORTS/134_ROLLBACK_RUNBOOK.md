# 134 — ROLLBACK RUNBOOK

## Rollback Assets

| Asset | Location | Safe? |
|-------|----------|-------|
| V1 RPC | search_legal_corpus_metric | Yes (untouched) |
| V2 RPC | search_legal_corpus_metric_v2 | Yes (untouched) |
| Dual RPC | search_legal_corpus_dual | Yes (untouched) |
| Additive schema rollback | rollback/20260716000100_*.sql | Yes (drops new tables only) |
| RPC V3 rollback | rollback/20260716000200_*.sql | Yes (drops V3 function only) |

## Rollback Steps

### Instant (feature flag)
1. Disable V3/V4 feature flag
2. User route reverts to V2 automatically
3. No data loss, no migration needed

### Full rollback
1. `psql -f rollback/20260716000200_metric_rpc_v3_rollback.sql`
2. `psql -f rollback/20260716000100_additive_legal_metadata_schema_rollback.sql`
3. All additive tables dropped
4. V1, V2, dual RPC remain operational

## Verification
- Confirm `search_legal_corpus_metric_v3` does not exist
- Confirm additive tables do not exist
- Confirm `search_legal_corpus_metric_v2` returns correct results
- Confirm no production data was modified
