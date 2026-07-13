-- Forward migration: Storage path isolation and deterministic bucket constraints.
-- Source: SECURITY_BASELINE_REQUIRED.

begin;

-- Fix case-files bucket upload failures.
--
-- 1) case_files_object_case_id() threw "invalid input syntax for type uuid"
--    whenever an object path's first folder was not a UUID, turning every
--    storage call touching such a path into a hard 400 for ALL policies.
--    Make it return NULL for non-UUID folders instead.
--
-- 2) The "Case members can upload" storage policy cast the first folder to
--    uuid inline, with the same failure mode. Route it through the hardened
--    helper.
--
-- 3) User-scoped temp uploads were only allowed under <uid>/autofill/, but
--    the app also writes <uid>/complaints/ (ComplaintWizard OCR) and
--    <uid>/standalone/ (standalone audio transcription). Those uploads were
--    RLS-denied for every role. Widen the user-folder policies to the three
--    known subfolders, still scoped to auth.uid() as the first folder.

CREATE OR REPLACE FUNCTION public.case_files_object_case_id(object_name text)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
AS $function$
  select case
    when (storage.foldername(object_name))[1]
         ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      then (storage.foldername(object_name))[1]::uuid
    else null
  end;
$function$;

DROP POLICY IF EXISTS "Case members can upload to case-files bucket" ON storage.objects;
CREATE POLICY "Case members can upload to case-files bucket"
ON storage.objects
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'case-files'
  AND app.check_case_upload_access(public.case_files_object_case_id(name))
);

DROP POLICY IF EXISTS "Users can upload autofill files" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their autofill files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their autofill files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload to their user folder" ON storage.objects;

CREATE POLICY "Users can upload to their user folder"
ON storage.objects
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'case-files'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND (storage.foldername(name))[2] IN ('autofill', 'complaints', 'standalone')
);

DROP POLICY IF EXISTS "Users can view their user folder files" ON storage.objects;

CREATE POLICY "Users can view their user folder files"
ON storage.objects
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  bucket_id = 'case-files'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND (storage.foldername(name))[2] IN ('autofill', 'complaints', 'standalone')
);

DROP POLICY IF EXISTS "Users can delete their user folder files" ON storage.objects;

CREATE POLICY "Users can delete their user folder files"
ON storage.objects
AS PERMISSIVE
FOR DELETE
TO authenticated
USING (
  bucket_id = 'case-files'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND (storage.foldername(name))[2] IN ('autofill', 'complaints', 'standalone')
);


-- =============================================================================
-- SEC-2: Server-side MIME enforcement for case-files storage bucket
--
-- Issue: Bucket allowed_mime_types was NULL, allowing any MIME type upload.
-- Fix: Set allowed_mime_types to match centralized uploadPolicies.ts allowlist.
--
-- This is a defense-in-depth layer. Client-side validation in uploadPolicies.ts
-- remains the primary gate. The bucket MIME restriction blocks direct API
-- uploads with disallowed types (e.g., application/x-msdownload, text/html).
--
-- NOTE: Supabase Storage validates the Content-Type header, not file content.
-- A malicious actor could claim a valid MIME type while uploading malicious
-- content. This is mitigated by:
--   1. RLS: only case members can upload to case paths
--   2. Frontend: uploadPolicies.ts normalizes Content-Type from file extension
--   3. AI processing: OCR/AI functions download and process, not execute files
-- =============================================================================

-- Update the case-files bucket to enforce allowed MIME types
UPDATE storage.buckets
SET
  allowed_mime_types = ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'image/tiff',
    'audio/mpeg',
    'audio/wav',
    'audio/mp4',
    'audio/ogg',
    'text/plain',
    'text/markdown'
  ],
  file_size_limit = 52428800 -- 50MB (matches CASE_FILE_MAX_BYTES)
WHERE id = 'case-files';

-- Verify the update
DO $$
DECLARE
  v_mime_types text[];
  v_size_limit bigint;
BEGIN
  SELECT allowed_mime_types, file_size_limit
  INTO v_mime_types, v_size_limit
  FROM storage.buckets
  WHERE id = 'case-files';

  IF v_mime_types IS NULL THEN
    RAISE EXCEPTION 'SEC-2 FAILED: allowed_mime_types is still NULL after update';
  END IF;

  IF array_length(v_mime_types, 1) < 12 THEN
    RAISE EXCEPTION 'SEC-2 FAILED: expected 12 MIME types, got %', array_length(v_mime_types, 1);
  END IF;

  IF v_size_limit != 52428800 THEN
    RAISE EXCEPTION 'SEC-2 FAILED: file_size_limit expected 52428800, got %', v_size_limit;
  END IF;

  RAISE NOTICE 'SEC-2 VERIFIED: % MIME types set, size limit = % bytes', array_length(v_mime_types, 1), v_size_limit;
END $$;


commit;
