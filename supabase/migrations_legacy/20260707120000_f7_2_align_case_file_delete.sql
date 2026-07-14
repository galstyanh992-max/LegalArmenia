-- =============================================================================
-- F7.2 — Align case-file DELETE authorization: DB row (app.client_documents)
--        with storage object (storage.objects, bucket 'case-files').
-- =============================================================================
-- Live model:
--   * public.case_files is a VIEW over app.client_documents; hard DELETE flows
--     through the INSTEAD OF DELETE trigger -> DELETE on app.client_documents,
--     governed by RLS policy app.client_documents.cd_delete.
--   * Storage deletes are governed by storage.objects.case_files_delete.
--
-- BEFORE (misaligned — disjoint except admin):
--   cd_delete           : admin OR uploaded_by = auth.uid()          (uploader+admin, NO lawyer)
--   case_files_delete   : admin OR app.is_case_lawyer(case_id)       (lawyer+admin,  NO uploader)
--   => lawyer could delete the object but not the row (PARTIAL/LEAK);
--      uploader could delete the row but not the object.
--
-- AFTER (identical principal set {uploader, case lawyer, admin} on both sides):
--   both = uploaded_by/owner = auth.uid()  OR  app.can_manage_case(case_id)
--   where app.can_manage_case = (admin OR is_case_lawyer).  Members/clients and
--   outsiders are denied on BOTH sides.
--
-- Order-independent: neither predicate depends on the app.client_documents row
-- surviving (storage uses object `owner` + case_id parsed from the object name),
-- so no ordering of the two client-side deletes can ever leave
-- "storage object deleted while DB row remains".
-- =============================================================================

-- ── DB side: app.client_documents DELETE — add case lawyer (via can_manage_case)
ALTER POLICY cd_delete ON app.client_documents
  USING (
    uploaded_by = auth.uid()
    OR app.can_manage_case(case_id)
  );

-- ── Storage side: case-files DELETE — add uploader (via object owner) ─────────
ALTER POLICY case_files_delete ON storage.objects
  USING (
    bucket_id = 'case-files'
    AND (
      owner = auth.uid()
      OR app.can_manage_case(public.case_files_object_case_id(name))
    )
  );
