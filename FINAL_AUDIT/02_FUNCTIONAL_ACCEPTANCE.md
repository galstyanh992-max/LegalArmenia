# 02 — Functional Acceptance

## Automated gates (reproducible CI on merged head → main)
- Edge Function Tests (Deno) = pass
- Frontend / Utility Tests (Vitest) = pass
- Vercel production build = pass
Authoritative signal = green GitHub Actions on the exact merged commit. Local re-run not performed.

## Verified live / structurally
- Case CRUD path works in production via auto-updatable `public.cases` view (FINAL_01); real
  well-formed case row present; created_by/status defaults applied.
- Role isolation encoded in contract tests (green) + caller-scoped RLS (live).
- Edge function inventory present and service-role-guarded where required (record_ai_metric etc.).

## Interactive acceptance (mandatory, not executed)
- Live HTTP role-matrix replay with ephemeral client/lawyer/admin users on staging.
- Storage negative tests (forbidden extension, oversized, invalid MIME, cross-case path).
- Live provider-failure / timeout / rate-limit matrix for AI edge functions.
- UI + mobile layout across 320/360/390/430/tablet/desktop/large; Armenian text rendering.
- Accessibility (keyboard nav, focus, ARIA, contrast, heading hierarchy, modal focus trap).

## Phase 2 status
- AUTOMATED_CI_STATUS = PASS (Edge Deno, Vitest, Vercel build green on merged head).
- LIVE_SECURITY_CATALOG_STATUS = PASS (zero ERROR / P0 / P1; caller-scoped RLS + green contract tests).
- INTERACTIVE_E2E_STATUS = NOT_EXECUTED (live HTTP matrices, storage negative tests, provider-failure matrix not run).
- MOBILE_ACCESSIBILITY_STATUS = NOT_EXECUTED (UI/mobile/accessibility not run).
- Mandatory interactive acceptance is not classified PASS and is not a non-blocking risk.
- **PHASE_2_STATUS = BLOCKED_INCOMPLETE_EVIDENCE.**
