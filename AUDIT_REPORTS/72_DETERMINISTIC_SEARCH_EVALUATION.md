# 72 — Deterministic search evaluation

Frozen test, 56 queries / 51 answerable:

| Metric | V1 | V2 |
|---|---:|---:|
| Recall@5 | 0.9216 | 0.9412 |
| Recall@10 | 0.9608 | 0.9804 |
| Recall@20 | 0.9804 | 1.0000 |
| MRR | 0.8743 | 0.8939 |
| nDCG@10 | 0.9027 | 0.9223 |
| Citation document | 0.8431 | 0.8627 |
| Citation provision | 0.8431 | 0.8627 |
| Injection pass | 0.5000 | 0.5000 |
| Current contamination | 0 | 0 |

V2 latency: p50 61.24 ms, p95 67.69 ms, p99 68.61 ms in the offline evaluator. Citation and injection release gates fail. Cross-tenant staging is not measured.

Post-audit infrastructure verification: the corrected base `EMBEDDING_ENDPOINT` returned a finite 1024-dimensional Metric vector in 689.59 ms after warmup. A clean Docker replay applied all 9 migrations; `search_legal_corpus_metric` exists and executes locally. The live PostgREST schema cache still returns `PGRST202`, and the deployed `embed-query` perimeter still returns `403 cors_not_allowed`.

Evidence: `artifacts/prompt19_4_evaluation_metrics.json`.
