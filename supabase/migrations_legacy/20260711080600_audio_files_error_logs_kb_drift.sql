-- P1: useAudioTranscriptions embeds `case_files!inner(...)` through
-- PostgREST, which needs a real FK from audio_transcriptions.file_id to the
-- base table of the case_files view (app.client_documents.doc_id).
delete from public.audio_transcriptions at
 where at.file_id is not null
   and not exists (select 1 from app.client_documents cd where cd.doc_id = at.file_id);

alter table public.audio_transcriptions
  add constraint audio_transcriptions_file_id_fkey
  foreign key (file_id) references app.client_documents(doc_id) on delete cascade;

-- Upload paths always set file_name/file_url; make it explicit so generated
-- types are truthful.
alter table app.client_documents
  alter column file_name set not null,
  alter column file_url set not null;

-- Schema drift the frontend depends on:
--  * ErrorLogs.tsx updates error_logs.resolved / resolved_at (runtime 400)
--  * AudioTranscriptionResult reads duration_seconds / reviewed_by
--  * KB editor types expect knowledge_base.category (kb_category enum),
--    content_text, article_number, source_name, version_date, is_active,
--    language and a kb_versions table.
alter table public.error_logs
  add column if not exists resolved boolean not null default false,
  add column if not exists resolved_at timestamptz;

alter table public.audio_transcriptions
  add column if not exists duration_seconds double precision,
  add column if not exists reviewed_by uuid;

do $$ begin
  create type public.kb_category as enum (
    'constitution','civil_code','civil_procedure_code','criminal_code',
    'criminal_procedure_code','administrative_procedure_code',
    'administrative_violations_code','judicial_code','labor_code','tax_code',
    'family_code','land_code','water_code','forest_code','subsoil_code',
    'electoral_code','penal_enforcement_code','eaeu_customs_code','echr',
    'cassation_criminal','cassation_civil','cassation_administrative',
    'constitutional_court_decisions','echr_judgments','government_decisions',
    'central_electoral_commission_decisions','prime_minister_decisions',
    'arlis_am','datalex_am','ministry_of_health',
    'statistics_registry_decisions','other'
  );
exception when duplicate_object then null;
end $$;

alter type public.kb_category add value if not exists 'administrative_code';
alter type public.kb_category add value if not exists 'court_practice';
alter type public.kb_category add value if not exists 'legal_commentary';
alter type public.kb_category add value if not exists 'urban_planning_code';
alter type public.kb_category add value if not exists 'state_duty_law';
alter type public.kb_category add value if not exists 'citizenship_law';
alter type public.kb_category add value if not exists 'public_service_law';
alter type public.kb_category add value if not exists 'human_rights_law';
alter type public.kb_category add value if not exists 'anti_corruption_body_law';
alter type public.kb_category add value if not exists 'corruption_prevention_law';
alter type public.kb_category add value if not exists 'mass_media_law';
alter type public.kb_category add value if not exists 'education_law';
alter type public.kb_category add value if not exists 'healthcare_law';

alter table public.knowledge_base
  add column if not exists category public.kb_category,
  add column if not exists content_text text,
  add column if not exists article_number text,
  add column if not exists source_name text,
  add column if not exists version_date date,
  add column if not exists language text,
  add column if not exists is_active boolean not null default true;

create table if not exists public.kb_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.knowledge_base(id) on delete cascade,
  version_number integer not null default 1,
  content_text text,
  change_reason text,
  created_at timestamptz not null default now(),
  title text,
  changed_at timestamptz not null default now()
);

alter table public.kb_versions enable row level security;

drop policy if exists kb_versions_service on public.kb_versions;
create policy kb_versions_service on public.kb_versions
  for all to service_role using (true) with check (true);

drop policy if exists kb_versions_read on public.kb_versions;
create policy kb_versions_read on public.kb_versions
  for select to authenticated using (true);

grant select on public.kb_versions to authenticated;
grant all on public.kb_versions to service_role;
