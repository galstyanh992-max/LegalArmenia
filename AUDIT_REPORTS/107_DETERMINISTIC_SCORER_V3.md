# 107 — Deterministic scorer V3

V3 remains deterministic and Metric-only. It adds exact citation, trusted metadata confidence, specificity/authority, sanitized ranking text, instruction penalty, historical eligibility, and deterministic duplicate collapse. Status/effective-date guards are outside the weighted score.

No cross-encoder, Qwen, re-embedding, user-route change, or production deployment was introduced. Frozen ablations are neutral where trusted fields have zero coverage; adversarial trusted-boundary ablation is non-neutral.

Evidence: `supabase/functions/_shared/deterministic-search-v3.ts`, `artifacts/prompt19_6_scorer_v3_config.json`, `artifacts/prompt19_6_feature_ablation.json`.
