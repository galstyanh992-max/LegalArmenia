-- =============================================================================
-- HOTFIX: admin_set_user_role service-role-only authorization (CRITICAL)
-- =============================================================================
-- CVE-class: privilege escalation via fail-open admin RPC guard.
--
-- THREE DISTINCT STATES (do not conflate):
--
--   A. ACTUAL PRODUCTION STATE (captured in baseline 20260712120002):
--      * fail-open guard:  if app.get_my_role() <> 'admin' then raise 42501
--        (NULL-unsafe: when app.get_my_role() returns NULL, `NULL <> 'admin'`
--         evaluates to NULL, the guard is skipped, and the SECURITY DEFINER
--         update proceeds -> privilege escalation).
--      * no service_role path; no JWT-role check.
--      * no audit_logs side effect.
--      * search_path = 'public', 'app', 'auth', 'pg_temp'.
--      * EXECUTE granted to PUBLIC, anon, authenticated, service_role.
--      * production function-definition hash: 71d960885366c4d4b0a00a610a957664.
--      THIS is the vulnerable production definition.
--
--   B. LOCAL-ONLY MIGRATION 20260712120006 (NOT applied to production):
--      * a separate repository hardening attempt with a NULL-safe
--        service-role OR authenticated-admin authorization model;
--      * adds an audit_logs insert, a self-demotion guard, SELECT FOR UPDATE,
--        and an early-return when the role is unchanged;
--      * search_path = ''.
--      This migration is NOT the production vulnerability and must not be
--      described as such. It is explicitly marked "local-only, do not apply
--      to production without disposable role-matrix verification".
--
--   C. THIS HOTFIX (20260717141940):
--      * service-role-only, fail-closed:
--          (auth.jwt() ->> 'role') IS DISTINCT FROM 'service_role' -> 42501
--      * removes the fail-open `app.get_my_role() <> 'admin'` guard entirely;
--      * removes the authenticated-admin fallback (no reachable caller in repo);
--      * no dynamic SQL; all objects schema-qualified; search_path = ''.
--
-- This hotfix is designed to repair BOTH:
--   * the actual current production function when applied independently to a
--     database at state A (CREATE OR REPLACE + ACL normalization); and
--   * clean replay after 20260712120006 (state B) -> superseded to state C.
--
-- BEHAVIOR PARITY (non-authorization) vs production state A:
--   * user_profiles update: identical (set app_role = p_role, updated_at).
--   * updated_at: production uses now(); hotfix uses pg_catalog.now() for
--     search_path='' safety (functionally identical: now() is pg_catalog.now).
--   * not-found behavior: identical -> raise 'User not found: %' P0002.
--   * audit_logs: production state A has NO audit insert; hotfix has NO audit
--     insert -> production parity preserved. The audit insert existed only in
--     the local-only 20260712120006 (state B); carrying it into the hotfix
--     would ADD a side effect to production. The audit-trail decision for the
--     clean-replay-after-20260712120006 path is flagged for explicit review
--     (see PR description / AUDIT_LOG_BEHAVIOR_DECISION).
--   * exception messages: authorization message changes from
--     'Only admin can change roles' to 'Service role required' (expected,
--     authorization-related); not-found message unchanged.
--   * additional validation: production A has none; hotfix has none. The
--     self-demotion guard / FOR UPDATE / early-return from state B are NOT
--     carried forward (they were never production behavior).
--   * search_path: hardened from 'public','app','auth','pg_temp' to ''
--     (security hardening, prevents search_path injection).
--
-- Atomicity / exposure window:
--   Wrapped in an explicit transaction (begin..commit), matching the pattern
--   used by 20260712120006. Even without a runner transaction, no fail-open
--   window exists: CREATE OR REPLACE swaps the body atomically to a
--   fail-closed definition, so any authenticated caller that still holds
--   EXECUTE during the brief pre-REVOKE window is rejected by the body itself
--   (42501). The subsequent REVOKE/GRANT only narrows the ACL to match the
--   already-fail-closed body. There is no instant where the function is both
--   PUBLIC/authenticated-executable AND fail-open.
-- =============================================================================

begin;

-- 1. Replace the function body with the minimal service-role-only definition.
--    Signature, return type, language, SECURITY DEFINER, search_path, and
--    owner are preserved. CREATE OR REPLACE does not change the owner or
--    existing privileges; privileges are normalized below.
create or replace function public.admin_set_user_role(
  p_user_id uuid,
  p_role app.app_role
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if (auth.jwt() ->> 'role') is distinct from 'service_role' then
    raise exception 'Service role required'
      using errcode = '42501';
  end if;

  update app.user_profiles
     set app_role = p_role,
         updated_at = pg_catalog.now()
   where user_id = p_user_id;

  if not found then
    raise exception 'User not found: %', p_user_id
      using errcode = 'P0002';
  end if;
end;
$function$;

-- 2. Normalize privileges: strip every API role first, then grant only
--    service_role. Revoking from service_role before re-granting guarantees a
--    deterministic final ACL regardless of the incoming state (covers both
--    state A's PUBLIC/anon/authenticated/service_role grants and state B's
--    authenticated/service_role grants).
revoke all on function public.admin_set_user_role(uuid, app.app_role)
  from public, anon, authenticated, service_role;

grant execute on function public.admin_set_user_role(uuid, app.app_role)
  to service_role;

-- 3. Update the function comment to record the new authorization model.
comment on function public.admin_set_user_role(uuid, app.app_role)
  is 'Service-role-only role transition. PUBLIC, anon, and authenticated execution removed. NULL-safe fail-closed authorization.';

commit;
