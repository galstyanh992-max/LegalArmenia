-- ============================================================================
-- DRAFT — LOCAL ONLY — DO NOT APPLY WITHOUT DISPOSABLE-ENVIRONMENT VERIFICATION
-- ============================================================================
-- Prompt 08/20 deliverable: minimum-required storage access for private case
-- files. This file intentionally lives OUTSIDE supabase/migrations/ so that
-- `supabase db push` / CI can never apply it implicitly. Promote it to a real
-- migration only after the behavioral matrix below passes in a disposable
-- Supabase environment (see AUDIT_REPORTS/09_STORAGE_UPLOAD_HARDENING.md §6).
--
-- Live-production note (2026-07-11): equivalent user-scoped policies for the
-- autofill / complaints / standalone prefixes were already applied by
-- migration 20260710170000_fix_case_files_user_scoped_uploads.sql. This draft
-- re-states the FULL intended end-state so a disposable environment can be
-- provisioned from scratch and diffed against production.
-- ============================================================================

-- Bucket: case-files (PRIVATE — never enable public access)
-- Key shapes:
--   <case_id>/<uuid>.<ext>                 case documents (metadata in public.case_files)
--   <user_id>/autofill/<ts>_<safe_name>    temporary autofill uploads
--   <user_id>/complaints/<ts>-<rand>.<ext> temporary complaint uploads
--   <user_id>/standalone/<uuid>.<ext>      standalone audio uploads

-- 1) No anonymous access of any kind: RLS on storage.objects with no policy
--    for role anon. (No `TO public`/`USING (true)` policies are allowed.)

-- 2) Case members read case objects (first segment is a case the caller can read):
--    CREATE POLICY "case members read case objects" ON storage.objects
--      FOR SELECT TO authenticated
--      USING (
--        bucket_id = 'case-files'
--        AND app.try_uuid((storage.foldername(name))[1]) IS NOT NULL
--        AND app.can_read_case(app.try_uuid((storage.foldername(name))[1]))
--      );

-- 3) Case members write case objects (same predicate FOR INSERT WITH CHECK / FOR DELETE USING).

-- 4) Owner-scoped temporary prefixes (autofill|complaints|standalone):
--    CREATE POLICY "owner temp uploads" ON storage.objects
--      FOR ALL TO authenticated
--      USING (
--        bucket_id = 'case-files'
--        AND (storage.foldername(name))[1] = auth.uid()::text
--        AND (storage.foldername(name))[2] IN ('autofill','complaints','standalone')
--      )
--      WITH CHECK (same predicate);

-- 5) telegram-uploads bucket (legacy media isolation):
--    - service_role keeps full access (edge function writes);
--    - authenticated users may only SELECT their own rows' objects via the
--      telegram_uploads table join (owner check), never by raw path guessing;
--    - no anon policies.

-- ============================================================================
-- Behavioral verification matrix (must run in DISPOSABLE environment only)
-- ============================================================================
-- | Actor     | Action              | Own case | Foreign case | Expected |
-- |-----------|---------------------|----------|--------------|----------|
-- | Anonymous | read any object     |   N/A    |     N/A      |  DENY    |
-- | Client    | upload/read         |   Yes    |      —       |  ALLOW   |
-- | Client    | upload/read         |    —     |     Yes      |  DENY    |
-- | Lawyer    | upload/read         |  Member  |      —       |  ALLOW   |
-- | Lawyer    | upload/read         |    —     |  Non-member  |  DENY    |
-- | Any auth  | write foreign temp prefix (<other_uid>/autofill/..)  | — | — | DENY |
-- | Any auth  | non-UUID first segment outside temp prefixes         | — | — | DENY (clean, no 22P02) |
-- | Admin     | controlled action   | policy-defined — must be EXPLICIT, not implied |
-- | Service   | internal operation  | scoped to edge-function use only |
--
-- STATUS: UNVERIFIED_DB — disposable environment unavailable in this session.
-- ============================================================================
