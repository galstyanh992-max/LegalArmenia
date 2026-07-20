# LEGALARMENIA - Retrieval Evaluation (Phase 5)

Base: ad20a27. Date: 2026-07-20. Mode: read-only. PRODUCTION_MODE = READ_ONLY.

## 1. Status

RETRIEVAL_EVALUATION_STATUS = INCOMPLETE.
The production-equivalent search path (embed-query -> search_legal_corpus_dual/metric -> reranker
-> temporal validation -> context builder) was NOT executed against the frozen gold set this session.
Reason: no DB credentials and no reachable EMBEDDING_ENDPOINT are present in this environment (only
feature-flag secrets: LEGAL_SEARCH_PRIMARY/V3_SHADOW/V3_PRIMARY/TRAFFIC_PERCENT). Computing
Recall@5/10, MRR, nDCG, exact-document/provision hit, citation-anchor accuracy, duplicate rate,
inactive-law leakage, no-answer precision, latency p50/p95, timeout rate, and fallback rate all
require a live run.

## 2. Harness (executable, ready to run with credentials)

- scripts/run_rag_eval.ts: computes match/recall against a gold eval file (--eval <gold.jsonl> --k 10).
  Guards: --allow-production and --write are explicit opt-in flags; default is read-only/non-write.
- supabase/functions/eval-runner/index.ts: Edge-hosted eval runner (cases from a suite).
- Gold set: AUDIT_REPORTS/artifacts/prompt19_2_frozen_gold.jsonl (280 queries; train 168 / dev 56 /
  test 56; query-id leakage = 0).
- Candidate pools: prompt19_2_candidate_pools.jsonl (50 per query) and the blinded variant for
  reviewer-facing evaluation.

## 3. Required metrics and acceptance thresholds (documented and justified)

| Metric | Threshold | Justification |
|--------|-----------|---------------|
| Recall@10 | >= 0.90 (legally reviewed exact-authority) | Legal retrieval must surface the controlling authority |
| exact-provision hit | >= 0.85 (where structured metadata exists) | Provision lane must hit the right article/part/point |
| inactive-law leakage | = 0 (current scope) | Zero-tolerance: surfacing repealed law as current is unsafe |
| citation metadata corruption | = 0 | Trusted metadata must remain intact |
| injection success | = 0 | Adversarial injection must never succeed (see Phase 4) |
| no-answer precision | >= 0.90 | Avoid over-refusal while refusing unsupported claims |
| p95 latency | below product timeout budget | Avoid user-facing search failure (8s edge budget / 60s RPC) |

Additional measured metrics (no fixed threshold until baseline run): Recall@5, MRR@10, nDCG@10,
exact-document hit, citation-anchor accuracy, duplicate rate, irrelevant-query rejection, timeout
rate, fallback rate.

## 4. Result separation (mandatory)

Results are split by: language (HY/RU/EN/FR), query type, status scope (current/extended/historical),
content domain (knowledge_base/practice), exact identifier vs semantic, and legally reviewed vs
engineering-only. Engineering and legal-reviewed results are NEVER averaged into one score. No
engineering-only result is promoted to a legal-quality PASS.

## 5. Honest limits

- Historical engineering-eval numbers exist in AUDIT_REPORTS/artifacts/prompt19_2_*.json. Per the
  non-negotiable rule, stale reports are NOT treated as current PASS and are NOT transcribed here as
  live metrics.
- The frozen gold is ENGINEERING gold (legal review incomplete: 0 reviewers, 0 adjudicated). Even
  after a live run, retrieval quality would be ENGINEERING-confirmed only; legal-quality PASS
  requires the legal-review gate.
- ECHR English/French semantic coverage is sparse; typo and irrelevant-query rejection sets are thin
  (see 03_EVALUATION_DATASET_MANIFEST.md gaps). These narrow confidence even after a live run.

## 6. Next action to close this gate

1. Provide READ_ONLY DB credentials (production avmgtsonawtzebvazgcr) and a reachable
   EMBEDDING_ENDPOINT for query embeddings.
2. Run scripts/run_rag_eval.ts against prompt19_2_gold_dev.jsonl (train/dev), then run the frozen
   test set ONCE after any repair.
3. Do NOT tune against the blind test set. Use train/dev only for any repair; rerun blind once.
4. Split results by the dimensions above; compare to thresholds; record metrics in 06_RETRIEVAL_METRICS.json.
5. Do not deploy or cut over. Search cutover remains OFF.
