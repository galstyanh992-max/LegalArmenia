# 06 — Release Checklist

## Current application scope (security + core app)
- [x] Production security hardening applied (ledger 52; PR-A/B/C/F).
- [x] Live security advisors: zero ERROR / P0 / P1.
- [x] Role isolation: caller-scoped RLS + green contract tests.
- [x] CI green on merged head (Vitest, Deno, Vercel build).
- [x] Case CRUD verified live (auto-updatable view path).
- [ ] Live HTTP role-matrix replay (interactive) — recommended before formal sign-off.
- [ ] UI/mobile/accessibility acceptance (interactive) — recommended before formal sign-off.

## Legal AI search cutover (SEPARATE — do NOT enable now)
- [ ] Citation-injection gate = PASS.
- [ ] Legal-expert review complete.
- [ ] Retrieval evaluation (Recall@k/MRR/nDCG/citation accuracy/latency) executed and acceptable.
- [ ] Metric-coverage gap (162,209 chunks) closed or accepted.
- [ ] V3 primary/shadow enablement explicitly authorized.
- Gate: keep V3 primary + shadow OFF until all above are checked.

## Secret rotation
- [ ] Rotate ACTIVE_ROTATION_REQUIRED keys (operator, interactive) — FINAL_04 order.

## Production change control
- No production/staging change without an explicit authorization gate stating the exact approved
  action. Implementation PRs are not auto-merged.
