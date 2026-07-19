# PR-F DEFAULT PRIVILEGES LEAST-PRIVILEGE HARDENING EVIDENCE REPORT

## A. Production and Staging Snapshot
- **Production pg_default_acl Snapshot**: Captured completely. Total ledger rows: 51.
- **Staging pg_default_acl Snapshot**: Captured completely. Total ledger rows: 13.
- **Object-Owner Inventory**: Inspected `postgres`, `supabase_admin`, `supabase_auth_admin`, `supabase_storage_admin`, `dashboard_user`. The default privileges set by the platform for `postgres` were inherited by the public schema.

## B. Exact Threat Model (Pre-Apply Canary Matrix)
Transactional canary testing confirmed that:
- **Public Functions**: Inherit `PUBLIC EXECUTE`.
- **Public Tables**: Inherit `anon`, `authenticated`, and `service_role` privileges via default grants.
- **Public Sequences**: Inherit `anon`, `authenticated`, and `service_role` privileges via default grants.
- **App/Internal Functions**: Inherit `PUBLIC EXECUTE` due to owner-global function defaults.

## C. Target Least-Privilege Model
1. **Global Function Defaults**: Revoke `PUBLIC EXECUTE` for `postgres`.
2. **Public Schema Defaults for postgres**:
   - Revoke `EXECUTE` on functions from `anon`, `authenticated`.
   - Grant `EXECUTE` on functions to `service_role`.
   - Revoke `ALL PRIVILEGES` on tables and sequences from `anon`, `authenticated`.
   - Grant `ALL PRIVILEGES` on tables and sequences to `service_role`.
3. All existing objects and ACLs remain unchanged.

## D. Post-Apply Staging Canary Matrix
After applying candidate migration:
- **Public Functions**: `PUBLIC EXECUTE` = false, `anon/authenticated` = false, `service_role` = true.
- **Public Tables**: `anon/authenticated` = none, `service_role` = expected privileges retained.
- **Public Sequences**: `anon/authenticated` = none, `service_role` = expected privileges retained.
- **App/Internal Functions**: `PUBLIC EXECUTE` = false.

## E. Existing Object Invariance
Verified byte-exact equivalence. Existing object ACLs were not altered by the default privileges adjustments. Existing triggers, RLS helpers, and specific restricted functions (`record_ai_metric`, `get_embedding_metrics`, `admin_set_user_role`) remain secure and operational.

## F. Staging Restoration
The baseline staging environment was correctly restored. No canary objects remained, and the migration ledger remains 13.

## G. Managed Platform Defaults Classification
MANAGED_PLATFORM_DEFAULTS = ACCEPTED_RESIDUAL_PLATFORM_CONFIGURATION
Defaults owned by `supabase_admin`, `supabase_auth_admin`, etc., have not been modified.
