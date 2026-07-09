-- Fix case form autofill upload path in the remote F7 compatibility schema.
-- public.cases/public.case_files are views in the live project; storage autofill
-- files use <userId>/autofill/<file>, not <caseId>/<file>.

DROP POLICY IF EXISTS "Users can upload autofill files" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their autofill files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their autofill files" ON storage.objects;

CREATE POLICY "Users can upload autofill files"
ON storage.objects
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'case-files'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND (storage.foldername(name))[2] = 'autofill'
);

CREATE POLICY "Users can view their autofill files"
ON storage.objects
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  bucket_id = 'case-files'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND (storage.foldername(name))[2] = 'autofill'
);

CREATE POLICY "Users can delete their autofill files"
ON storage.objects
AS PERMISSIVE
FOR DELETE
TO authenticated
USING (
  bucket_id = 'case-files'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND (storage.foldername(name))[2] = 'autofill'
);
