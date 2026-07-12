-- Make the public.cases compatibility view accept the full case form payload.
-- The live schema stores cases in app.cases and exposes public.cases as a view.
-- Columns that were constants/expressions in the view are not insertable through
-- PostgREST, so they must exist on app.cases and be selected directly.

ALTER TABLE app.cases
  ADD COLUMN IF NOT EXISTS client_id uuid,
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS court_date timestamptz,
  ADD COLUMN IF NOT EXISTS party_role text,
  ADD COLUMN IF NOT EXISTS appeal_party_role text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE app.cases
  ALTER COLUMN created_by SET DEFAULT auth.uid();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'app_cases_priority_check'
      AND conrelid = 'app.cases'::regclass
  ) THEN
    ALTER TABLE app.cases
      ADD CONSTRAINT app_cases_priority_check
      CHECK (priority IN ('low', 'medium', 'high', 'urgent'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'app_cases_appeal_party_role_check'
      AND conrelid = 'app.cases'::regclass
  ) THEN
    ALTER TABLE app.cases
      ADD CONSTRAINT app_cases_appeal_party_role_check
      CHECK (appeal_party_role IS NULL OR appeal_party_role IN ('appellant', 'respondent'));
  END IF;
END $$;

CREATE OR REPLACE VIEW public.cases
WITH (security_invoker = true)
AS
SELECT
  c.case_id AS id,
  c.case_number,
  c.title,
  c.description,
  c.status,
  c.priority,
  c.lawyer_id,
  c.client_id,
  c.case_type,
  c.current_stage,
  c.court_name,
  c.court_date,
  c.facts,
  c.legal_question,
  c.deleted_at,
  c.created_at,
  c.updated_at,
  c.court_name AS court,
  c.party_role,
  c.appeal_party_role,
  c.notes
FROM app.cases c;

REVOKE ALL ON public.cases FROM PUBLIC;
REVOKE ALL ON public.cases FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cases TO authenticated;
