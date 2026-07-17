-- =============================================================================
-- Prompt 19.7 Phase 11b: Harden Legal Metadata Table Grants (corrective)
-- =============================================================================
-- Root cause: after 20260716000100 created the 8 additive metadata tables,
-- project-wide ALTER DEFAULT PRIVILEGES (roles postgres + supabase_admin)
-- granted anon, authenticated AND service_role the full table privilege set
-- (SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN).
-- RLS is enabled with zero policies, so no rows were ever exposed to
-- anon/authenticated, but the broad table-level ACLs violated least privilege.
--
-- This migration codifies the production hardening that was applied manually:
--   * remove ALL privileges from PUBLIC, anon, authenticated
--   * normalize service_role to exactly SELECT, INSERT, UPDATE
--     (strips the default-privilege extras DELETE/TRUNCATE/REFERENCES/
--      TRIGGER/MAINTAIN)
--
-- Scope is EXACTLY the 8 additive legal-metadata tables. It does NOT:
--   * alter project-wide ALTER DEFAULT PRIVILEGES (tracked separately as
--     DEFAULT_PRIVILEGES_LEAST_PRIVILEGE_DEBT)
--   * change RLS enablement or any RLS policy
--   * modify any other table, function, sequence, or migration
--   * grant privileges to anon, authenticated or PUBLIC
--
-- No sequences are owned by these tables (all PKs are text or uuid defaults),
-- so no sequence ACL statements are required.
--
-- Idempotent: safe to execute when privileges are already in the desired state.
-- =============================================================================

-- legal_source_files
revoke all on public.legal_source_files from public, anon, authenticated, service_role;
grant select, insert, update on public.legal_source_files to service_role;

-- legal_document_metadata
revoke all on public.legal_document_metadata from public, anon, authenticated, service_role;
grant select, insert, update on public.legal_document_metadata to service_role;

-- legal_document_versions
revoke all on public.legal_document_versions from public, anon, authenticated, service_role;
grant select, insert, update on public.legal_document_versions to service_role;

-- legal_provisions
revoke all on public.legal_provisions from public, anon, authenticated, service_role;
grant select, insert, update on public.legal_provisions to service_role;

-- legal_source_page_mappings
revoke all on public.legal_source_page_mappings from public, anon, authenticated, service_role;
grant select, insert, update on public.legal_source_page_mappings to service_role;

-- legal_metadata_reconstruction_runs
revoke all on public.legal_metadata_reconstruction_runs from public, anon, authenticated, service_role;
grant select, insert, update on public.legal_metadata_reconstruction_runs to service_role;

-- legal_metadata_failures
revoke all on public.legal_metadata_failures from public, anon, authenticated, service_role;
grant select, insert, update on public.legal_metadata_failures to service_role;

-- legal_metadata_review_actions
revoke all on public.legal_metadata_review_actions from public, anon, authenticated, service_role;
grant select, insert, update on public.legal_metadata_review_actions to service_role;
