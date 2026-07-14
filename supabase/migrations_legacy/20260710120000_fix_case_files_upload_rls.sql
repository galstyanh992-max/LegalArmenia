-- Fix case files upload RLS by allowing case members to upload
-- This fixes the "new row violates row-level security policy" error when uploading case files

DO $$ 
DECLARE
  pol record;
BEGIN
  -- Drop existing insert policies on case_files (if it exists as a table in any environment)
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'case_files' AND schemaname = 'public' AND cmd = 'INSERT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.case_files', pol.policyname);
  END LOOP;

  -- Drop existing insert policies on app.client_documents
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'client_documents' AND schemaname = 'app' AND cmd = 'INSERT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON app.client_documents', pol.policyname);
  END LOOP;
END $$;


-- 1. Create a highly robust SECURITY DEFINER function to bypass any circular or missing RLS on underlying tables
CREATE OR REPLACE FUNCTION app.check_case_upload_access(_case_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM app.cases c WHERE c.case_id = _case_id
    AND (
      c.client_id = auth.uid() OR
      c.lawyer_id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM app.user_profiles
        WHERE user_id = auth.uid() AND app_role::text = 'admin'
      )
    )
  )
  OR EXISTS (
    SELECT 1 FROM app.case_members cm WHERE cm.case_id = _case_id AND cm.user_id = auth.uid()
  );
$$;

-- 2. Create INSERT policy on app.client_documents (live schema)
CREATE POLICY "Case members can upload documents" ON app.client_documents
FOR INSERT TO authenticated
WITH CHECK (
  app.check_case_upload_access(case_id)
);

-- 3. Update storage.objects policy to allow case members
DROP POLICY IF EXISTS "Case members can upload to case-files bucket" ON storage.objects;

CREATE POLICY "Case members can upload to case-files bucket"
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'case-files' AND
  app.check_case_upload_access((storage.foldername(name))[1]::uuid)
);
