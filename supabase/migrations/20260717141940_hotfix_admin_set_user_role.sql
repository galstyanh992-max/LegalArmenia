-- =============================================================================
-- HOTFIX: admin_set_user_role service-role-only authorization (CRITICAL)
-- =============================================================================
-- CVE-class: privilege escalation via authenticated-admin RPC fallback.
--
-- Prior state (20260712120006, local-only, NOT applied to production):
--   public.admin_set_user_role(uuid, app.app_role) was SECURITY DEFINER and
--   accepted TWO authorization paths:
--     1. auth.jwt() ->> 'role' = 'service_role'
--     2. app.get_my_role() is distinct from 'admin'  (authenticated-admin path)
--   EXECUTE was granted to `authenticated` and `service_role`.
--
-- Repository evidence found no direct frontend or authenticated-admin RPC
-- caller for this function. The authenticated-admin fallback is therefore an
-- unreachable path that widens the authorization surface for no benefit and
-- allows any caller holding an authenticated JWT (with a profile row reading
-- 'admin') to escalate / reassign user roles via a SECURITY DEFINER function
-- that bypasses RLS.
--
-- This hotfix:
--   * preserves the signature, return type, SECURITY DEFINER, and owner;
--   * replaces the body with a minimal fail-closed service-role-only guard;
--   * removes the app.get_my_role() authenticated-admin fallback entirely;
--   * removes the NULL-unsafe `<> admin` guard;
--   * removes the audit_logs side-effect (out of scope for this hotfix and
--     not reachable from any authorized caller; audit can be re-added in a
--     later reviewed forward migration if a service-role audit path is needed);
--   * normalizes the ACL: revoke from PUBLIC, anon, authenticated, and
--     service_role, then GRANT EXECUTE only to service_role.
--
-- Authorization is now strictly: (auth.jwt() ->> 'role') IS DISTINCT FROM
-- 'service_role' => raise 42501. This rejects anonymous, authenticated,
-- profile-less, inactive, admin-on-authenticated-JWT, missing JWT, and
-- malformed/unexpected role values. No user-provided metadata is trusted.
--
-- Atomicity / exposure window:
--   This file is wrapped in an explicit transaction (begin..commit), matching
--   the pattern used by the original 20260712120006 migration. Even if the
--   migration runner did NOT wrap the file, no fail-open window exists:
--     - CREATE OR REPLACE swaps the function body atomically; the new body is
--       fail-closed from the instant of replacement, so any authenticated
--       caller that still holds EXECUTE during the brief pre-REVOKE window is
--       rejected by the body itself (42501).
--     - The subsequent REVOKE/GRANT only narrows the ACL to match the body.
--   There is no instant where the function is both PUBLIC/authenticated
--   executable AND fail-open.
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
--    deterministic final ACL regardless of the incoming state.
revoke all on function public.admin_set_user_role(uuid, app.app_role)
  from public, anon, authenticated, service_role;

grant execute on function public.admin_set_user_role(uuid, app.app_role)
  to service_role;

-- 3. Update the function comment to record the new authorization model.
comment on function public.admin_set_user_role(uuid, app.app_role)
  is 'Service-role-only role transition. PUBLIC, anon, and authenticated execution removed. NULL-safe fail-closed authorization.';

commit;
