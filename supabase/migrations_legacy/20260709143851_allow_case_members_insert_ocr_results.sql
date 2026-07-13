-- Allow OCR persistence from authenticated case members only for files they can access.
-- This fixes client-side OCR result save failures without allowing cross-case inserts.

DROP POLICY IF EXISTS "Case members can insert OCR results" ON public.ocr_results;

CREATE POLICY "Case members can insert OCR results"
ON public.ocr_results
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  file_id IN (
    SELECT cf.id
    FROM public.case_files cf
    JOIN public.cases c ON c.id = cf.case_id
    WHERE cf.deleted_at IS NULL
      AND (
        c.lawyer_id = auth.uid()
        OR c.client_id = auth.uid()
        OR c.lawyer_id IN (SELECT public.get_team_member_ids(auth.uid()))
        OR public.has_role(auth.uid(), 'admin'::app_role)
      )
  )
);
