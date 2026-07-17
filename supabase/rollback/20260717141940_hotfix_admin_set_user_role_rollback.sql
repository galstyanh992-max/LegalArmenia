-- =============================================================================
-- CRITICAL SECURITY CONTAINMENT ROLLBACK
-- for 20260717141940_hotfix_admin_set_user_role.sql
-- =============================================================================
-- This is an AVAILABILITY / containment rollback, NOT a vulnerability
-- restoration. It intentionally does NOT restore:
--   * PUBLIC EXECUTE;
--   * anon EXECUTE;
--   * authenticated EXECUTE;
--   * the historical authenticated-admin fallback body;
--   * the known fail-open production condition.
--
-- Behavior:
--   1. Revoke execution from every API role, including service_role.
--   2. Leave the patched fail-closed function definition in place.
--   3. Disable role-transition functionality rather than reopening the
--      vulnerability.
--
-- Restoring service_role functionality after this containment rollback
-- requires a NEW reviewed forward migration. Do not re-enable by editing
-- this file or by replaying the vulnerable historical definition.
-- =============================================================================

revoke all on function public.admin_set_user_role(uuid, app.app_role)
  from public, anon, authenticated, service_role;

comment on function public.admin_set_user_role(uuid, app.app_role)
  is 'DISABLED BY SECURITY CONTAINMENT ROLLBACK. Manual security review required before re-enabling.';
