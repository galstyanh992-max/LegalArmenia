# 106 — Injection-safe representation

V3 separates immutable `display_text` from sanitized `ranking_text`. Armenian, Russian, and English manipulation patterns are masked and scored. Legal imperatives remain unchanged unless AI/system/rank/prompt context exists.

Adversarial data: 280 cases (240 attacks, 40 controls). Injection ranking 1.00; attack success 0; detection recall 1.00; imperative false-positive rate 0; forged-feature block 1.00. Removing trusted-metadata restrictions raises attack success to 0.2083.

Evidence: `supabase/functions/_shared/injection-sanitizer.ts`, `artifacts/prompt19_6_injection_dataset.jsonl`, `artifacts/prompt19_6_adversarial_metrics.json`.
