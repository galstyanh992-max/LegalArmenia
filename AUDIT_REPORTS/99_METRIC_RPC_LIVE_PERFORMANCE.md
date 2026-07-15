# 99 — Metric RPC Live Performance

## Before

- V1 full shadow call: SQLSTATE `57014`, statement timeout after 60 seconds.

## V2 live benchmark

70 read-only calls; no full query logging; no vectors, IDs, or chunk text emitted.

| Category | Calls | p50 | p95 | p99 |
| --- | ---: | ---: | ---: | ---: |
| Armenian semantic | 20 | 431 ms | 479 ms | 499 ms |
| Russian → Armenian | 10 | 402 ms | 411 ms | 411 ms |
| Exact identifier | 10 | 544 ms | 561 ms | 561 ms |
| Unknown/extended | 10 | 420 ms | 440 ms | 440 ms |
| Historical | 10 | 404 ms | 417 ms | 417 ms |
| No-answer | 10 | 361 ms | 369 ms | 369 ms |
| **All** | **70** | **420 ms** | **548 ms** | **561 ms** |

- Timeouts: `0`.
- Other errors: `0`.
- p50 target ≤1.5 s: PASS.
- p95 target ≤4 s: PASS.
- Preferred p95 ≤2 s: PASS.
- No-answer returned zero rows in all 10 calls.

Result: `METRIC_RPC_PERFORMANCE_PASS`.
