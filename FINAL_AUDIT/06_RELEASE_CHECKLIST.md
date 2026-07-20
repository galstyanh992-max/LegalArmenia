# 06 — Release Checklist

Program verdict (see 00, the single program-level FINAL_VERDICT): BLOCKED_LEGAL_REVIEW. The program is not releasable until all program
co-blockers below are closed. No item is classified as a non-blocking risk where evidence is
missing; missing mandatory evidence is a blocker.

## Current application scope (security + core app)
- [x] Production security hardening applied (ledger 52; PR-A/B/C/F).
- [x] Live security advisors: zero ERROR / P0 / P1. (CURRENT_PRODUCTION_SECURITY_STATUS = NO_OPEN_P0_OR_P1_FOUND.)
- [x] Role isolation: caller-scoped RLS + green contract tests.
- [x] Automated CI green on merged head (Vitest, Deno, Vercel build). (AUTOMATED_CI_STATUS = PASS; LIVE_SECURITY_CATALOG_STATUS = PASS.)
- [x] Case CRUD verified live (auto-updatable view path). (PHASE_1_STATUS = PHASE_PASS.)
- [ ] Live HTTP role-matrix replay (interactive) — BLOCKED_INCOMPLETE_E2E_EVIDENCE (INTERACTIVE_E2E_STATUS = NOT_EXECUTED).
- [ ] UI/mobile/accessibility acceptance (interactive) — BLOCKED_INCOMPLETE_E2E_EVIDENCE (MOBILE_ACCESSIBILITY_STATUS = NOT_EXECUTED).
- [ ] Storage negative HTTP tests (interactive) — BLOCKED_INCOMPLETE_E2E_EVIDENCE.
- [ ] Live provider-failure matrix (interactive) — BLOCKED_INCOMPLETE_E2E_EVIDENCE.

## Legal AI search cutover (SEPARATE — do NOT enable now)
- [ ] Citation-injection gate reaches PASS (currently INCOMPLETE).
- [ ] Legal-expert review complete (currently BLOCKED_EXTERNAL_LEGAL_REVIEW).
- [ ] Retrieval evaluation (Recall@k/MRR/nDCG/citation accuracy/latency) executed and acceptable (currently INCOMPLETE).
- [ ] Metric-coverage gap (162,209 chunks) closed or accepted.
- [ ] V3 primary/shadow enablement explicitly authorized.
- Gate: keep V3 primary + shadow OFF until all above are checked. (SEARCH_CUTOVER = DISABLED.)

## Secret rotation
- [ ] Rotate ACTIVE_ROTATION_REQUIRED keys (operator, interactive) — FINAL_04 order. (SECRET_ROTATION_EXECUTION = NOT_PERFORMED; OLD_SECRET_REVOCATION_VERIFIED = NO; FINAL_SECRET_ROTATION_STATUS = BLOCKED_EXTERNAL_CREDENTIAL_REQUIRED.)

## Production change control
- No production/staging change without an explicit authorization gate stating the exact approved
  action. Implementation PRs are not auto-merged.
