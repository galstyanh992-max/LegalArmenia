# 11 — WAVE 1–2 INTEGRATION AUDIT AND MASTER REPAIR LOOP

Prompt 10/20 — Wave 1–2 Verification Gate — Independent Integration Auditor
Date: 2026-07-11
Branch: `claude/case-upload-function-fix-lbn2sp`

## VERDICT: `BLOCKED_DISPOSABLE_ENVIRONMENT`

All code-level gates PASS with zero open CRITICAL/HIGH code findings. The only
outstanding items are behavioral RLS / Storage-policy / migration matrices that
cannot be executed without a disposable Supabase environment (none available in
this session; production must not be used as a test bed).

---

## STEP 1 — Repository baseline

* Branch: `claude/case-upload-function-fix-lbn2sp` (== merged `main`, base commit `4894084`).
* No `reset` / `restore` / `stash` / `clean` performed.
* Modified (7): `src/App.tsx`, `src/pages/Login.tsx`, `src/pages/AudioTranscriptions.tsx`, `src/lib/uploadPolicies.ts`, `src/components/complaints/useComplaintFiles.ts`, `supabase/functions/ocr-process/index.ts`, `supabase/functions/audio-transcribe/index.ts`.
* Added: 5 pages/modules (`ForgotPassword.tsx`, `ResetPassword.tsx`, `analysis.ts`), 4 test files, 1 draft policy, 4 reports (07–11).
* No unrelated user changes were present to preserve.

## STEP 2 — Fresh-context source review

Re-read (not just reports): `useAuth.ts`, `ProtectedRoute.tsx`, `App.tsx`, recovery pages, `handle_new_user` trigger, `useCases.ts`, `useCaseFiles.ts`, `caseFileUpload.ts`, `uploadPolicies.ts`, `useComplaintFiles.ts`, `AudioTranscriptions.tsx`, both edge functions, `types.ts`, local migrations.

## STEP 3 — Security invariants (all confirmed absent / correct)

| Invariant | Result |
| --- | --- |
| New secret indicators in diff | NONE (only a `service_role` mention inside a policy comment) |
| `as any` / blanket casts added | NONE (`as never` only in tests, intentional) |
| Unjustified suppressions | NONE (`@ts-*`/`eslint-disable`: 0 in diff) |
| Browser service-role usage | NONE (0 in `src/`) |
| Client-controlled privileged role | NONE (role fixed server-side in trigger; the one `p_role` grep hit is a generated RPC type) |
| Public URLs for private files | NONE (`getPublicUrl`: 0) |
| Foreign Storage path construction | REMOVED (ocr-process now caller-scoped download) |
| Unbounded retries | NONE (client ≤2; no `while(true)`) |
| Raw sensitive content logging | NONE |
| Fake provider behavior | NONE (no provider calls added; `UNKNOWN` where unconfirmed) |

## STEP 4 — Integration chains

### Chain A — Auth session → profile → role → protected route: **PASS (code-level)**
Session restored via `getSession()`+`onAuthStateChange`; role from RLS-guarded `user_roles` (client cannot assign); `ProtectedRoute` blocks on `isLoading`, redirects deterministically; recovery session explicitly signed out post-update.

### Chain B — Case list → detail → membership → permitted mutation: **PASS (code-level)**
List loading/empty/error/denied states present; mutations use a writable-column allowlist and default `lawyer_id` to the actor; RLS errors surfaced, not swallowed. Server-side membership enforcement = `UNVERIFIED_DB`.

### Chain C — Document metadata → Storage path → upload → processing job → result: **PASS (code-level)**
Deterministic generated keys (no raw filename); metadata-insert failure removes the orphan object; transcription persistence is now idempotent (existing-row replay); `needs_review` gates AI output.

### Chain D — Unauthorized actor → UI → client request → server/RLS rejection: **code-level PASS, behavioral `UNVERIFIED_DB`**
No code-level bypass exists (the previous service-role read primitive in ocr-process was removed). The actual RLS denials require a disposable environment to assert.

## FINDINGS LEDGER

### W12-001 — Non-idempotent transcription persistence
- Severity: HIGH · Status: CONFIRMED → FIXED
- Evidence: `audio_transcriptions.file_id` not unique + client retry → duplicate rows
- Owning Prompt: 09 · Paths: `supabase/functions/audio-transcribe/index.ts`
- Fix: existing-row lookup (caller-scoped) before insert; idempotent replay
- Regression gate: full unit suite + esbuild bundle · Production blocker: NO (recommend a unique index as `UNVERIFIED_DB` follow-up)

### W12-002 — Service-role storage read on user-supplied path (ocr-process)
- Severity: CRITICAL · Status: CONFIRMED → FIXED
- Evidence: service-role `download(bucket,path)` from parsed user URL
- Owning Prompt: 08 · Paths: `supabase/functions/ocr-process/index.ts`
- Fix: caller-scoped download; dedicated signed-URL branch; query-string stripped
- Regression gate: esbuild bundle + unit suite · Production blocker: was YES → resolved (edge not yet redeployed — deploy is out of scope here)

### W12-003 — Raw user-controlled storage-key extension (complaint & standalone audio)
- Severity: HIGH (availability) · Status: CONFIRMED → FIXED
- Evidence: `file.name.split('.').pop()` → InvalidKey 400 for non-ASCII
- Owning Prompt: 08 · Paths: `uploadPolicies.ts`, `useComplaintFiles.ts`, `AudioTranscriptions.tsx`
- Fix: `sanitizeStorageExtension` + MIME-derived audio extension
- Regression gate: `storagePaths.test.ts` · Production blocker: NO

### W12-004 — Missing password-recovery journey
- Severity: MEDIUM (feature gap) · Status: CONFIRMED → FIXED
- Owning Prompt: 06 · Paths: `ForgotPassword.tsx`, `ResetPassword.tsx`, `App.tsx`, `Login.tsx`
- Fix: request/callback/update/expired states; anti-enumeration; recovery session signed out
- Regression gate: `password-recovery.test.tsx` · Production blocker: NO

## STEP 5 — Quality gates

| Gate | Result |
| --- | --- |
| Typecheck (`tsc -p tsconfig.app.json`) | **PASS** |
| No new suppressions | **PASS** (0 in diff) |
| Lint (`npm run lint`, timeout-guarded, exit preserved) | **PASS** (exit 0, 0 errors; 41,483 pre-existing non-ASCII style warnings) |
| Unit tests | **PASS** (125/125) |
| Edge tests (`deno test`) | **UNVERIFIED / ENV-BLOCKED** (network policy denies deno.land/esm.sh; pure `analysis.ts` covered under vitest instead) |
| Authorization tests | **PASS** (auth suite 13/13 incl. recovery) |
| Build | **PASS** |
| Auth chain | **PASS** |
| Case chain | **PASS** |
| Storage code | **PASS** |
| OCR/transcription code | **PASS** |
| RLS behavioral matrix | **UNVERIFIED_DB** |
| Storage policy matrix | **UNVERIFIED_DB** |
| Secret scan | **PASS** (path/label-only; no live secrets in diff) |
| Production unchanged | **PASS** (no DB writes, no migration apply, no deploy) |
| Open CRITICAL code findings | **0** |
| Open HIGH code findings | **0** |

## DISPOSABLE ENVIRONMENT CLASSIFICATION (`UNVERIFIED_DB_BLOCKER`)

* RLS role/action matrix (cases, case_files, audio_transcriptions)
* Storage object-policy matrix (`case-files`, `telegram-uploads`)
* `audio_transcriptions.file_id` unique-index behavior (idempotency belt-and-suspenders)
* Authorization migration + rollback behavior
* `handle_new_user` trigger behavior
* service-role vs authenticated storage-download behavior (Chain D denial)

## FINAL REGRESSION (post-findings)

typecheck PASS · lint exit 0 · unit 125/125 · build PASS · secret scan PASS · git diff/status audit clean (only intended paths). Edge `deno test` remains ENV-BLOCKED.

## Verdict rationale

`WAVE_1_2_VERIFIED` is withheld only because Edge behavioral tests and the RLS/Storage matrices cannot be executed here. Every executable code-level gate passes with no open CRITICAL/HIGH findings, DB-dependent assertions are explicitly isolated, and production is untouched — satisfying `BLOCKED_DISPOSABLE_ENVIRONMENT`.

## Prompt 11 resume point

Provision a disposable Supabase environment; apply local migrations + `supabase/storage-policies/20260711_case_files_private_access.draft.sql`; execute the RLS/Storage behavioral matrices (Prompt 08 §6, Prompt 09 §3) and `deno test supabase/functions/_tests/`; then re-run Prompt 10 STEP 5 to close the `UNVERIFIED_DB` gates and reach `WAVE_1_2_VERIFIED`.
