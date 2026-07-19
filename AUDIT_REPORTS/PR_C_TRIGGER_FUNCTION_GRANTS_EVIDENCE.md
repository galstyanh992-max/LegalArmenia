# PR-C: Trigger Function Execute Grants Evidence

## Threat Model
P3 defense-in-depth

A. \public.handle_new_user()\
- active trigger function in production and staging;
- direct API-role EXECUTE grants are unnecessary.

B. \public.cases_compat_insert()\
- active trigger function in staging;
- orphaned trigger function in production because cases_insert_tg is absent;
- direct API-role EXECUTE grants are still unnecessary;
- PR-C does not restore or redesign the missing production trigger.

*Note: Registered trigger execution is distinct from direct function invocation. \SECURITY DEFINER\ controls the role used inside the function. PR-C removes unnecessary direct function \EXECUTE\ grants only; underlying \INSERT\ permissions and RLS remain unchanged.*

## Exact Production Catalog State

\public.cases_compat_insert()\
- RETURNS trigger
- owner postgres
- SECURITY DEFINER true
- search_path = app, public, auth, pg_temp
- broad EXECUTE currently present
- md5(prosrc) = b8b6d0f95bb1fb8915f60984637c1dbd
- md5(functiondef) = 93472ba38356e7f957ba04167433b53f
- dependent trigger count = 0
- cases_insert_tg is absent

\public.handle_new_user()\
- RETURNS trigger
- owner postgres
- SECURITY DEFINER true
- search_path = public, app
- broad EXECUTE currently present
- md5(prosrc) = 98475b8fbef19a2fde45ddcc79eebc57
- md5(functiondef) = ced5947b7403494228b6ac1dba6c2541
- dependent trigger: on_auth_user_created
- trigger enabled

Production ledger = 50.
Migration 20260719000000 absent.

## Exact Staging Catalog State

\public.cases_compat_insert()\
- md5(prosrc) = 53e0dabfbcef736dac0b7ad5201358b2
- md5(functiondef) = b184861f9a21d5f8ddfc485bd2295f6f
- dependent trigger: cases_insert_tg

\public.handle_new_user()\
- md5(prosrc) = eb4a9ab394cdd1a6c00f3f14a4bb5cad
- md5(functiondef) = 2e3f198e7f93cf4d580b0075c7f773ab
- dependent trigger: on_auth_user_created

Staging ledger = 13.
Migration 20260719000000 absent.

## Repository Caller Audit
RUNTIME_DIRECT_CALLERS = 0

## Forward Migration
\\\sql
BEGIN;

REVOKE EXECUTE
ON FUNCTION public.cases_compat_insert()
FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE
ON FUNCTION public.handle_new_user()
FROM PUBLIC, anon, authenticated;

COMMIT;
\\\

## Rollback Semantics
\\\sql
BEGIN;

GRANT EXECUTE
ON FUNCTION public.cases_compat_insert()
TO PUBLIC, anon, authenticated;

GRANT EXECUTE
ON FUNCTION public.handle_new_user()
TO PUBLIC, anon, authenticated;

COMMIT;
\\\

## Validation
- **Staging Validation**: TEMPORARY_STAGING_APPLY_PASSED
- **Staging Restoration**: EXACT_BASELINE_RESTORED
- **Functional Validation**: FUNCTIONAL_TRIGGER_TEST_BLOCKED (Blocked due to strict environment bounds prohibiting new external ephemeral data or interactive live queries, verification rests on the static assertion)
- **Test Results**: Deno contract test passed locally.
- **Production**: PRODUCTION_HOLD_VERIFIED (No changes made)
