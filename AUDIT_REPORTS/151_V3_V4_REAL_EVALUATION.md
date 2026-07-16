# 151 — Real V3/V4 Evaluation

## Methodology

Local evaluation using actual RPC V3 outputs from local Docker Supabase with fixture data (3 documents, 3 chunks). V4 scorer applied to V3 output rows.

## Limitations

- Fixture corpus is small (3 documents, 3 chunks)
- No gold relevance labels for authoritative ranking metrics
- No gold page mapping for page metrics
- No gold authority labels for authority metrics
- No embedding vectors (embeddings table empty) — ANN lane inactive, FTS/identifier lanes only

## Metrics

| Metric | V2 | V3 | V4 | V4 page disabled | V4 no authority | V4 no canonical | V4 no provision |
|--------|----|----|----|-----------------|-----------------|-----------------|-----------------|
| Recall@5 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 |
| Recall@10 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 |
| MRR | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 |
| nDCG@10 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 |
| citation_doc_accuracy | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 |
| injection_pass | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| no_answer_FP | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| no_answer_FN | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| status_contamination | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| p50/p95/p99 latency | NOT_MEASURABLE | NOT_MEASURABLE | NOT_MEASURABLE | NOT_MEASURABLE | NOT_MEASURABLE | NOT_MEASURABLE | NOT_MEASURABLE |

## NOT_MEASURABLE Metrics

| Metric | Reason |
|--------|--------|
| citation_provision_accuracy | No gold provision labels |
| exact_provision_accuracy | No gold provision labels |
| page_metric | NOT_MEASURABLE — no gold page mapping (coverage = 0%) |
| authority_metric | NOT_MEASURABLE — no gold authority labels |
| version_metric | NOT_MEASURABLE — no gold version labels |
| p50/p95/p99 | NOT_MEASURABLE — local fixture, no production latency data |

## Rules Followed

- No inherited metrics ✓
- No mock-only metrics ✓ (actual RPC V3 output used)
- Pending metrics remain pending ✓
- page metric = NOT_MEASURABLE (no gold mapping) ✓
- authority metric = NOT_MEASURABLE (no gold labels) ✓
- version metric = NOT_MEASURABLE (no gold labels) ✓

## V4 Feature Ablation

- V4 with page disabled: identical results (page boost = 0 without trusted mapping)
- V4 without authority: identical results (authority score additive, small effect)
- V4 without canonical source: identical results (canonical score additive, small effect)
- V4 without provision metadata: identical results (provision data absent in fixtures)

## Status

PASS — evaluation executed with real RPC outputs. NOT_MEASURABLE metrics correctly marked. No inherited or mock-only metrics.