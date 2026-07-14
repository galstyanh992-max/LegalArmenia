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
