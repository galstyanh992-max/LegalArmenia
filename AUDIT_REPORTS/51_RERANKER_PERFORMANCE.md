# 51 — Reranker performance

## Environment

Intel Xeon E5-2699 v3, 18 cores/36 logical processors, 68,565,090,304 bytes RAM, no GPU, FP32, batch 16, max length 128. Python 3.14.2, torch 2.11.0+cpu, transformers 4.48.3.

## Measurements

| Component | p50 ms | p95 ms | p99 ms | Throughput q/s |
|---|---:|---:|---:|---:|
| D scorer, frozen 50 candidates | 24.60 | 28.02 | 43.43 | 39.17 |
| GTE, frozen 50 candidates | 3,168 | 3,375.75 | 3,432.25 | 0.312 |
| BGE, frozen 50 candidates | 7,889 | 9,307.25 | 27,799.2 | 0.115 |

Cold eager load is 9.82 s GTE and 9.57 s BGE. Working set after load is 1.98 GB and 2.59 GB respectively. At concurrency 4 with two short candidates, both pass 12/12; this does not replace full 50-candidate latency.

Both candidates fail the 1,500 ms p95 budget. Live embedding, production identifier/ANN/FTS/fusion, separated queue time, full end-to-end production retrieval and stable concurrency for 50 full legal candidates were not measured in Prompt 19.2 and remain blockers. Prompt 19.1 disposable Metric RPC evidence is referenced but is not promoted to a production latency claim.

Full artifact: `prompt19_2_performance_report.json`.
