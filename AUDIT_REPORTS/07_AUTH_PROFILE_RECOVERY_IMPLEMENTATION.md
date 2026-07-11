# 07 — AUTH, PROFILE AND PASSWORD RECOVERY IMPLEMENTATION

Prompt 06/20 — Wave 2 — Fullstack Authentication Implementer
Date: 2026-07-11
Branch: `claude/case-upload-function-fix-lbn2sp` (content == merged `main`, commit 4894084)

## DECISION: `AUTH_JOURNEY_IMPLEMENTED`

---

## 1. Baseline

| Item | State |
| --- | --- |
| Git status at start | clean working tree |
| Auth routes | `/login`, `/register`, `/admin/login`, guarded routes via `ProtectedRoute` |
| Recovery routes | **absent** (no request page, no callback page, no `resetPasswordForEmail` anywhere in `src/`) |
| Existing tests | `src/test/auth/auth.test.ts` (4 helper tests) |
| Typecheck / unit / build | PASS / 89/89 / PASS |
| Edge tests | ENV-BLOCKED: network policy denies `deno.land` / `esm.sh` (CONNECT 403), cannot execute in this environment |

Baseline divergence from pack contract: "Authorization tests: 5/5" — locally the auth test file contains 4 tests; reports `02–06` referenced as input artifacts do not exist under `AUDIT_REPORTS/` (repository uses a different report naming history). Neither blocks this prompt.

## 2. State model (as verified in source)

| State | Source representation |
| --- | --- |
| `AUTH_LOADING` | `useAuth().loading === true` (before `getSession()` resolves) |
| `ANONYMOUS` | `user === null && !loading` |
| `AUTHENTICATED_PROFILE_LOADING` | `user != null`, profile query pending (`profile === undefined`) |
| `AUTHENTICATED_PROFILE_READY` | `profile` is a row |
| `AUTHENTICATED_PROFILE_MISSING` | `profile === null` (PGRST116 mapped to null in `useAuth.ts:80`) |
| `RECOVERY_SESSION` | `ResetPassword` page `phase === 'ready'` (new) |
| `AUTH_ERROR` | profile/roles query error → roles fallback `[]`, profile query throw (retry 1) |

Profile absence is **not** conflated with session absence: `profile` is `undefined` (loading) / `null` (missing) while `user` independently tracks the session.

## 3. Session restore — findings

* Race initial `getSession()` vs `onAuthStateChange`: both setters idempotent; listener also receives `INITIAL_SESSION`. No flicker of `ANONYMOUS` before restore because `loading` stays `true` until either resolves. **PASS**
* Duplicate profile fetch: profile/roles are React-Query cached by `['profile', user.id]` / `['user-roles', user.id]` — deduped across the many `useAuth()` call sites. **PASS** (note: each `useAuth()` instance registers its own `onAuthStateChange` listener — inefficiency, not a correctness bug; left untouched per minimal-fix contract)
* Stale role state after sign-out: query keys include `user?.id`; after sign-out the key becomes `['user-roles', undefined]` with `enabled:false` → `roles` falls back to `[]`. Additionally `useAuth` invalidates both query families on session loss (`useAuth.ts:56-59`). **PASS**
* Redirect before profile loaded: `ProtectedRoute` blocks on `isLoading = loading || rolesLoading` and renders a spinner (`role="status"`). **PASS**
* Infinite loading on profile query error: query has `retry: 1`; `ProtectedRoute` does not depend on profile, only on roles (which fall back to `[]` on error → deterministic redirect rather than spinner). **PASS**

## 4. Profile bootstrap

Bootstrap is server-side only: trigger `on_auth_user_created → public.handle_new_user()` (SECURITY DEFINER, `search_path=public`) inserts `profiles` + fixed `user_roles('client')`.

* Privileged role from browser payload: **not possible** — trigger hardcodes `client`; `signUp` sends only `full_name` metadata (`useAuth.ts:117-130`); Register page passes no role.
* Duplicates / overwrite: trigger fires only on `auth.users` INSERT; client never inserts profiles.
* Authorization failure masking: profile query surfaces errors except PGRST116.

No client-side bootstrap path was added (none needed — confirmed backend contract exists). **Not BLOCKED.**

## 5. Recovery flow — implemented in this prompt

New files:

* `src/pages/ForgotPassword.tsx` — request form. Zod email validation (form is `noValidate` so zod, not the browser bubble, is authoritative); `supabase.auth.resetPasswordForEmail(email, { redirectTo: origin + '/reset-password' })`; **generic confirmation** regardless of account existence (anti-enumeration); generic destructive toast on API error (no enumeration leak); tokens never touched.
* `src/pages/ResetPassword.tsx` — callback + password update. Explicit phases: `checking` → `ready | invalid | expired` → `success`.
  * URL error params (`error`, `error_code=otp_expired`) → `expired`/`invalid` states with a "request new link" action.
  * Recovery session detection: `getSession()` + `onAuthStateChange` (`PASSWORD_RECOVERY`/`SIGNED_IN`/`INITIAL_SESSION`), bounded 8s window when a token is present in the URL, immediate `invalid` when none is.
  * Password form: zod min-8 + confirmation match.
  * `supabase.auth.updateUser({ password })`; on success the recovery session is **signed out** (not left elevated) and the user is redirected to `/login` (`replace: true`).
  * Recovery tokens are never read, logged, or persisted by page code (only boolean presence checks on the URL).
* `src/App.tsx` — public routes `/forgot-password`, `/reset-password` (lazy, same Suspense pattern as siblings).
* `src/pages/Login.tsx` — "Մոռացե՞լ եք գաղտնաբառը" link.

Note on scope: many accounts use synthetic `@app.internal` addresses (username login). E-mail recovery is inherently undeliverable for them; the existing admin path (`admin-reset-password` edge function) remains their recovery channel. The page intentionally keeps the generic confirmation for such addresses.

## 6. Tests

New `src/test/auth/password-recovery.test.tsx` (9 tests, fireEvent-based — `@testing-library/user-event` is not a project dependency):

| Case | Result |
| --- | --- |
| invalid email → validation shown, API not called | PASS |
| valid request → `resetPasswordForEmail` with `redirectTo=/reset-password`, generic confirmation | PASS |
| API error → stays on form, no enumeration | PASS |
| no session & no token → invalid-link state | PASS |
| `otp_expired` in URL → expired state | PASS |
| recovery session → password form rendered | PASS |
| min-length & mismatch validation, no `updateUser` call | PASS |
| successful update → `updateUser`, `signOut`, redirect to `/login` | PASS |
| failed update → form kept, **no** sign-out | PASS |

Pre-existing coverage kept: session-restore/redirect behavior asserted indirectly by `getAuthRedirectPath` tests; privileged redirect does not trust client-only role — `ProtectedRoute` requires DB-backed `user_roles` rows (RLS-guarded), and AdminLogin re-verifies via `checkAdmin()` DB query.

## 7. Local repair loop log

| Cycle | Confirmed failure | Minimal fix | Verification |
| --- | --- | --- | --- |
| 1 | test import `@testing-library/user-event` unresolved (dep not installed) | rewrite tests to `fireEvent` (no dependency change) | targeted run: 12/13 |
| 2 | invalid-email zod message never rendered: native `type="email"` constraint validation blocks the submit event before RHF/zod runs | add `noValidate` to ForgotPassword form | targeted run: 13/13 |

Micro audit after each fix: only allowed paths touched (`src/pages`, `src/App.tsx`, `src/test`), no suppressions added (`git diff` contains zero `@ts-ignore`/`as any`), authorization boundary untouched, no invented DB objects, production untouched, no secrets in diff.

## 8. Verification

| Gate | Result |
| --- | --- |
| Targeted auth tests (`src/test/auth/`) | 13/13 PASS |
| Full unit suite | **98/98 PASS** (89 baseline + 9 new) |
| Typecheck (`tsc -p tsconfig.app.json`) | PASS |
| Production build | PASS |
| Real password reset against production | NOT performed (prohibited) |

## 9. Exit criteria

* Auth state machine deterministic — ✔
* No infinite loading — ✔ (bounded 8s recovery window; roles error → `[]` fallback)
* Sign-out clears sensitive state — ✔ (key-scoped queries + invalidation; recovery session explicitly signed out)
* Recovery has success and failure states — ✔
* Client does not assign roles — ✔ (server trigger, fixed `client` role)
* Tests / typecheck / build — ✔

**DECISION: `AUTH_JOURNEY_IMPLEMENTED`**
