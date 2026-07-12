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
