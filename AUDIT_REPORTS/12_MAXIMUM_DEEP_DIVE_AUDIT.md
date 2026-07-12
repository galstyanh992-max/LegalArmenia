# WAVE 1 & 2 — MAXIMUM DEEP DIVE AUDIT REPORT

Prompt A — Independent read-only audit
Date: 2026-07-12
Auditor role: Principal Architect / Supabase-RLS Auditor / Backend-Edge Auditor / Frontend QA Lead / Security Engineer / AI-Legal-Tech Safety Auditor / Release Gatekeeper / Regression Hunter

## 1. Executive Summary

| Item | Status | Evidence |
| --- | --- | --- |
| Baseline commit | `d476cd8` | `git log --oneline -n 10` (below) |
| Code findings open (Wave 2 scope) | **0** | §5, §9 |
| CRITICAL/HIGH open (Wave 2 scope) | **0** | §9 |
| **Out-of-scope CRITICAL finding** | **1** (pre-existing, not Wave 2) | §7, §9 — hardcoded production DB password in `db_passwords.cjs` |
| Executable gates | **PASS** | §3 |
| DB/RLS/Storage behavior | **UNVERIFIED_DB** | §8 |
| Production touched | **NO** (by this audit; no writes, no migration apply, no deploy) | §3, §8 |
| Final audit verdict | **RETURN_TO_REPAIR_LOOP** (scoped: secret rotation) — Wave 2 itself is `READY_FOR_DISPOSABLE_SUPABASE_VERIFICATION` | §10 |

The Wave 2 pack (Prompts 06–10) itself has **zero open CRITICAL/HIGH code findings** and all executable gates pass, confirmed with fresh command runs against `d476cd8`, not just the prior implementation reports. However, this deep-dive audit's mandate (`git grep` over the full tree, not just the Wave 2 diff) surfaced a **pre-existing, unrelated CRITICAL secret exposure** — a live plaintext production database password committed in `db_passwords.cjs` since commit `09023b0` (2026-07-09), still present at HEAD. This finding predates and is outside Prompts 06–10's scope, but per the audit's hard rule ("do not claim PASS without evidence," "confirmed finding → RETURN_TO_REPAIR_LOOP") it cannot be omitted. It does **not** invalidate Wave 2's own closure claims, but it does block any claim that the repository as a whole is safe to treat as production-ready. See §7/§9 for detail and §10 for the split verdict rationale.

## 2. Sources Inspected

| Source | Inspected? | Evidence |
| --- | --- | --- |
| `git status` / `git log` / `git show --stat d476cd8` / `git diff 4894084..d476cd8 --stat` | YES | commands run, output captured below |
| `AUDIT_REPORTS/07–11*.md` | YES | read in full (this session authored them; re-verified against source, not trusted blindly) |
| `src/lib/uploadPolicies.ts`, `src/lib/caseFileUpload.ts` | YES | re-read, constants and helper re-verified |
| `src/components/cases/`, `src/components/audio/`, `src/components/complaints/` | YES | targeted re-verification of upload/cleanup paths |
| `src/hooks/useAuth.ts`, `src/hooks/useCases.ts`, `src/hooks/useCaseFiles.ts`, `src/hooks/useAudioTranscriptions.ts` | YES | re-read in this and prior turns |
| `src/pages/ForgotPassword.tsx`, `src/pages/ResetPassword.tsx`, `src/components/ProtectedRoute.tsx` | YES | authored and re-verified this session |
| `supabase/functions/ocr-process/index.ts`, `supabase/functions/audio-transcribe/index.ts`, `analysis.ts` | YES | re-read post-fix; caller-scoped download confirmed live in source |
| `supabase/functions/telegram-webhook/index.ts` | YES | full guard chain re-verified (§6) |
| `supabase/functions/extract-case-form-fields/index.ts` | YES | backend autofill contract re-verified |
| `supabase/functions/_tests/` | YES (attempted) | `deno test` — network-blocked locally; **CI evidence obtained instead** (job-level, not just workflow-level) |
| `supabase/migrations/` (61 files with `CREATE POLICY`, `handle_new_user` history) | YES | inventoried; latest `handle_new_user` definition located; no unique index on `audio_transcriptions.file_id` confirmed |
| `supabase/storage-policies/20260711_case_files_private_access.draft.sql` | YES | confirmed not applied; confirmed no real `USING (true)`/`TO public` grants (only a prohibitive comment) |
| Full-tree secret grep (`db_passwords.cjs` and 30 sibling root scripts) | YES | §7 |

### Raw baseline evidence

```
git log --oneline -n 10
d476cd8 Merge pull request #6 from galstyanh992-max/claude/case-upload-function-fix-lbn2sp
8472495 test(fix): mock SubtleCrypto.digest to avoid jsdom/Node 24 realm mismatch
95bd82f test(fix): make caseFileUpload File.arrayBuffer polyfill environment-independent
ba53d7b feat(wave2): auth recovery journey, storage hardening, idempotent transcription
4894084 fix(vercel): remove legacy secret references, add SPA fallback rewrite (#5)
...

git diff 4894084..d476cd8 --stat
 21 files changed, 1878 insertions(+), 65 deletions(-)
```

`git status --short` → clean working tree at `d476cd8` (no staged/unstaged/untracked deltas at audit time).

## 3. Quality Gates

| Gate | Result | Evidence |
| --- | --- | --- |
| Typecheck (`tsc --noEmit -p tsconfig.app.json`) | **PASS** | exit 0, no output |
| Lint (`npm run lint`, timeout-guarded 240s) | **PASS** | exit 0, `0 errors`, 41,483 pre-existing non-ASCII-literal warnings (unrelated custom style rule, not correctness) |
| Unit tests (`npm test -- --run`) | **PASS** | `Test Files 21 passed (21)` / `Tests 125 passed (125)` |
| Edge tests (`deno test supabase/functions/_tests/`) | **PASS (CI evidence)** / **BLOCKED_ENV (local)** | Local: network policy denies `deno.land`/`esm.sh` (`unsuccessful tunnel`). **CI**: fetched actual GitHub Actions job for run `29154925053` (workflow "Tests (Vitest + Deno)", triggered by the merge of `d476cd8` itself) — job `86550378086` "Edge Function Tests (Deno)": `status: completed`, `conclusion: success`, step "Run deno test -A --no-check supabase/functions/_tests/" completed successfully. This is job-level API evidence, not a self-report. |
| Build (`npm run build`) | **PASS** | `✓ built in ~3–4s`, PWA precache generated, no errors |
| `npm audit --audit-level=high` | **PASS** | `found 0 vulnerabilities` |
| Secret scan (path/type-only) | **PARTIAL** — Wave 2 diff clean; full-tree scan found 1 pre-existing CRITICAL (§7) | `git grep` run, no values printed in this report |
| `git diff --check` (whitespace) | **PASS (cosmetic only)** | 1 trailing-whitespace hit in `AUDIT_REPORTS/10_OCR_TRANSCRIPTION_PIPELINE.md` markdown table row — documentation formatting, not code |

No gate was reported PASS without a command actually being executed in this session. Where local execution was impossible (edge tests), the status is explicitly `BLOCKED_ENV` locally with CI substituted as evidence, per the rule "never claim PASS if not run."

## 4. Integration Chain Review

### Chain A — Auth → profile → role → protected route
- **Source files inspected**: `src/hooks/useAuth.ts`, `src/components/ProtectedRoute.tsx`, `src/pages/Login.tsx`, `src/pages/ForgotPassword.tsx`, `src/pages/ResetPassword.tsx`, `supabase/migrations/20260125032401_*.sql` (latest `handle_new_user`).
- **Code-level proof**: session restore via `getSession()` + `onAuthStateChange` (race-safe, `loading` gates both); role read from `user_roles` view (RLS-backed), never client-assigned; `handle_new_user` hardcodes `role='client'` server-side (SECURITY DEFINER); `ProtectedRoute` blocks on `isLoading = loading || rolesLoading` before redirect decisions; recovery session explicitly `signOut()`'d after password update (verified in `ResetPassword.tsx` source).
- **Test evidence**: `src/test/auth/auth.test.ts` (4) + `src/test/auth/password-recovery.test.tsx` (9) = 13/13 passing, part of the 125-test suite.
- **Runtime proof**: none (no live browser session against a deployed instance was exercised in this audit).
- **DB behavior proof**: none — trigger firing correctness, RLS on `user_roles`, and profile-row creation are asserted from migration source only.
- **Remaining unknowns**: `UNVERIFIED_DB` — trigger execution, RLS enforcement on `profiles`/`user_roles` reads.
- **Status**: code-level **PASS**; DB-behavioral **UNVERIFIED_DB**.

### Chain B — Case list → detail → membership → permitted mutation
- **Source files inspected**: `src/hooks/useCases.ts`, `src/pages/CaseDetail.tsx`, `src/hooks/useCases.test.tsx`.
- **Code-level proof**: `pickWritableCaseFields` allowlist strips `id`/`created_at`/`deleted_at` from insert/update payloads (re-verified present in source); `lawyer_id` defaults to `auth.getUser()` result, not client-supplied; RLS errors are thrown, not swallowed.
- **Test evidence**: `src/hooks/useCases.test.tsx` — 8/8 passing (empty list, access-denied, LIKE-escape, insert allowlist+actor-default, duplicate-key retry, RLS-denial rejection, update allowlist, unauthorized-edit propagation).
- **Runtime proof**: none.
- **DB behavior proof**: none — actual RLS enforcement (member vs non-member, lawyer vs client) is asserted from migration source and prior repair-loop reports only, not executed against a live/disposable instance in this session.
- **Remaining unknowns**: `UNVERIFIED_DB` — RLS role/action matrix (§8).
- **Status**: code-level **PASS**; DB-behavioral **UNVERIFIED_DB**.

### Chain C — Document metadata → Storage path → upload → processing job → OCR/transcription result
- **Source files inspected**: `src/lib/uploadPolicies.ts`, `src/lib/caseFileUpload.ts`, `src/components/complaints/useComplaintFiles.ts`, `src/pages/AudioTranscriptions.tsx`, `src/hooks/useAudioTranscriptions.ts`, `supabase/functions/ocr-process/index.ts`, `supabase/functions/audio-transcribe/index.ts` + `analysis.ts`, `supabase/functions/extract-case-form-fields/index.ts`, `supabase/functions/telegram-webhook/index.ts`.
- **Code-level proof** (all re-confirmed live in source this turn, not from report text alone):
  - `sanitizeStorageExtension` strips non-ASCII/traversal fragments from storage keys (root cause of the original production upload bug — grep-confirmed the function exists and is wired into `buildComplaintStoragePath` and the standalone-audio path).
  - `ocr-process` storage download now uses `sb` (caller-scoped client), confirmed via `grep -n "sb.storage" ocr-process/index.ts` → single match, no `supabase.storage` (service-role) download remains.
  - `audio-transcribe` idempotency: existing-row lookup via `sb` (caller-scoped) before insert — confirmed present in source.
  - `audio_transcriptions.file_id` has **no DB-level unique constraint** (confirmed by grep across all migrations touching that table) — this matches the honestly-reported `UNVERIFIED_DB` follow-up in report 10, not a regression; idempotency is enforced at the application layer only, pending a defense-in-depth unique index.
  - Complaint-OCR temp cleanup runs inside a `finally` block (confirmed).
  - Shared `uploadCaseFileWithMetadata` (SHA-256 + version + content-type) is reused identically by `useCaseFiles.ts`, `useAudioTranscriptions.ts`, and `AudioTranscriptions.tsx` (confirmed via grep — 3 call sites, 1 implementation).
  - Autofill: backend (`extract-case-form-fields`) independently re-enforces path-prefix, MIME, and 15MB — not trusting client-side validation alone (confirmed).
  - Telegram: 20MB pre-download (`file_size` metadata check) **and** post-download (`fileBuffer.byteLength`) checks both present; MIME allowlist; chat-scoped rate limit; service-role key read only inside the edge function, never in `src/` (0 hits, confirmed this session and in Wave 2 audit).
- **Test evidence**: `src/lib/storagePaths.test.ts` (9), `src/lib/caseFileUpload.test.ts` (3), `src/test/edge/audio-analysis.test.ts` (9) — all passing.
- **Runtime proof**: none for live provider calls (explicitly prohibited); CI confirms the Deno edge suite (including the storage-adjacent parts it covers) executes successfully in a real Deno runtime.
- **DB behavior proof**: none for actual Storage object-policy enforcement.
- **Remaining unknowns**: `UNVERIFIED_DB` — Storage object-policy matrix, `audio_transcriptions.file_id` unique-index recommendation still open.
- **Status**: code-level **PASS**; DB-behavioral **UNVERIFIED_DB**.

### Chain D — Unauthorized actor → UI attempt → client request → expected server/RLS rejection
- **Source files inspected**: same as Chain C, plus draft storage policy.
- **Code-level proof**: the one confirmed code-level bypass in this lineage (service-role storage read on a user-supplied path in `ocr-process`) has been **removed** — re-verified in source, not just trusted from the report. No other service-role usage was found reachable from an unauthenticated or under-scoped code path in the Wave 2 diff or its immediate call graph.
- **Test evidence**: none of the 125 unit tests exercise actual RLS denial against a database — they mock the Supabase client and assert the *client-side* handling of a simulated denial (e.g., `useCases.test.tsx`'s RLS-denial rejection test verifies the error propagates, not that the server actually denies it).
- **Runtime/DB proof**: **none** — this chain is explicitly the one the pack itself, and this audit, mark as requiring a disposable environment.
- **Status**: code-level **PASS** (no known bypass); behavioral **UNVERIFIED_DB** (unchanged from report 11's own honest classification — this audit found no reason to upgrade or downgrade that classification).

## 5. Closed Finding Verification

| Finding | Previous Severity | Closure Evidence (re-verified this turn) | Regression Risk | Status |
| --- | --- | --- | --- | --- |
| W12-001 non-idempotent transcription persistence | HIGH | `audio-transcribe/index.ts`: existing-row lookup via caller-scoped `sb` client before insert, confirmed present in current source | None found — `audio_transcriptions.file_id` still lacks a DB unique index (pre-existing gap, correctly flagged `UNVERIFIED_DB`, not silently dropped) | **CLOSED** (app-level fix confirmed live; DB-level defense-in-depth remains an open, disclosed follow-up) |
| W12-002 service-role storage read on user path (ocr-process) | CRITICAL | `grep -n "sb.storage" ocr-process/index.ts` → 1 match at the download call; no `supabase.storage` (service-role) download remains in the storage-URL branch | None found | **CLOSED** |
| W12-003 raw user-controlled storage-key extension | HIGH | `sanitizeStorageExtension`/`buildComplaintStoragePath` present in `uploadPolicies.ts`; wired into `useComplaintFiles.ts` and `AudioTranscriptions.tsx` (both confirmed via grep) | None found | **CLOSED** |
| W12-004 missing password-recovery journey | MEDIUM | `ForgotPassword.tsx`/`ResetPassword.tsx` exist, routed in `App.tsx`, 13 passing tests cover request/callback/expired/success/failure states | None found | **CLOSED** |
| CI-1/CI-2 Vitest CI Node 24 WebCrypto realm mismatch | CI | `caseFileUpload.test.ts` now mocks `crypto.subtle.digest` directly (verified via source read); CI job `86550378072` "Frontend / Utility Tests (Vitest)" for the exact merge commit `d476cd8` shows `conclusion: success` | None found | **CLOSED** |

No new regressions were introduced by any of the five closures — each fix narrowed or added a check; none broadened an authorization boundary, and none reintroduced a previously-removed unsafe pattern.

## 6. Upload / OCR / Audio / Telegram Audit

| Area | Expected | Evidence | Status | Risk |
| --- | --- | --- | --- | --- |
| Autofill | PDF/JPG/PNG/TIFF only, 15MB, strict backend reject, no binary UTF-8 decode, temp cleanup | `uploadPolicies.ts` constants match; `extract-case-form-fields/index.ts` independently re-enforces path/MIME/size server-side; `CaseForm.tsx` temp-path cleanup via `autofillTempPathsRef` (verified in Prompt 06/07 review, re-confirmed path prefix `userId/autofill/` unchanged) | **PASS** | LOW |
| PDF OCR | 15MB UI/backend, caller-scoped download, signed URL branch, storage/DB rollback, OCR save failure fatal | `ocr-process`: `sb.storage` caller-scoped confirmed; dedicated `sign/` branch confirmed present; `CasePdfUpload.tsx` upload→sign→invoke flow unchanged from prior review; failed OCR throws (fatal), not silently swallowed | **PASS** | LOW |
| Audio | MP3/WAV/M4A/OGG only, 25MB, M4A normalized, idempotent persistence, rollback on signed URL/transcription/DB failure | Constants match; `AUDIO_EXT_BY_MIME` map confirmed (MIME-derived extension, not filename-derived); idempotent replay confirmed in source; `rollbackCaseFile` imported and used in both `useAudioTranscriptions.ts` and `AudioTranscriptions.tsx` | **PASS** | LOW |
| Complaint OCR | temp cleanup in `finally` | Confirmed: `finally { if (tempStoragePath) { ...remove... } }` present at `useComplaintFiles.ts:104-108` | **PASS** | LOW |
| Shared upload helper | SHA-256/version/content-type helper across paths | `uploadCaseFileWithMetadata` single implementation, 3 confirmed call sites, no duplicated/divergent logic found | **PASS** | LOW |
| Telegram | MIME allowlist, 20MB pre/post-download checks, chat rate limit, service-role write guarded | All four confirmed present in `telegram-webhook/index.ts` (line-cited above); service-role key never reachable from `src/` (0 hits) | **PASS** | LOW |

## 7. Security / Privacy Review

| Check | Result | Evidence | Severity |
| --- | --- | --- | --- |
| No secret values printed in this report | PASS | Redacted per hard rule | — |
| No service-role key in client (`src/`) | PASS | `grep -rn "SERVICE_ROLE" src/` → 0 hits | — |
| No PII/document content logging (Wave 2 diff) | PASS | `console.*` additions in the diff carry only IDs/counts/booleans, no transcription or document text | — |
| service-role usage server-only | PASS (Wave 2 scope) | All `SERVICE_ROLE_KEY` reads are inside `supabase/functions/*` edge code | — |
| **Hardcoded production DB credential in tracked file** | **FAIL** | `db_passwords.cjs` (tracked since `09023b0`, present at HEAD): a plaintext `postgresql://postgres:<password>@db.avmgtsonawtzebvazgcr.supabase.co` connection string. This is the **same project** used as "production" throughout this engagement. Anyone with repo/history read access can connect directly as the `postgres` superuser-adjacent role, bypassing all RLS. **Value not reproduced in this report.** | **CRITICAL** |
| Other root-level scratch scripts (`check_*.js/cjs`, `reset_users*`, `update_passwords.*`, `fix_*.js`, `query_db.cjs`, `create_users_only.cjs`, `delete_db_users.js`) | PASS (no hardcoded values) | All confirmed to read `env.SUPABASE_SERVICE_ROLE_KEY` / `env.DATABASE_URL` from `.env` at runtime, not hardcoded (spot-checked every file, see raw grep output) | — (hygiene concern: unused debug/ops scripts committed at repo root; not a secret leak) |
| Local-dev-only credential (`fix_app_profiles.js`) | INFORMATIONAL | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` — this is the well-known, non-secret default local Supabase CLI password, loopback-only | LOW (not a real credential) |

**This finding is out of Wave 2's scope** (not touched by Prompts 06–10, not introduced or modified in the `4894084..d476cd8` diff) but is a genuine, currently-exploitable CRITICAL issue in the audited tree that the audit's full-tree secret-scan mandate requires surfacing.

## 8. DB/RLS/Storage Blocker Review

| Blocker | Evidence Available? | Status | Required Next Step |
| --- | --- | --- | --- |
| RLS role/action matrix | Migration source only (61 files with `CREATE POLICY`) | **UNVERIFIED_DB** | Disposable Supabase environment (Prompt B) |
| Storage object-policy matrix | Draft policy source only, not applied | **UNVERIFIED_DB** | Disposable Supabase environment (Prompt B) |
| `audio_transcriptions.file_id` unique index | Confirmed **absent** from all migrations (grep, no `UNIQUE` on that column) | **UNVERIFIED_DB / CONFIRMED GAP** (app-level idempotency compensates, but the DB-level defense-in-depth is a real, disclosed, non-blocking gap) | Add a migration (not applied here) + verify in disposable env |
| Authorization migration + rollback behavior | Source only | **UNVERIFIED_DB** | Disposable Supabase environment (Prompt B) |
| `handle_new_user` trigger | Source only (latest definition located and read) | **UNVERIFIED_DB** | Disposable Supabase environment (Prompt B) |
| Chain D behavioral denial | Code-level bypass removed (confirmed); actual denial unverified | **UNVERIFIED_DB** | Disposable Supabase environment (Prompt B) |

No disposable-environment absence was used to justify a blanket PASS or FAIL on the code-level implementation — each row above is independently classified.

## 9. Confirmed New Findings

| ID | Severity | Area | Problem | Evidence | Required Fix |
| --- | --- | --- | --- | --- | --- |
| DEEP-001 | **CRITICAL** | Repository secret hygiene (out of Wave 2 scope) | Live plaintext production Postgres password committed and present at HEAD in `db_passwords.cjs` | `git log --diff-filter=A` shows introduction at `09023b0`; `git show HEAD:db_passwords.cjs` confirms present at audited commit; value redacted per audit rules | Rotate the Postgres password in Supabase dashboard immediately; remove the file from the working tree; evaluate git-history scrubbing given the value has been committed since 2026-07-09 |
| DEEP-002 | LOW (informational) | Repo hygiene | ~19 ad hoc root-level Node scripts (`check_*`, `reset_users*`, `update_*`, `fix_*`, `query_db.cjs`, `scratch.js`, `test_*.js`) committed at repo root, most reading `SUPABASE_SERVICE_ROLE_KEY` from `.env` | `git ls-files` inventory, each spot-checked for hardcoded values (none found beyond DEEP-001) | Non-blocking; consider relocating to a `scripts/` or `tools/` directory excluded from production deploy artifacts, for cleanliness only |
| DEEP-003 | LOW (cosmetic) | Documentation | Trailing whitespace in one markdown table row, `AUDIT_REPORTS/10_OCR_TRANSCRIPTION_PIPELINE.md:67` | `git diff --check` | Non-blocking; optional whitespace trim |

No CRITICAL or HIGH findings were confirmed **within Wave 2's own scope** (Prompts 06–10, diff `4894084..d476cd8`).

## 10. Verdict

**`RETURN_TO_REPAIR_LOOP`** — scoped strictly to **DEEP-001** (the pre-existing hardcoded production DB password), which is a confirmed CRITICAL finding per the audit's own hard rule ("if a confirmed finding is discovered, return RETURN_TO_REPAIR_LOOP").

Split rationale (both statements are true and non-contradictory):
- **Wave 2 (Prompts 06–10) in isolation**: zero open CRITICAL/HIGH findings, all executable gates PASS with fresh evidence including independent CI job-level confirmation → this slice is `READY_FOR_DISPOSABLE_SUPABASE_VERIFICATION`.
- **Repository as a whole at `d476cd8`**: contains one pre-existing, unrelated, currently-exploitable CRITICAL secret exposure that this audit's mandated full-tree scan surfaced → overall verdict cannot be a clean `READY_FOR_DISPOSABLE_SUPABASE_VERIFICATION` without acknowledging and routing DEEP-001.

DEEP-001 has **no owning prompt** in the Wave 1/2 routing table (it predates Prompts 01–10 and touches no file any of them modified). It is not a Wave-2 regression and does not reopen W12-001–004 or CI-1/2. It is reported here because the audit prompt explicitly mandates a full-tree secret scan, not a diff-scoped one, and because silently omitting a live credential leak would violate "do not claim PASS without evidence" by implication (a repo-wide PASS would be false).

## 11. Handoff

Per Prompt A's own routing rule, `RETURN_TO_REPAIR_LOOP` findings route to repair, not directly to Prompt B. However, DEEP-001 is a **credential-rotation and file-removal action**, not a code-repair-loop item in the Wave 06–10 sense — there is no "owning prompt" to hand it to. Recommended handling:

1. **User/operator action (not code)**: rotate the Supabase Postgres password now; this cannot be done by an automated repair prompt since it requires dashboard access and coordinating any scripts/tools that depend on the old value.
2. **Trivial follow-up code action** (safe to route to a repair prompt once the password is rotated): delete `db_passwords.cjs` from the tree (and optionally the other root-level debug scripts per DEEP-002).
3. Once DEEP-001 is remediated (rotated + file removed), **Wave 2 itself remains `READY_FOR_DISPOSABLE_SUPABASE_VERIFICATION`** and Prompt B may proceed on that basis — Prompt B's own disposable-environment safety gate is unaffected by DEEP-001 since Prompt B never targets or reads `db_passwords.cjs`.

No production writes, no migration apply, and no deploy were performed during this audit.
