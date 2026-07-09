# Browser QA + UI/UX + Business-Logic Audit — LegalArmenia
Date: 2026-07-09 (Asia/Yerevan)
Build under test: READY_FOR_BETA (dev server http://localhost:8082, live Supabase project avmgtsonawtzebvazgcr)
Method: Headless Chrome (puppeteer-core) automation + static code audit. No code changes made.
Raw evidence: AUDIT_REPORTS/qa-raw-report.json, qa-raw-report2.json, qa-shots/*.png

Coverage legend: CONFIRMED (observed in browser/code) | UNKNOWN | NOT_RUN | NOT_AVAILABLE

---

## 1. Browser QA Report

### Routes (all loaded, HTTP 200 at SPA shell; client routing then applied)

| Route | Status | Final URL | Notes |
|---|---|---|---|
| `/` | 200 | `/landing` | CONFIRMED redirect via `<Navigate to="/dashboard">` then ProtectedRoute → /landing |
| `/landing` | 200 | `/landing` | Public. 0 console errors on clean load (CONFIRMED). |
| `/login` | 200 | `/login` | Public. Form renders (email + password). |
| `/register` | 200 | `/register` | Public. Form renders (fullName, email, password, confirmPassword). |
| `/admin/login` | 200 | `/admin/login` | Public. Form renders (username + password). |
| `/not-a-real-route` | 200 (SPA) | `/not-a-real-route` | NotFound renders. 1 expected console error: `404 Error: User attempted to access non-existent route` (from NotFound.tsx useEffect) — benign. |
| `/dashboard` | 200 | `/landing` | CONFIRMED protected → /landing redirect when unauthenticated. |
| `/calendar` | 200 | `/landing` | CONFIRMED redirect. |
| `/cases/test-id` | 200 | `/landing` | CONFIRMED redirect. |
| `/transcriptions` | 200 | `/landing` | CONFIRMED redirect. |
| `/kb` | 200 | `/landing` | CONFIRMED redirect. |
| `/kb/test-id` | 200 | `/landing` | CONFIRMED redirect. |
| `/admin` | 200 | `/admin/login` | CONFIRMED admin-protected → /admin/login redirect. |
| `/my-documents` | 200 | `/landing` | CONFIRMED redirect. |

### Console / page / network errors
- pageErrors (uncaught JS exceptions): 0 across all routes. CONFIRMED.
- networkErrors (requestfailed): 0. CONFIRMED.
- console errors: 9 total — 1 benign NotFound 404 log + 8 from the explicit unauthenticated edge-function probe (expected 401s). Landing page itself emits 0 console errors. CONFIRMED.
- failedRequests (HTTP >= 400): 8, all from the unauth edge-function probe, all 401 with structured JSON `{"code":"UNAUTHORIZED_NO_AUTH_HEADER","message":"Missing authorization header"}`. No 5xx. CONFIRMED.

### Edge Function browser-facing calls (unauthenticated probe)
| Function | Status | Body |
|---|---|---|
| legal-chat | 401 | `UNAUTHORIZED_NO_AUTH_HEADER` |
| kb-search | 401 | `UNAUTHORIZED_NO_AUTH_HEADER` |
| dictionary-search | 401 | `UNAUTHORIZED_NO_AUTH_HEADER` |
| generate-complaint | 401 | `UNAUTHORIZED_NO_AUTH_HEADER` |
| ai-analyze | 401 | `UNAUTHORIZED_NO_AUTH_HEADER` |
| audio-transcribe | 401 | `UNAUTHORIZED_NO_AUTH_HEADER` |
| ocr-process | 401 | `UNAUTHORIZED_NO_AUTH_HEADER` |
| admin-create-user | 401 | `UNAUTHORIZED_NO_AUTH_HEADER` |
All gated. No auth bypass, no 5xx, no stack/info leak. CONFIRMED.

### Auth/admin/user flows
- Login (bad creds): CONFIRMED. Stays on `/login`, radix toast renders with title `Login failed` / description `Invalid login credentials`. Error state functional.
- Register validation: CONFIRMED. Empty submit → `Full name is required`, `Invalid email address`, `Password must be at least 6 characters`. Mismatched passwords → `Passwords don't match` on confirmPassword field.
- Admin login: form renders (username + password). Username resolved to `<username>@app.internal` candidates via `getSignInCandidates` (src/lib/auth.ts). Full authenticated admin flow NOT_RUN (no test admin credentials; would create real accounts in live project).
- Authenticated dashboard/calendar/cases/kb/admin panel UI: NOT_FULLY_VERIFIED via browser (no test session). Static audit only — see sections 2–4.

---

## 2. UI Closure Report

CONFIRMED:
- Public pages (landing, login, register, admin/login) render without JS errors and with valid semantic structure (H1 present on landing, form labels present).
- Login + Register forms have labels, placeholders, autocomplete attributes, loading spinner on submit (Loader2), disabled-while-submitting.
- Landing has ThemeToggle + LanguageSwitcher controls (2 interactive buttons present).
- Landing logo image loads (naturalW 1024). No broken images.
- NotFound has H1 `404`, message, and return-home link.
- Loading state: ProtectedRoute shows spinner during auth check; lazy pages show `PageLoader` spinner with `role=status` + sr-only text (accessible).
- CaseForm submit button shows pending state (`createCase.isPending || updateCase.isPending`).

ISSUES (CONFIRMED via code/static):
- UI-1 [Low/Medium]: Landing page uses decorative gradient blur orbs (`bg-primary/5 blur-3xl` circles) as background decoration — deviates from the project UI guideline "Do not add discrete orbs, gradient orbs, or bokeh blobs as decoration or backgrounds." src/pages/Index.tsx.
- UI-2 [Medium]: Knowledge Base browsing tab is effectively empty by design. useKnowledgeBase `kb-list` queryFn returns `{ items: [], total: 0, totalPages: 0 }` unconditionally (src/hooks/useKnowledgeBase.ts:163-175). Users opening `/kb` without a search query will always see the empty state. This is a roadmap mismatch for a core advertised feature ("Правовая база знаний" H3 on landing).
- UI-3 [Low]: Landing is sparse — only 5 links, 3 feature cards, no product/preview imagery beyond the logo. No hero media. Acceptable for beta but below the "brand/product must be a first-viewport signal" guidance for a product page.
- UI-4 [Cosmetic]: Login toast description surfaces the raw Supabase message (`Invalid login credentials`) — generic, acceptable; but the code comment says "Show the actual message to help debug" (src/pages/Login.tsx) which can leak signal like `Email not confirmed` in some states.

UNKNOWN / NOT_FULLY_VERIFIED:
- Authenticated dashboard layout, modals (CaseForm, ComplaintWizard, DocumentGeneratorDialog, NotesPanel, DictionarySearch, StandaloneAIAnalysis, StandaloneMultiAgent, TelegramSettings/Uploads), CaseDetail, Calendar, AudioTranscriptions, MyDocuments, AdminPanel tabs — not exercised in-browser.

---

## 3. UX Closure Report

CONFIRMED:
- Auth redirect behavior is correct and consistent: unauthenticated users hitting protected routes are sent to `/landing` (or `/admin/login` for admin). Redirect target preserves `state.from`.
- Sign-out listener in ProtectedRoute navigates to login on `SIGNED_OUT` event.
- Form validation is inline (zod + react-hook-form), messages render under fields.
- Network-error vs invalid-credentials is distinguished in auth handlers (regex on `load failed|failed to fetch|network|timeout|connection terminated`) and produces a distinct connection-lost toast.
- Landing is responsive (sm/lg breakpoints, motion-staggered hero).

ISSUES:
- UX-1 [Medium]: No error state for failed `cases` query on the Dashboard. Dashboard only branches on `isLoading` and `cases.length === 0`; if the query errors, `cases` is `undefined` and `cases.length` throws (TypeError) — the Cases tab would crash instead of showing an error/retry UI. (src/pages/Dashboard.tsx:529-572; src/hooks/useCases.ts returns `data` with no `[]` fallback, no `isError` surfaced.) CONFIRMED via code.
- UX-2 [Medium]: KB tab shows a permanent empty state when no search term is entered (see UI-2). No browse/list affordance — users have no way to discover documents without typing a query.
- UX-3 [Low]: Login page label text appears as raw source literals (Armenian) rather than via `t()` in some labels (e.g. `Email`/`Password` labels are inline literals, not i18n keys) — i18n coverage is partial on auth pages. Code-level observation.

NOT_FULLY_VERIFIED: Empty/loading/error states for cases detail, calendar, transcriptions, my-documents, admin tabs.

---

## 4. Business Logic Closure Report

CONFIRMED:
- Auth: `useAuth` correctly uses Supabase `getSession` + `onAuthStateChange`; roles loaded from `user_roles` table; `hasRole` gates ProtectedRoute. AdminPanel performs a second `checkAdmin()` verification beyond route guard (defense-in-depth).
- Admin login maps `username` → `<username>@app.internal` email candidates and tries each against `signInWithPassword`. Works for the internal-domain admin account model.
- Edge function `admin-create-user` verifies the caller is admin via `hasUserRole(userClient, currentUser.id, "admin")` before creating users with the service-role key. Non-admin callers get 401/403. CONFIRMED.
- Case search uses `escapeLikePattern` to neutralize `%`/`_`/`\` in `ilike` patterns (prevents LIKE-injection). CONFIRMED (src/hooks/useCases.ts).
- Case insert has duplicate-`case_number` retry with suffix appending (max 10 attempts). CONFIRMED.
- File upload enforces `MAX_UPLOAD_SIZE = 50MB` client-side, skipping oversized files. CONFIRMED.
- Edge functions use a fail-closed perimeter (`edge-security.ts`): browser mode requires Origin allowlist; internal mode requires `x-internal-key`; CORS wildcard only when `ENV != production`. CONFIRMED via code.
- Legal AI system prompt is jurisdiction-locked to RA, with anti-injection (`prompt-armor.ts`) and PII redaction (`pii-redactor.ts`). CONFIRMED via code.

ISSUES:
- BL-1 [Medium]: Client queries against `cases` do not scope by `user.id`/role — they rely entirely on database RLS for visibility (src/hooks/useCases.ts). This is acceptable IF RLS policies are correct, but the client provides no defense-in-depth. Combined with UX-1 (no error handling), an RLS denial or network blip crashes the Cases tab rather than degrading gracefully. CONFIRMED via code.
- BL-2 [Medium]: KB legacy write/read paths are explicitly disabled (`legacyRetrievalUnsupported()` thrown in createDocument/updateDocument/deleteDocument in useKnowledgeBase). Admin KB management via the UI will throw "legacy retrieval unsupported" — the admin Knowledge Base tab is non-functional for writes until the documents/search_chunks mapping is completed. CONFIRMED via code; matches README note.
- BL-3 [Low]: `signUp` in useAuth passes `full_name` as user metadata but no role assignment is performed client-side after signup (role assignment requires an admin/trigger). A freshly registered user has no `user_roles` row → `hasRole` returns false for all roles → they cannot access any protected route (all require a role) and get bounced to `/landing`. Registration → login flow will fail for self-service users unless a DB trigger or admin assigns a role. UNKNOWN whether such a trigger exists in the live DB (NOT verified). This is a potential beta-blocking business-logic gap.

NOT_FULLY_VERIFIED: Complaint generation, document generation, OCR, audio transcription, calendar reminders, multi-agent analysis end-to-end flows (require authenticated session + AI provider keys).

---

## 5. Security Regression Check

CONFIRMED (positive):
- All 8 probed edge functions reject unauthenticated calls with 401 + structured JSON. No 5xx, no stack trace leak.
- `admin-create-user` enforces admin role server-side before using service-role key.
- Edge security layer is fail-closed (CORS allowlist, internal-key gating, wildcard only in non-prod).
- Case search neutralizes LIKE wildcards.
- Service role key is never exposed to the browser (only `VITE_SUPABASE_ANON_KEY` is client-facing; service key stays server-side in edge functions). .env confirms VITE_ prefix only on URL + anon key.
- tsc --noEmit: 0 errors. Build succeeds.

ISSUES / WATCHPOINTS:
- SEC-1 [Low]: Login toast can surface raw Supabase auth error messages (src/pages/Login.tsx `message` fallback) — minor information signal (e.g. `Email not confirmed`). Not a credential leak but a mild oracle.
- SEC-2 [Medium, depends on DB]: BL-1/BL-3 — security of case visibility and post-registration role assignment depends entirely on DB-side RLS + triggers that were NOT verifiable from the browser. NOT_CONFIRMED safe. Recommend explicit RLS smoke test against live DB before any production verdict.
- SEC-3 [Info]: `.env` contains `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_ACCESS_TOKEN` in plaintext on disk. Acceptable for local dev; must NOT be present in any deployed/packaged artifact or repo. NOT verifiable from browser.

---

## 6. Performance Observations

- Production build (`npm run build`): succeeds in ~8s, PWA generated (79 precache entries, 11.6 MB precache). CONFIRMED.
- Bundle chunks (gzip):
  - AdminPanel 766 kB / 130 kB gzip (lazy)
  - pdf-render 599 kB / 176 kB gzip (lazy)
  - editor-icons 389 kB / 122 kB gzip (lazy)
  - calendar-date 386 kB / 116 kB gzip (lazy)
  - charts 381 kB / 97 kB gzip (lazy)
  - NotesBubble 277 kB / 66 kB gzip (lazy)
  - react-vendor 275 kB / 89 kB gzip
  - index 199 kB / 56 kB gzip
- Vite warns: chunks > 600 kB (AdminPanel, pdf-render). Heavy but code-split/lazy. First authenticated load (Dashboard ~67 kB + react-vendor + index + supabase) is reasonable.
- React Query: staleTime 5 min, retry 1, refetchOnWindowFocus false — sane defaults.
- PWA runtime caching: NetworkFirst with 5s timeout for Supabase REST/functions. Reasonable.
- tsc clean, lint: 0 errors / 36866 warnings (all `custom/no-non-ascii-literals` from intentional Armenian/Russian i18n strings — not actionable).

PERF-1 [Low]: AdminPanel chunk is large for an admin-only route; acceptable since lazy-loaded and admin-only. Could split admin sub-tabs further.

---

## 7. Confirmed Findings Table

| ID | Severity | Area | Finding | Evidence |
|---|---|---|---|---|
| BL-3 / SEC-2 | Medium (potential beta blocker) | Business logic / Security | Self-registered users may get no `user_roles` row → cannot access any protected route. Depends on a DB trigger NOT verified. | src/hooks/useAuth.ts signUp; useAuth.hasRole; ProtectedRoute. NOT verified against live DB. |
| BL-1 / UX-1 | Medium | Business logic / UX | Cases query has no client-side scoping and no error-state UI; on query failure `cases` is undefined → Cases tab crashes. | src/hooks/useCases.ts (no `[]` fallback, no isError), src/pages/Dashboard.tsx:529-572. |
| UI-2 / UX-2 / BL-2 | Medium | UI / UX / Business logic | KB browsing tab always empty (list queryFn returns `[]`); KB admin writes disabled (`legacyRetrievalUnsupported`). Core advertised feature non-functional in this build. | src/hooks/useKnowledgeBase.ts:163-175, 185-233. |
| UI-1 | Low | UI | Landing uses gradient blur orbs as decoration, against project UI guideline. | src/pages/Index.tsx (blur-3xl circles). |
| SEC-1 / UI-4 | Low | Security / UI | Login toast surfaces raw Supabase auth error text (mild oracle). | src/pages/Login.tsx. |
| UX-3 | Low | UX | Auth-page labels partially bypass i18n (inline literals). | src/pages/Login.tsx, Register.tsx, AdminLogin.tsx. |
| PERF-1 | Low | Performance | AdminPanel chunk 766 kB (130 kB gzip). | `npm run build` output. |
| UI-3 | Low | UI | Landing lacks product/hero media; sparse for a product page. | src/pages/Index.tsx. |

Positive CONFIRMED (no issue): public routing, auth redirects, edge-function auth gating, admin role enforcement server-side, LIKE-injection mitigation, build/lint/tsc pass, no uncaught JS errors, no broken images, no network failures, form validation works, login error toast works, fail-closed edge security.

---

## 8. Production Readiness Verdict

### Verdict: READY_FOR_BETA

Rationale:
- Public surface (landing, login, register, admin/login, 404) is clean: no JS exceptions, no console errors, no broken assets, working validation and error toasts.
- Auth gating works end-to-end for unauthenticated users (correct redirects to /landing and /admin/login).
- All probed edge functions are fail-closed (401, structured errors, no 5xx, no leak). Admin endpoints enforce role server-side.
- Production build succeeds; tsc + lint pass with 0 errors.
- No evidence of safety regressions on the browser-facing perimeter.

Blocking concerns for any higher verdict (READY_FOR_LIMITED_PRODUCTION / READY_FOR_PRODUCTION):
1. BL-3 / SEC-2: post-registration role assignment is unverified against the live DB — self-service registration may produce users who can log in but access nothing. Must be confirmed via a real sign-up → role check on the live project.
2. BL-1 / UX-1: Cases tab has no error state and will crash on query failure (undefined `cases.length`). Needs a guard + error UI before limited production.
3. UI-2 / BL-2: Knowledge Base browsing is non-functional (always empty) and admin KB writes are disabled — a core advertised feature. Acceptable for beta with a known limitation, not for production.
4. Authenticated flows (dashboard, cases detail, calendar, transcriptions, documents, admin panel tabs, complaint/document generation, OCR, audio) were NOT exercised in-browser in this audit (no test session). They must be run through with real accounts before any production verdict.

Evidence basis: Browser automation (puppeteer-core, headless Chrome) on dev server :8082 + static code/edge-function audit. No code was modified. Sections marked NOT_FULLY_VERIFIED / UNKNOWN above were not covered and must be closed out before escalating the verdict.
