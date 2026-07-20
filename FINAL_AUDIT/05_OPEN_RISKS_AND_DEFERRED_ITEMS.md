# 05 — Open Risks & Deferred Items

Program verdict (see 00, the single program-level FINAL_VERDICT): BLOCKED_LEGAL_REVIEW. This file lists the program co-blockers and the
non-blocking hardening items. Program co-blockers are not classified as non-blocking risks.

Format: [ID] item — severity — evidence — owner — next action — prod impact — rollback — release-blocking?

## Program co-blockers (program verdict, see 00)
- [R1] Legal-expert review of retrieval/citations — BLOCKER(program, search cutover) — FINAL_03 §3.6 — external legal reviewer — run review package — search cutover only — n/a — YES. Co-blocker: BLOCKED_RAG_CITATION_GATE / LEGAL_REVIEW_GATE = BLOCKED_EXTERNAL_LEGAL_REVIEW.
- [R2] Citation-injection gate INCOMPLETE — BLOCKER(program, search cutover) — FINAL_03 §3.5 — RAG eng — build+run adversarial harness to PASS — search cutover only — n/a — YES. Co-blocker: BLOCKED_RAG_CITATION_GATE / CITATION_INJECTION_GATE = INCOMPLETE; RETRIEVAL_EVALUATION = INCOMPLETE.
- [D1] Secret rotation execution NOT_PERFORMED — BLOCKER(program) — FINAL_04 — operator with provider access — dependency-ordered rotation + revocation — all consumers — rotation rollback — YES. Co-blocker: BLOCKED_SECRET_ROTATION; OLD_SECRET_REVOCATION_VERIFIED = NO.
- [V1] Live HTTP role-matrix replay · [V2] storage negative tests · [V3] live provider-failure matrix · [V4] UI/mobile across 7 viewports · [V5] accessibility — BLOCKER(program, Phase 2) — FINAL_02 §2.3–2.7 — interactive QA — run interactive acceptance — current app — n/a — YES. Co-blocker: BLOCKED_INCOMPLETE_E2E_EVIDENCE / INTERACTIVE_E2E_STATUS = NOT_EXECUTED, MOBILE_ACCESSIBILITY_STATUS = NOT_EXECUTED, PHASE_2_STATUS = BLOCKED_INCOMPLETE_EVIDENCE.

## Non-blocking hardening (current deployed scope)
- [R3] Metric-only coverage gap: 162,209 chunks (~11%) lack a metric embedding — MEDIUM — FINAL_03 §3.2 — RAG eng — targeted (authorized) re-embed of the gap set — affects search recall only — re-embed reversible — NO. (METRIC_ONLY_COVERAGE_GAP = 162209; also a search-cutover blocker, but not a current-app blocker.)
- [R4] 4 functions with mutable search_path (app.prevent_legal_decision_data_update, app.save_legal_decision_atomic, public.set_updated_at, public.case_files_object_case_id) — LOW/P3 — live advisor — DB owner — set explicit search_path in a future hardening migration (authorized) — defense-in-depth — migration rollback — NO.
- [R5] error_logs INSERT WITH CHECK(true) for authenticated — LOW — live advisor — DB owner — scope the policy — log-sink integrity only — policy rollback — NO.
- [R6] 8 RLS-enabled-no-policy corpus tables — INFO — live advisor — DB owner — add explicit service-role policy or document deny-by-default intent — none (already deny) — n/a — NO.
- [R7] leaked-password protection disabled — LOW — live advisor — Auth admin — enable HIBP — auth hardening — toggle — NO.
- [R8] extensions vector/pg_trgm in public schema — LOW — live advisor — DB owner — relocate in a planned migration — none — migration rollback — NO.
- [R9] cases_compat_insert trigger drift (prod trigger absent; staging present; bodies differ) — LOW/compat — FINAL_01 — DB owner — separate external-compatibility review; align staging OR document intended prod auto-update path — none (prod works via auto-update) — n/a — NO. (CASES_COMPAT_INSERT_FUNCTION_STATUS = DORMANT_NOT_PROVEN_REQUIRED; do not restore trigger; do not drop function.)

## Deferred / not authorized here
- [D2] Any production/staging DB write — requires explicit production authorization gate.
