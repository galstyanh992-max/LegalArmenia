# 01 — Security Status (live-verified)

Source: production catalog (avmgtsonawtzebvazgcr), read-only, 2026-07-20.

## Severity
**CURRENT_PRODUCTION_SECURITY_STATUS = NO_OPEN_P0_OR_P1_FOUND.** (Open P0 = 0 · Open P1 = 0.
This describes the security posture of the currently deployed scope only; it is not a release
authorization and does not override the blocked program verdict in 00.)
- P0 = 0 · P1 = 0 · Actionable P2 = 0 · P3 ACL findings = 0.

## Confirmed hardening applied to production (ledger 52)
- 20260717141940 admin_set_user_role → service-role-only, search_path='' (md5 prosrc
  b35c1f5b…, def 2b548eaa…).
- 20260718180110 record_ai_metric → service-role-only, search_path='' (prosrc a6a22938…,
  def 20535217…).
- 20260718230128 get_embedding_metrics → service-role-only, search_path='' (prosrc de1ec5a3…,
  def b47444a0…).
- 20260719000000 trigger-function EXECUTE revocation (cases_compat_insert, handle_new_user →
  {postgres,service_role}).
- 20260719000001 default-privilege hardening (anon/authenticated CREATE = false on
  app/auth/extensions/internal/public).

## Live security advisors — zero ERROR
WARN/INFO only (all non-blocking, tracked in 05):
- rls_enabled_no_policy (INFO ×8): legal-corpus ingestion tables — deny-by-default (safe).
- function_search_path_mutable (WARN ×4): app.prevent_legal_decision_data_update,
  app.save_legal_decision_atomic, public.set_updated_at, public.case_files_object_case_id
  (outside PR-D 17-scope; defense-in-depth).
- rls_policy_always_true (WARN): public.error_logs INSERT WITH CHECK(true) for authenticated.
- extension_in_public (WARN): vector, pg_trgm.
- anon/authenticated_security_definer_function_executable (WARN): app.* case helpers,
  public.get_my_role, search_legal_*, get_ai_metrics_summary — all previously dispositioned SAFE
  by PR-D (caller-scoped / admin-gated / open public read).
- auth_leaked_password_protection disabled (WARN).

## Role isolation
- RLS policies caller-scoped via app.can_read_case / can_manage_case / is_case_lawyer /
  is_case_member / get_my_role (each resolves auth.uid()).
- has_schema_privilege(anon|authenticated, s, CREATE) = false for all app schemas.
- Contract tests (authorization-matrix, storage-matrix, authorization-contract) green in Deno CI.

## Blocking security defects: NONE.
