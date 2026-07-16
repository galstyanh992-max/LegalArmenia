# 128 — LOCAL STRUCTURED SEARCH EVALUATION

## Evaluation Status
Local evaluation performed against frozen gold dataset using V2 baseline.
V3 and V4 evaluation requires live Supabase connection (staging environment).

## V2 Baseline (from prompt 19.6)
| Metric | Value |
|--------|-------|
| Recall@10 | 0.9804 |
| MRR | 0.8941 |
| nDCG@10 | 0.9225 |
| Citation document accuracy | 0.8627 |
| Citation provision accuracy | 0.8627 |
| Exact provision accuracy | 0 |
| Injection pass | 1.00 |
| Attack success rate | 0 |

## V3/V4 Local Evaluation
Pending live database connection for RPC V3 testing.
V4 scorer unit tests pass (6/6).

## Gates Required
| Gate | Required | V2 | V3/V4 |
|------|----------|-----|-------|
| Recall@10 | >= 0.90 | 0.9804 | pending |
| MRR | >= 0.80 | 0.8941 | pending |
| nDCG@10 | >= 0.85 | 0.9225 | pending |
| Citation document accuracy | = 1.00 | 0.8627 | pending |
| Citation provision accuracy | >= 0.95 | 0.8627 | pending |
| Exact provision accuracy | = 1.00 | 0 | pending |
| Correct version accuracy | = 1.00 | N/A | pending |
| Attack success rate | = 0 | 0 | pending |
