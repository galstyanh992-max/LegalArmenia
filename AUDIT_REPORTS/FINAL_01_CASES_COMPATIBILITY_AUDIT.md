# FINAL_01 — Cases Compatibility / Trigger-Drift Audit

Base: origin/main = ad20a27bc32ba40c364fbe39d969285d4d17171b
Mode: READ-ONLY (production + staging). No DB change made.
Date: 2026-07-20.

## Live topology (read-only, catalog-verified)

### Production (avmgtsonawtzebvazgcr)
- `public.cases_compat_insert()` exists; owner `postgres`;
  ACL = `{postgres=X/postgres,service_role=X/postgres}` (direct API-role EXECUTE revoked);
  search_path = `app, public, auth, pg_temp`;
  md5(prosrc) = b8b6d0f95bb1fb8915f60984637c1dbd;
  md5(pg_get_functiondef) = 93472ba38356e7f957ba04167433b53f.
- `public.cases` is a VIEW (relkind=v). Rules on it: only `_RETURN` (SELECT INSTEAD). No INSTEAD OF INSERT/UPDATE/DELETE rule; no DML trigger.
- Registered non-internal trigger count executing `cases_compat_insert` = **0**.
- `information_schema.views` for `public.cases`:
  is_insertable_into = **YES**; is_trigger_insertable_into = NO;
  is_updatable = YES; is_trigger_updatable = NO; is_trigger_deletable = NO.
  → The view is a PostgreSQL **auto-updatable** view: INSERT/UPDATE/DELETE rewrite directly to the base table `app.cases` without any INSTEAD OF trigger.

### Staging (vavjajwiqsdhlweggalw), ledger = 13
- `public.cases_compat_insert()` exists; ACL = broad `{postgres,service_role,PUBLIC,anon,authenticated}` (PR-C REVOKE not applied to staging);
  md5(prosrc) = 53e0dabfbcef736dac0b7ad5201358b2 (DIFFERS from production);
  md5(pg_get_functiondef) = b184861f9a21d5f8ddfc485bd2295f6f.
- Trigger `cases_insert_tg` = `CREATE TRIGGER cases_insert_tg INSTEAD OF INSERT ON public.cases FOR EACH ROW EXECUTE FUNCTION cases_compat_insert()` — **enabled**.

### Environment delta
- Staging routes view INSERTs through the INSTEAD OF trigger.
- Production has no such trigger and relies on auto-updatable-view rewrite.
- Function bodies also differ between environments (prosrc b8b6d0f9 vs 53e0dab).

## Caller analysis (repository)
- Frontend uses the `public.cases` view for all case CRUD via `supabase.from('cases')`:
  - INSERT: `src/hooks/useCases.ts:117-121` (`createCase`)
  - UPDATE: `src/hooks/useCases.ts:157-162`
  - DELETE: `src/hooks/useCases.ts:184`
  - SELECT: `useCases.ts`, `useCourtCases.ts`, `CaseFactsEditor`, `CaseTimeline`, `TeamStats`.
- Edge functions read `.from("cases")` (SELECT) in ai-analyze, extract-case-fields, generate-complaint, generate-document, multi-agent-analyze.
- Test-only callers: `_shared/authorization-matrix.local.test.ts`, `_shared/storage-matrix.local.test.ts`.
- No caller invokes `cases_compat_insert` directly by name (it is reached, if at all, only via a trigger — absent in production).
- `pickWritableCaseFields` (useCases.ts:26-51) restricts inserts/updates to a whitelist of **simple base columns** (case_number, title, description, status, lawyer_id, client_id, case_type, current_stage, priority, court_name, court_date, facts, legal_question, party_role, appeal_party_role, notes) — none of the non-updatable aliased columns (`id`, `court`). This is exactly what an auto-updatable view requires.

## Behavioral-parity evidence (production base table `app.cases`)
Column defaults (read-only):
- case_id → gen_random_uuid() (PK)
- created_by → auth.uid() (NOT NULL) — correct attribution without a trigger
- status → 'open' (NOT NULL)
- priority → 'medium' (NOT NULL)
- created_at/updated_at → now()
- lawyer_id → NOT NULL, no default (frontend sets it: useCases.ts:107-111)
Live data: `app.cases` has 1 row, latest created 2026-07-11, with lawyer_id / status / created_at populated — a real, well-formed case created through the live path.

Conclusion: the auto-updatable-view path produces correctly attributed, correctly defaulted rows in production **without** the INSTEAD OF trigger. The trigger-side defaults that staging applies are covered in production by base-table column defaults plus the frontend explicitly setting `lawyer_id`.

## Adversarial review
- "View not insertable without the trigger" → DISPROVEN by `is_insertable_into = YES` (auto-updatable) and the writable-column whitelist.
- "Missing trigger breaks production case creation" → DISPROVEN: real production case exists; defaults populate created_by/status.
- "Function is an orphan to delete" → NO: the compatibility view is actively used; the function is dormant (ACL-closed, no trigger) but not proven safe to drop.
- Residual (non-blocking): staging vs production function-body/ACL drift; staging trigger present. These are staging-side legacy artifacts; they do not affect production behavior.
- Not a security finding: production ACL is service-role-only (direct API EXECUTE revoked); PR-D already classified this P3-closed.

## Phase 1 decision
**C. COMPATIBILITY_FUNCTION_REQUIRED_BUT_TRIGGER_NOT_REQUIRED**

- The `public.cases` compatibility view is required and actively used.
- Production correctly relies on auto-updatable-view semantics; the INSTEAD OF trigger is NOT required in production.
- `cases_compat_insert` is dormant/harmless in production (no trigger bound; ACL service-role-only).
- No production change is authorized or required.
- Disposition unchanged: TRIGGER_DRIFT / EXTERNAL_COMPATIBILITY_REVIEW_REQUIRED (documentation-level; environment parity between staging and production is the only open, non-blocking item).

**PHASE VERDICT: PHASE_PASS** (loop count: 1). No production or staging write performed.
