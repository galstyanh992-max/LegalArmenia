-- =============================================================================
-- Fix: can_read_case missing client_id check
--
-- Root cause: app.can_read_case() checked admin, is_case_lawyer, is_case_member
-- but NOT cases.client_id = auth.uid(). The INSERT policy (check_case_upload_access)
-- DID check client_id, so a client could upload files but not see them ?
-- the uploaded file appeared to succeed (toast: "File uploaded successfully")
-- but was invisible in the file list because SELECT RLS blocked the query.
--
-- This fix adds: OR EXISTS (SELECT 1 FROM app.cases c WHERE c.case_id = p_case_id AND c.client_id = auth.uid())
-- =============================================================================

CREATE OR REPLACE FUNCTION app.can_read_case(p_case_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'app', 'public', 'auth'
AS $$
  SELECT app.get_my_role() = 'admin'
    OR app.is_case_lawyer(p_case_id)
    OR app.is_case_member(p_case_id)
    OR EXISTS (
      SELECT 1 FROM app.cases c
      WHERE c.case_id = p_case_id
        AND c.client_id = auth.uid()
    )
$$;
