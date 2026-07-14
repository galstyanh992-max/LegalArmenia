# 47 — GTE/BGE reranker bake-off

## Candidates

| Candidate | Immutable revision | License | Parameters | Dev-selected nonzero weight |
|---|---|---|---:|---:|
| GTE multilingual reranker base | `8215cf04918ba6f7b6a62bb44238ce2953d8831c` | Apache-2.0 | 305,959,681 | 0.05 |
| BGE reranker v2 m3 | `953dc6f6f85a1b2dbfca4c34a2796e7dde08d41e` | Apache-2.0 | 567,755,777 | 0.05 |

Qwen was not used. Exact hashes, tokenizer revisions, GTE remote-code revision and runtime details are in `prompt19_2_model_manifests.json`.

## Frozen test

| System | R@10 | MRR | nDCG@10 | Citation doc | No-answer FP/FN | p95 ms |
|---|---:|---:|---:|---:|---:|---:|
| D scorer | 0.9608 | 0.8743 | 0.9027 | 0.8431 | 0 / 0.0196 | 28.02 |
| E1 GTE | 0.9804 | 0.8720 | 0.9027 | 0.8431 | 0 / 0.0196 | 3,375.75 |
| E2 BGE | 0.9608 | 0.8756 | 0.9035 | 0.8431 | 0 / 0.0196 | 9,307.25 |

## Paired evidence

20,000-query-level bootstrap resamples, seed 1902:

- GTE−D MRR −0.0023, 95% CI [−0.0160, 0.0072]; nDCG +0.00009, CI [−0.0163, 0.0179].
- BGE−D MRR +0.0013, 95% CI [−0.0108, 0.0141]; nDCG +0.00087, CI [−0.0098, 0.0124].
- Citation difference is 0 for both; exact McNemar p=1.0.

Neither candidate materially improves both MRR and nDCG. Both fail citation accuracy 1.00, repeated-warning recall 1.00, adversarial ranking 1.00, cross-tenant measurement, legal review, and p95 ≤1,500 ms. BGE/GTE service contract injection tests pass, but corpus adversarial ranking succeeds only 1/2.

## Verdict

`GENERIC_RERANKERS_REJECTED — CUSTOM_ARMENIAN_LEGAL_RERANKER_REQUIRED — NO_PRODUCTION_WRITES`
