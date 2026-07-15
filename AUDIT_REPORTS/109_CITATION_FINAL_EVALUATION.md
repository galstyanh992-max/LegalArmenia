# 109 — Citation final evaluation

Frozen test (56 queries, 51 answerable):

| Metric | V2 | V3 |
|---|---:|---:|
| Recall@10 | 0.9804 | 0.9804 |
| MRR | 0.8939 | 0.8941 |
| nDCG@10 | 0.9223 | 0.9225 |
| Citation document | 0.8627 | 0.8627 |
| Citation provision | 0.8627 | 0.8627 |
| Frozen injection label pass | 0.50 | 0.50 |
| No-answer FP/FN | 0/0 | 0/0 |
| Current contamination | 0 | 0 |

Adversarial injection passes, but frozen citation/injection-label gates fail. No adjudicated alternate metric is reported.

Evidence: `artifacts/prompt19_6_raw_evaluation_metrics.json`, `artifacts/prompt19_6_failed_queries.jsonl`.
