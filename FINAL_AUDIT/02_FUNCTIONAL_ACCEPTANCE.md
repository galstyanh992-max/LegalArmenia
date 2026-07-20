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

## REQUIRES_INTERACTIVE_VERIFICATION (non-blocking, not fabricated)
- Live HTTP role-matrix replay with ephemeral client/lawyer/admin users on staging.
- Storage negative tests (forbidden extension, oversized, invalid MIME, cross-case path).
- Live provider-failure / timeout / rate-limit matrix for AI edge functions.
- UI + mobile layout across 320/360/390/430/tablet/desktop/large; Armenian text rendering.
- Accessibility (keyboard nav, focus, ARIA, contrast, heading hierarchy, modal focus trap).

## Blocking functional defects: NONE identified.
Verdict: PHASE_PASS_WITH_NON_BLOCKING_RISKS (automated + live-security scope).
