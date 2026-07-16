# 57 — Custom reranker training

Three immutable non-Qwen frozen encoders received identical fixed-seed pilots. Full training used Distil-mBERT plus independent relevance/status/temporal/citation/authority heads.

Training pairs: 3,238 (2,901 train / 337 dev), 432 positives. Matrix: pointwise, pairwise, listwise and combined objectives × negative ratios 2/4/8; seed 1932; AdamW; FP32 CPU; max length 128; batch 16. Frozen test was not used for selection.

Selected on dev: combined objective, negative ratio 8; MRR `0.57185`, nDCG@10 `0.67858`, Recall@10 `1.0`. Head SHA-256: `5b63b151cc7a885e18906fb68748ba3a08f107b6b3adb95b942d274815c0cdde`. Base weights are not committed.
