# 58 — Custom reranker evaluation

Practical effect was fixed before test: absolute MRR or nDCG@10 improvement at least `0.03`. Dev selected top-N `10` and custom weight `0.05`.

On frozen test the custom system produced the same ranking as deterministic baseline D: Recall@10 `0.96078`, MRR `0.87429`, strict nDCG@10 `0.89028`; paired differences are exactly `0`, bootstrap 20,000 CI `[0,0]` for MRR and nDCG. The Prompt 19.2 operational nDCG definition remains `0.9027`; identical ranking means no improvement under either definition.

Citation document accuracy `0.84314`; provision accuracy `0.82353`; current-law contamination `0`; injection pass `0.5`. Verdict: `CUSTOM_RERANKER_REJECTED`.
