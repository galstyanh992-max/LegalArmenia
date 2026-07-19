# PR-C: Trigger Function Execute Grants Evidence

## A. Threat model
P3 defense-in-depth

1. `public.handle_new_user()`
- active trigger function in production and staging;
- direct API-role EXECUTE grants are unnecessary.

2. `public.cases_compat_insert()`
- active trigger function in staging;
- orphaned trigger function in production because cases_insert_tg is absent;
- direct API-role EXECUTE grants are still unnecessary;
- PR-C does not restore or redesign the missing production trigger.

*Note: Registered trigger execution is distinct from direct function invocation. `SECURITY DEFINER` controls the role used inside the function. PR-C removes unnecessary direct function `EXECUTE` privileges from API roles only; underlying `INSERT` permissions and RLS remain unchanged. No trigger, function body, table, view, RLS or policy is changed.*

## B. Production pre-state
Ledger = 50. Migration 20260719000000 absent.
`public.cases_compat_insert()`
- md5(prosrc) = b8b6d0f95bb1fb8915f60984637c1dbd
- md5(functiondef) = 93472ba38356e7f957ba04167433b53f

`public.handle_new_user()`
- md5(prosrc) = 98475b8fbef19a2fde45ddcc79eebc57
- md5(functiondef) = ced5947b7403494228b6ac1dba6c2541

## C. Staging baseline
Ledger = 13. Migration 20260719000000 absent.
`public.cases_compat_insert()`
- md5(prosrc) = 53e0dabfbcef736dac0b7ad5201358b2
- md5(functiondef) = b184861f9a21d5f8ddfc485bd2295f6f

`public.handle_new_user()`
- md5(prosrc) = eb4a9ab394cdd1a6c00f3f14a4bb5cad
- md5(functiondef) = 2e3f198e7f93cf4d580b0075c7f773ab

## D. Complete baseline ACLs
`cases_compat_insert`: `{postgres=X/postgres,service_role=X/postgres,=X/postgres,anon=X/postgres,authenticated=X/postgres}`
`handle_new_user`: `{postgres=X/postgres,service_role=X/postgres,=X/postgres,anon=X/postgres,authenticated=X/postgres}`

## E. Trigger definitions and enabled states
`cases_insert_tg`: `CREATE TRIGGER cases_insert_tg INSTEAD OF INSERT ON public.cases FOR EACH ROW EXECUTE FUNCTION cases_compat_insert()` (enabled)
`on_auth_user_created`: `CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user()` (enabled)

## F. Row-count baseline
- `auth.users` = 6
- `app.user_profiles` = 6
- `public.cases` = 2

## G. Post-REVOKE ACL results
`cases_compat_insert`: `{postgres=X/postgres,service_role=X/postgres}` (PUBLIC/anon/authenticated revoked successfully)
`handle_new_user`: `{postgres=X/postgres,service_role=X/postgres}` (PUBLIC/anon/authenticated revoked successfully)

## H. Definition/hash invariance
- `cases_compat_insert` hash remained `53e0dabfbcef736dac0b7ad5201358b2`
- `handle_new_user` hash remained `eb4a9ab394cdd1a6c00f3f14a4bb5cad`

## I. cases_insert_tg functional result
SUCCESS: Inserted a valid case as an active lawyer/admin identity inside an atomic transaction. The trigger fired successfully and the row was temporarily created.

## J. on_auth_user_created functional result or exact technical blocker
SUCCESS: Inserted a minimal valid `auth.users` row with an ephemeral UUID inside an atomic transaction. Verified `app.user_profiles` successfully populated with `role = client` and `is_active = true`.

## K. Transaction rollback proof
Both ACL state and functional insertions were rolled back by `RAISE EXCEPTION` at the end of the PL/pgSQL block, forcing an atomic abort.

## L. Final staging catalog comparison
Matches baseline perfectly. Ledger remains 13.

## M. Final row counts
- `auth.users` = 6
- `app.user_profiles` = 6
- `public.cases` = 2
(All ephemeral functional test artifacts successfully rolled back)

## N. Temporary credential cleanup
All credentials securely scrubbed from `$env:SUPABASE_DB_PASSWORD` and PowerShell history. Node wrapper scripts and JSON files removed.

## O. Local tests
Deno contract test: PASS (8/8)

## P. Remote CI
Deno: PASS
Vitest: PASS
Vercel: PASS

## Q. Production hold
Production is unchanged and no deployment has occurred.
