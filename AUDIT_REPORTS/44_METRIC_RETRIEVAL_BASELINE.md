# 44 — Metric retrieval baseline

## Dataset and method

- Disposable local Supabase; all synthetic corpus rows rolled back.
- Offline local `Metric-AI/armenian-text-embeddings-2-large`, 1024 dimensions; no Qwen/external embedding service.
- 90 queries: 30 Armenian semantic, 15 Russian→Armenian, 15 exact identifiers, 10 unknown-only, 10 historical, 10 no-answer.
- Compared old dual RPC Metric path with new `current`, `extended`, and `historical` contracts.

## Provisional retrieval results

| Mode | R@5 | R@10 | R@20 | MRR | nDCG@10 | Source hit | p50 ms | p95 ms | p99 ms |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| old dual Metric | 0.9333 | 1.0000 | 1.0000 | 0.8745 | 0.9036 | 1.0000 | 6.977 | 8.106 | 24.829 |
| current | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 7.881 | 8.833 | 17.165 |
| extended | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 8.335 | 9.700 | 10.694 |
| historical | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 8.753 | 10.076 | 10.695 |

Status contamination and warning failures were zero in every mode.

## pgvector matrix

- 720 variants cover probes `10/30/60`, iterative scan `off/relaxed_order`, max probes `60/120`, ANN `50/75/100/150/200`, FTS `30/50/75/100`, final `10/15/20`.
- Every variant contains exact-vector baseline, ANN Recall@5/10/20, latency, post-filter counts/statuses, and `EXPLAIN (ANALYZE, BUFFERS)` evidence.
- The normal planner correctly chooses exact scan for the 30-row disposable corpus.
- Forced plans use `embeddings_ivf_metric_idx` in all 720 variants.
- Forced-IVFFlat recall ranges are R@5 `0.24..0.44`, R@10 `0.20..0.50`, R@20 `0.17..0.62`. This is not a production-quality estimate: the existing index has 900 lists but the disposable corpus has only 30 rows.
- No final pgvector parameters were selected. Production-sized staging measurements are required.

## No-answer behavior

At a deliberately uncalibrated score threshold of `0.3`, all 10 no-answer queries return a false positive. Synthetic best-balanced thresholds are `0.4015` for current and `0.5278` for extended/historical, but `production_threshold_selected=false`; no threshold was hardcoded from synthetic data.

This baseline verifies architecture and status safety, not the future 280-case lawyer-approved gold quality target or production latency.

