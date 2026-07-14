-- =============================================================================
-- SMOKE TESTS: public.get_ai_metrics_summary role-aware access
-- Run manually after applying 20260708000000_harden_get_ai_metrics_summary.sql
-- (or via `supabase db execute` / SQL editor). Read-only — does not modify data.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- SMOKE TEST 1: Non-admin / no-role caller gets a safe EMPTY result, no error.
--
-- When run from the SQL editor / execute_sql (no request.jwt.claim.sub set),
-- auth.uid() is NULL, so app.get_my_role() is NULL. Before this migration,
-- the old check `app.get_my_role() <> 'admin'` evaluated to NULL for a NULL
-- role, and PL/pgSQL's `IF NULL THEN` treats NULL as "not true" and SKIPS the
-- raise-exception branch — so a NULL-role caller would silently fall through
-- to the real query and receive live internal.ai_metrics data. This test
-- guards against that regression.
-- ---------------------------------------------------------------------------
-- EXPECTED: row_count = 0, current_role IS NULL, no exception raised.

do $$
declare
  row_count int;
  role_seen app.app_role;
begin
  select app.get_my_role() into role_seen;
  select count(*) into row_count from public.get_ai_metrics_summary(30);

  if role_seen is not null then
    raise notice 'SMOKE TEST 1 SKIPPED: session unexpectedly has a resolved role (%), cannot exercise the NULL-role path here', role_seen;
  elsif row_count <> 0 then
    raise exception 'SMOKE TEST 1 FAILED: NULL-role caller received % rows (expected 0) — admin gate is not closing for NULL roles', row_count;
  else
    raise notice 'SMOKE TEST 1 PASSED: NULL-role caller received 0 rows, no exception raised';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- SMOKE TEST 2: A real admin still sees real, non-empty metrics.
--
-- Simulates an admin session by setting request.jwt.claim.sub (transaction-
-- local via set_config(..., true), never persisted) to an active admin's
-- user_id, then calls the RPC exactly as PostgREST would for that user.
-- Skips gracefully if no active admin profile exists in this environment.
-- ---------------------------------------------------------------------------
-- EXPECTED: row_count > 0 whenever internal.ai_metrics has rows in the last
-- 30 days (confirms the admin path was not accidentally broken while fixing
-- the non-admin path).

do $$
declare
  test_admin_id uuid;
  row_count int;
  expected_nonzero boolean;
begin
  select user_id into test_admin_id
  from app.user_profiles
  where app_role = 'admin' and is_active = true
  limit 1;

  if test_admin_id is null then
    raise notice 'SMOKE TEST 2 SKIPPED: no active admin user_profiles row in this environment';
    return;
  end if;

  select exists (
    select 1 from internal.ai_metrics where created_at >= now() - interval '30 days'
  ) into expected_nonzero;

  perform set_config('request.jwt.claim.sub', test_admin_id::text, true);
  select count(*) into row_count from public.get_ai_metrics_summary(30);

  if expected_nonzero and row_count = 0 then
    raise exception 'SMOKE TEST 2 FAILED: admin (%) received 0 rows despite recent internal.ai_metrics rows existing', test_admin_id;
  else
    raise notice 'SMOKE TEST 2 PASSED: admin (%) received % rows', test_admin_id, row_count;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- SMOKE TEST 3: EXECUTE grants are tightened — no anon/PUBLIC access.
-- ---------------------------------------------------------------------------
-- EXPECTED: no rows returned (anon/PUBLIC have no EXECUTE grant on the RPC).

do $$
declare
  bad_count int;
begin
  select count(*) into bad_count
  from information_schema.role_routine_grants
  where routine_name = 'get_ai_metrics_summary'
    and grantee in ('anon', 'PUBLIC');

  if bad_count > 0 then
    raise exception 'SMOKE TEST 3 FAILED: % unexpected EXECUTE grant(s) to anon/PUBLIC on get_ai_metrics_summary', bad_count;
  else
    raise notice 'SMOKE TEST 3 PASSED: no EXECUTE grant to anon/PUBLIC';
  end if;
end $$;
