# 08 — CASE WORKFLOW IMPLEMENTATION

Prompt 07/20 — Wave 2 — Repository Case-Workflow Implementer
Date: 2026-07-11
Branch: `claude/case-upload-function-fix-lbn2sp`

## DECISION: `CORE_CASE_JOURNEY_READY`

---

## 1. Contract inventory

| UI consumer | DB object (public schema) | Kind | Notes |
| --- | --- | --- | --- |
| `useCases` / Dashboard / CaseDetail | `cases` | security-invoker view over `app` | writable via INSTEAD OF triggers (existing) |
| `useCaseFiles` / CaseTimeline / FileNotes | `case_files` | view over `app.client_documents` | metadata only here; binary flow → Prompt 08 |
| membership | `cases.lawyer_id` / `cases.client_id` (+ `case_members` view, read contract) | view | no UI writes to `case_members`; RLS behavior `UNVERIFIED_DB` |
| profiles/roles | `profiles`, `user_roles` | views | covered in Prompt 06 |

`app`/`public` are not mixed in the browser: all client queries go through `public` views only (verified by grep — no `schema('app')` usage in `src/`).

## 2. Task ledger

| Journey transition | Paths | Status | Test | Remaining blocker |
| --- | --- | --- | --- | --- |
| list → loading/empty/error/access-denied | `src/pages/Dashboard.tsx:504-577`, `src/hooks/useCases.ts` | PASS (pre-existing) | `useCases.test.tsx` (empty, error) | — |
| list search (LIKE injection) | `useCases.ts:22-24` | PASS (pre-existing escape) | escaping test | — |
| create → detail | `useCases.ts:101-152`, `CaseForm.tsx` | PASS | defaults + strip test | — |
| duplicate submit prevention | `Dashboard.tsx:625` (`isPending` → submit disabled), unique `case_number` retry | PASS | duplicate-key retry test | — |
| create denial (RLS) | `useCases.ts` error propagation | PASS | RLS-denial rejection test | server-side matrix `UNVERIFIED_DB` |
| detail (missing / denied) | `CaseDetail.tsx:259-276` — spinner → "Case not found" (denied is indistinguishable from missing: correct info-hiding) | PASS (pre-existing) | — (render branch trivial) | — |
| edit → refreshed detail | `useCases.updateCase` + `invalidateQueries(['cases'])` | PASS | whitelist + unauthorized tests | — |
| member add → member list | no UI surface; membership = `lawyer_id`/`client_id` on case; `case_members` view is a read contract | N/A (by design, source-confirmed) | — | member CRUD UI would require confirmed backend contract |
| document metadata → list | `useCaseFiles.ts` (list excludes `deleted_at`, ordered), `CaseDetail.tsx:197` | PASS (pre-existing) | covered indirectly; rendering tests exist (`CaseCard`, `CaseDetailInfo`) | — |

## 3. Field-permission split (case detail/edit)

* Immutable / server-owned: `id`, `created_at`, `updated_at`, `deleted_at` — stripped by `pickWritableCaseFields` allowlist (`useCases.ts:26-51`), never sent in insert/update payloads (test-verified).
* Editable set: exactly the 15 whitelisted columns.
* `lawyer_id` default = acting user (`auth.getUser()`), not a client-supplied privileged value; client cannot smuggle `id`/timestamps (test-verified).
* UI permission is not treated as a security boundary — server RLS remains authoritative; client errors from RLS denials are surfaced, not swallowed (test-verified).

## 4. Members

* No duplicate-membership or invalid-role writes are possible from the browser: there is no member-write code path (`case_members` writes absent in `src/`).
* Participant rendering is null-safe (`CaseDetailInfo.test.tsx` pre-existing).
* No administrative bypass added.

## 5. Document metadata

Query contract prepared and in active use: `filename`, `original_filename`, `file_size`, `file_type` (MIME), `uploaded_by`, `version`, `case_id`, `created_at`, soft-delete via `deleted_at`. Failure state: query error → React-Query error surface; upload/binary states belong to Prompt 08.

## 6. Tests added

`src/hooks/useCases.test.tsx` — 8 targeted tests (chainable supabase stub, React-Query wrapper):

1. empty case list → `[]`, no error
2. access-denied list → error state, empty fallback
3. LIKE metacharacters escaped in search (`%`→`\%`, `_`→`\_`, `\`→`\\`)
4. create defaults `lawyer_id` to actor; strips `id`/`created_at`/`deleted_at`
5. duplicate `case_number` → suffixed retry (`A-1-1`), second insert observed
6. non-duplicate insert failure (RLS) → rejected, no retry loop
7. update sends only whitelisted columns
8. unauthorized edit rejection propagates

## 7. Local repair loop log

| Cycle | Confirmed failure | Minimal fix | Verification |
| --- | --- | --- | --- |
| 1 | mutation tests raced the list query for the shared stub result queue (list consumed the first queued mutation result) | tests wait for list settle before enqueueing mutation results | targeted: 8/8 PASS |

Micro audit: only `src/hooks/useCases.test.tsx` added — no implementation change was required (journey code already met the contract); no suppressions; no schema objects invented; production untouched.

## 8. Prohibited-actions check

No production writes; no invented columns (all names verified against `types.ts`); no service-role client; no blanket casts (`as never` used only in tests to intentionally pass attacker-style extra fields); no redesign; authorization migration untouched; RLS **not** declared verified — behavioral matrix remains `UNVERIFIED_DB`.

## 9. Verification

| Gate | Result |
| --- | --- |
| Targeted tests (`useCases.test.tsx`) | 8/8 PASS |
| Full unit suite | **106/106 PASS** |
| Typecheck | PASS |
| Build | PASS |

## Exit criteria

* Core case transitions covered — ✔
* Role-sensitive UI consistent with authorization plan (allowlist + RLS-error surfacing) — ✔
* Binary upload not simulated here — ✔ (Prompt 08)
* Tests/typecheck/build PASS — ✔
* DB-dependent assertions marked `UNVERIFIED_DB` — ✔

**DECISION: `CORE_CASE_JOURNEY_READY`**
