# FINAL_02 — End-to-End Acceptance

Base: origin/main = ad20a27. Mode: read-only + CI evidence. Date: 2026-07-20.

## 2.1 Repository quality gates (reproducible CI on merged head)
GitHub Actions on the merged head (PR #21 → main) — reproducible, not static inspection:
- Edge Function Tests (Deno) = **pass** (`deno test -A --no-check supabase/functions/_tests/`)
- Frontend / Utility Tests (Vitest) = **pass** (`vitest run`)
- Vercel production build = **pass** (`vite build`, deployment completed)
- Vercel Preview Comments = pass

Scripts present (package.json): build=`vite build`, lint=`eslint .`, test=`vitest run`,
test:edge=`deno test -A --no-check supabase/functions/_tests/`, test:all=test+test:edge.
Local re-run of build/lint/typecheck was NOT performed in this session; the authoritative
signal is the green CI on the exact merged commit. Re-running locally is the exact-next-action
if an offline reproduction is required.

## 2.2 Authorization / role-isolation (live, read-only)
Security advisors (production, live) — **zero ERROR-level findings**. Highlights:
- No RLS-missing ERROR; 8 INFO `rls_enabled_no_policy` on legal-corpus ingestion tables
  (legal_document_metadata, legal_document_versions, legal_metadata_failures,
  legal_metadata_reconstruction_runs, legal_metadata_review_actions, legal_provisions,
  legal_source_files, legal_source_page_mappings) → RLS enabled + no policy = deny-by-default
  to anon/authenticated (safe; service-role/owner only). Non-blocking hardening/doc item.
- WARN `function_search_path_mutable` (4): app.prevent_legal_decision_data_update,
  app.save_legal_decision_atomic, public.set_updated_at, public.case_files_object_case_id.
  Outside the PR-D 17-routine scope. Defense-in-depth P3; non-blocking.
- WARN `rls_policy_always_true`: public.error_logs INSERT WITH CHECK (true) for authenticated.
  Low-risk (log sink); non-blocking hardening.
- WARN `extension_in_public` (vector, pg_trgm): standard Supabase; non-blocking.
- WARN `anon/authenticated_security_definer_function_executable`: the app.* case helpers,
  public.get_my_role, search_legal_* and get_ai_metrics_summary — already dispositioned SAFE in
  PR-D (caller-scoped via auth.uid(), admin-gated, or open public-corpus read). Non-blocking.
- WARN `auth_leaked_password_protection` disabled → enable HaveIBeenPwned check (hardening).

Schema CREATE privileges (live): has_schema_privilege('anon'|'authenticated', s, 'CREATE') =
false for app, auth, extensions, internal, public — API roles cannot create shadowing objects.

Automated role matrix: the committed contract tests
(`supabase/functions/_shared/authorization-matrix.local.test.ts`,
`storage-matrix.local.test.ts`, `authorization-contract.test.ts`) encode client/lawyer/admin
/service-role isolation and cross-tenant denial, and pass under the Deno CI gate above.

## 2.3 Case-management flows
- Case CRUD path verified structurally + live (see FINAL_01): create/read/update/delete route
  through the auto-updatable `public.cases` view to `app.cases`; RLS policies reference
  app.can_read_case / can_manage_case / is_case_lawyer / get_my_role (caller-scoped by auth.uid()).
- IDOR / cross-tenant: covered by the authorization-matrix contract tests (green in CI). A fresh
  live HTTP replay with ephemeral client/lawyer/admin users on staging was NOT executed in this
  session (requires provisioning test users + keys) → REQUIRES_INTERACTIVE_VERIFICATION for an
  independent live re-proof, but the automated matrix is green.

## 2.4 Storage flows
- Storage RLS uses app.check_case_upload_access(case_files_object_case_id(name)) and
  app.can_read_case/can_manage_case (caller-scoped). Bucket constraints enforced by migration
  20260712120008. Structural review + storage-matrix contract test (CI green).
- Live upload/oversized/MIME/cross-case negative HTTP tests: REQUIRES_INTERACTIVE_VERIFICATION.

## 2.5 AI / Edge Function flows
- Edge functions present: legal-chat, ai-analyze, multi-agent-analyze, generate-complaint,
  generate-document, ocr-process, audio-transcribe, extract-case-fields, kb-search,
  kb-search-assistant, kb-unified-search, vector-search, and _shared workers.
- record_ai_metric is service-role-only (fail-closed JWT guard) — verified live. Metric writes
  come only from service-role edge functions (PR-A call-site evidence).
- Provider-failure / timeout / malformed-input / rate-limit paths: covered by unit/contract
  tests in CI; a live paid-provider exercise was intentionally NOT run (cost + secrets).
  REQUIRES_INTERACTIVE_VERIFICATION for a full live provider-failure matrix.

## 2.6 / 2.7 UI, mobile, accessibility
- NOT executed in this non-interactive session. Rendering across 320/360/390/430/tablet/desktop
  viewports, overflow/clipping, Armenian text rendering, keyboard nav, focus, ARIA and contrast
  require an interactive browser session with authenticated users.
- Status: **REQUIRES_INTERACTIVE_VERIFICATION** (not asserted PASS; not a proven blocker).

## Phase 2 verdict
- Blocking defects found: **none** (build green, auth/role isolation green in CI + live security
  advisors show zero ERROR; core case flow verified live).
- Not fully verifiable here (no fabrication): live HTTP role-matrix replay, storage negative
  tests, live provider-failure matrix, and UI/mobile/accessibility acceptance.
- **PHASE VERDICT: PHASE_PASS_WITH_NON_BLOCKING_RISKS** (loop count: 1) for the automated and
  live-security scope; UI/mobile/accessibility and live HTTP matrices remain
  REQUIRES_INTERACTIVE_VERIFICATION and are carried as non-blocking open items in FINAL_AUDIT/05.
