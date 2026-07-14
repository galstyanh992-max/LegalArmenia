# 46 — Deterministic legal scorer

## Contract

Stage D records 35 independent finite features: Metric/ANN/FTS/identifier/RRF signals; title, document, article, part, point, subpoint, case, date, phrase and canonical-key matches; domain, type, authority, jurisdiction, source, version and status signals; quality, completeness and diversity penalties.

`status_eligibility`, `effective_date_validity`, and `norm_status_signal` are observable but forced to weight zero. Status and temporal validity remain hard guards. Final diversity enforces one result per duplicate group, a three-result document cap, and source diversity preference.

## Train/dev selection

- Train/dev answerable queries: 153/51; pairwise training pairs: 3,180.
- Selection used train/dev only; test tuning: false.
- Selected post-training ablation: retrieval feature group. All retrieval features remain recorded but have zero final weight because this engineering dev set ranked better without them.
- Train: MRR 0.8389, nDCG@10 0.8569, Recall@10 0.9346.
- Dev: MRR 0.8814, nDCG@10 0.9038, Recall@10 0.9804.

This zero-weight retrieval outcome is not treated as a production truth. It may reflect engineering-label construction bias and is a blocker pending lawyer-reviewed judgments.

## Frozen test D

Recall@10 0.9608; MRR 0.8743; nDCG@10 0.9027; citation-document accuracy 0.8431; current-law contamination 0; no-answer hallucination 0; no-answer false-negative rate 0.0196. Unknown warning precision/recall is 1/1; repealed warning precision/recall is 1/0.75. Adversarial ranking succeeds on 1/2 test cases; duplicate ranking quality is 1.0.

Full weights, trials and ablations are in `prompt19_2_legal_scorer_training.json`. D is a strong engineering baseline but fails citation, repealed-warning, adversarial-ranking, cross-tenant-measurement and legal-review gates.
