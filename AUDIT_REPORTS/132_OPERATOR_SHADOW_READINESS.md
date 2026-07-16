# 132 — OPERATOR SHADOW READINESS

## Status
NOT READY — Requires staging evaluation pass

## Requirements for Shadow
1. Offline and staging gates pass
2. V3/V4 behind disabled feature flag
3. User route unchanged
4. Operator-only shadow requests
5. No user-visible answer changes
6. Log only sanitized IDs, ranks, statuses, timings
7. No full query/chunk logging
8. Rollback rehearsed

## Feature Flag
Not yet implemented. Requires staging evaluation pass first.

## Current State
- V3 RPC migration created (not deployed)
- V4 scorer created (not wired to runtime)
- No feature flag implemented
- No production cutover
