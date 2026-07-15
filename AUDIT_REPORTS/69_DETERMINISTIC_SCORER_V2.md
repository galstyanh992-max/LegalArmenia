# 69 — Deterministic scorer V2

V2 combines the frozen V1 legal-feature score with independently logged identifier, specificity, authority, official-source, status/temporal, duplication and instruction-like signals. Per-document cap is 2; exact-text and same-provision duplicates collapse deterministically.

Weights were calibrated on train/dev and frozen before test. Frozen test was not used for selection. Ablations are neutral for most new features because the shadow export has no trusted provision/authority/version fields; this is a metadata blocker.

Runtime reports `reranker_mode=deterministic`, never loads or calls GTE/BGE/custom rerankers, and keeps Qwen excluded.

Evidence: `artifacts/prompt19_4_scorer_config.json`, `artifacts/prompt19_4_feature_ablation.json`.
