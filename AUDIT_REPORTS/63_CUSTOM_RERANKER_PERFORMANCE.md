# 63 — Custom reranker performance

Hardware: Xeon E5-2699 v3, 18/36 cores, CPU FP32, no GPU. Cold startup `11,183 ms`; working set `491,372,544` bytes.

Warm service: 10 candidates p50 `234.43 ms`, p95 `237.13 ms`, p99 `242.04 ms`, `4.30 rps`; 20 candidates p50 `476.83 ms`, p95 `487.87 ms`, p99 `496.67 ms`, `2.10 rps`. Concurrency 4: 12/12 successful, `4.12 rps` with serialized model lock. Local cost/query `$0`.

The 50-candidate CPU target was not met; dev therefore selected deterministic preselection to 10, but quality still did not improve.
