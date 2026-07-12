-- =============================================================================
-- Fix: ocr_results and audio_transcriptions tables missing from live DB
-- Issue E2E-1-F1: Tables were created in migration 20260124125739 but never
-- applied to the live Supabase DB (or were dropped). PostgREST schema cache
-- could not see them, so frontend queries to ocr_results/audio_transcriptions
-- returned "table not found in schema cache".
--
-- This migration recreates both tables with RLS policies and triggers a
-- PostgREST schema cache reload via NOTIFY pgrst.
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'ocr_results' AND table_schema = 'public') THEN
    CREATE TABLE public.ocr_results (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      file_id UUID,
      extracted_text TEXT,
      confidence FLOAT,
      language VARCHAR(20) DEFAULT 'unknown',
      needs_review BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX idx_ocr_text_gin ON public.ocr_results USING gin (to_tsvector('simple', extracted_text));
    ALTER TABLE public.ocr_results ENABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'ocr_results table recreated';
  ELSE
    RAISE NOTICE 'ocr_results table already exists';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'audio_transcriptions' AND table_schema = 'public') THEN
    CREATE TABLE public.audio_transcriptions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      file_id UUID,
      transcription_text TEXT,
      confidence FLOAT,
      language VARCHAR(20) DEFAULT 'unknown',
      needs_review BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    ALTER TABLE public.audio_transcriptions ENABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'audio_transcriptions table recreated';
  ELSE
    RAISE NOTICE 'audio_transcriptions table already exists';
  END IF;
END $$;

-- RLS policies for ocr_results
DROP POLICY IF EXISTS "Users can view OCR of their files" ON public.ocr_results;
DROP POLICY IF EXISTS "Admins can view all OCR" ON public.ocr_results;
DROP POLICY IF EXISTS "Lawyers can create OCR results" ON public.ocr_results;
DROP POLICY IF EXISTS "Case members can insert OCR results" ON public.ocr_results;

CREATE POLICY "Users can view OCR of their files"
  ON public.ocr_results FOR SELECT TO authenticated
  USING (
    file_id IN (
      SELECT cf.id FROM public.case_files cf
      JOIN public.cases c ON cf.case_id = c.id
      WHERE c.lawyer_id = auth.uid() OR c.client_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Case members can insert OCR results"
ON public.ocr_results AS PERMISSIVE FOR INSERT TO authenticated
WITH CHECK (
  file_id IN (
    SELECT cf.id FROM public.case_files cf
    JOIN public.cases c ON c.id = cf.case_id
    WHERE cf.deleted_at IS NULL AND (
      c.lawyer_id = auth.uid() OR c.client_id = auth.uid()
    )
  )
  OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- RLS policies for audio_transcriptions
DROP POLICY IF EXISTS "Users can view audio transcriptions of their files" ON public.audio_transcriptions;
DROP POLICY IF EXISTS "Admins can view all audio transcriptions" ON public.audio_transcriptions;
DROP POLICY IF EXISTS "Case members can insert audio transcriptions" ON public.audio_transcriptions;

CREATE POLICY "Users can view audio transcriptions of their files"
  ON public.audio_transcriptions FOR SELECT TO authenticated
  USING (
    file_id IN (
      SELECT cf.id FROM public.case_files cf
      JOIN public.cases c ON cf.case_id = c.id
      WHERE c.lawyer_id = auth.uid() OR c.client_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Case members can insert audio transcriptions"
ON public.audio_transcriptions AS PERMISSIVE FOR INSERT TO authenticated
WITH CHECK (
  file_id IN (
    SELECT cf.id FROM public.case_files cf
    JOIN public.cases c ON c.id = cf.case_id
    WHERE cf.deleted_at IS NULL AND (
      c.lawyer_id = auth.uid() OR c.client_id = auth.uid()
    )
  )
  OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
