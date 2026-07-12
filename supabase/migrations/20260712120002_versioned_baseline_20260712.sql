-- VERSIONED BASELINE 20260712
-- Fresh disposable/new environments only.
-- PROHIBITED: applying this migration to the existing production project.
-- Sources: AUDIT_REPORTS/16_PRODUCTION_SCHEMA_BASELINE.md through 19_MIGRATION_REPAIR_STRATEGY.md
-- Object sources: PRODUCTION_RUNTIME_REQUIRED, APPLICATION_CONTRACT_REQUIRED,
-- SECURITY_BASELINE_REQUIRED, COMPATIBILITY_REQUIRED.

set check_function_bodies = false;

-- Required extensions [APPLICATION_CONTRACT_REQUIRED]
create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists pg_trgm with schema public;
create extension if not exists vector with schema public;

-- Application schemas [PRODUCTION_RUNTIME_REQUIRED]
create schema if not exists app;
create schema if not exists internal;

-- Application enum types [PRODUCTION_RUNTIME_REQUIRED]
create type app.app_role as enum ('admin', 'lawyer', 'client');

create type app.multi_agent_run_status as enum ('queued', 'running', 'completed', 'failed', 'cancelled', 'timed_out');

create type public.content_domain as enum ('knowledge_base', 'practice', 'unknown');

create type public.kb_category as enum ('constitution', 'civil_code', 'civil_procedure_code', 'criminal_code', 'criminal_procedure_code', 'administrative_procedure_code', 'administrative_violations_code', 'judicial_code', 'labor_code', 'tax_code', 'family_code', 'land_code', 'water_code', 'forest_code', 'subsoil_code', 'electoral_code', 'penal_enforcement_code', 'eaeu_customs_code', 'echr', 'cassation_criminal', 'cassation_civil', 'cassation_administrative', 'constitutional_court_decisions', 'echr_judgments', 'government_decisions', 'central_electoral_commission_decisions', 'prime_minister_decisions', 'arlis_am', 'datalex_am', 'ministry_of_health', 'statistics_registry_decisions', 'other', 'administrative_code', 'court_practice', 'legal_commentary', 'urban_planning_code', 'state_duty_law', 'citizenship_law', 'public_service_law', 'human_rights_law', 'anti_corruption_body_law', 'corruption_prevention_law', 'mass_media_law', 'education_law', 'healthcare_law');

create type public.normalized_status as enum ('active', 'repealed', 'partially_active', 'draft', 'unknown');

-- Tables and RLS enablement [PRODUCTION_RUNTIME_REQUIRED]
create table app.ai_analysis_runs (
  run_id uuid default gen_random_uuid() not null,
  case_id uuid not null,
  triggered_by uuid,
  query_text text,
  result_jsonb jsonb,
  model_used text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
alter table app.ai_analysis_runs enable row level security;

create table app.case_members (
  case_member_id uuid default gen_random_uuid() not null,
  case_id uuid not null,
  user_id uuid not null,
  case_role text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
alter table app.case_members enable row level security;

create table app.case_messages (
  message_id uuid default gen_random_uuid() not null,
  case_id uuid not null,
  sender_id uuid,
  body text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
alter table app.case_messages enable row level security;

create table app.cases (
  case_id uuid default gen_random_uuid() not null,
  title text not null,
  description text,
  status text default 'open'::text not null,
  created_by uuid default auth.uid() not null,
  lawyer_id uuid not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  case_number text,
  case_type text,
  facts text,
  legal_question text,
  current_stage text,
  court_name text,
  client_id uuid,
  priority text default 'medium'::text not null,
  court_date timestamp with time zone,
  party_role text,
  appeal_party_role text,
  notes text,
  deleted_at timestamp with time zone
);
alter table app.cases enable row level security;

create table app.client_documents (
  doc_id uuid default gen_random_uuid() not null,
  case_id uuid not null,
  uploaded_by uuid,
  file_name text not null,
  file_url text not null,
  file_size bigint,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
alter table app.client_documents enable row level security;

create table app.generated_documents (
  generated_id uuid default gen_random_uuid() not null,
  case_id uuid,
  created_by uuid,
  template text,
  content text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  metadata jsonb default '{}'::jsonb
);
alter table app.generated_documents enable row level security;

create table app.legal_decisions (
  id uuid default gen_random_uuid() not null,
  case_id uuid not null,
  version_hash text not null,
  decision_status text not null,
  decision_data jsonb not null,
  source_pipeline_version text,
  created_by uuid,
  created_at timestamp with time zone default now() not null,
  supersedes_decision_id uuid,
  is_latest boolean default true not null
);
alter table app.legal_decisions enable row level security;

create table app.multi_agent_analysis_runs (
  run_id uuid default gen_random_uuid() not null,
  case_id uuid not null,
  requested_by uuid not null,
  agent_type text not null,
  idempotency_key text not null,
  input_payload jsonb default '{}'::jsonb not null,
  status app.multi_agent_run_status default 'queued'::app.multi_agent_run_status not null,
  progress integer default 0 not null,
  current_step text,
  result jsonb,
  error_code text,
  error_message text,
  attempt_count integer default 0 not null,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  cancelled_at timestamp with time zone,
  timed_out_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
alter table app.multi_agent_analysis_runs enable row level security;

create table app.user_profiles (
  user_id uuid default gen_random_uuid() not null,
  full_name text,
  email text,
  app_role app.app_role not null,
  is_active boolean default true not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  username text,
  auditor_id uuid
);
alter table app.user_profiles enable row level security;

create table internal.ai_metrics (
  metric_id uuid default gen_random_uuid() not null,
  fn_name text not null,
  model text,
  input_tokens integer default 0 not null,
  output_tokens integer default 0 not null,
  total_tokens integer generated always as ((input_tokens + output_tokens)) stored,
  cost_usd numeric(12,6) default 0 not null,
  latency_ms integer,
  status text default 'success'::text not null,
  error_message text,
  case_id uuid,
  user_id uuid,
  created_at timestamp with time zone default now() not null
);
alter table internal.ai_metrics enable row level security;

create table internal.extraction_runs (
  run_id uuid default gen_random_uuid() not null,
  source_file_id uuid not null,
  extraction_tool text,
  extraction_status text not null,
  errors jsonb default '[]'::jsonb not null,
  traceback text,
  extracted_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
alter table internal.extraction_runs enable row level security;

create table internal.ingestion_jobs (
  job_id uuid default gen_random_uuid() not null,
  source_file_path text not null,
  started_at timestamp with time zone default now() not null,
  completed_at timestamp with time zone,
  status text default 'running'::text not null,
  total_records integer default 0 not null,
  failed_records integer default 0 not null,
  report_jsonb jsonb default '{}'::jsonb not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
alter table internal.ingestion_jobs enable row level security;

create table internal.source_files (
  source_file_id uuid default gen_random_uuid() not null,
  job_id uuid,
  raw_record jsonb,
  source_path text,
  source_url text,
  file_size_bytes bigint,
  file_sha256 text,
  raw_record_sha256 text,
  text_sha256 text,
  quarantined boolean default false not null,
  quarantine_reason text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
alter table internal.source_files enable row level security;

create table public.agent_analysis_runs (
  id uuid default gen_random_uuid() not null,
  case_id uuid not null,
  agent_type text not null,
  status text default 'pending'::text not null,
  summary text,
  analysis_result jsonb,
  started_at timestamp with time zone default now(),
  completed_at timestamp with time zone,
  tokens_used integer default 0,
  error_message text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  findings jsonb default '[]'::jsonb not null,
  sources_used jsonb default '[]'::jsonb not null
);
alter table public.agent_analysis_runs enable row level security;

create table public.agent_findings (
  id uuid default gen_random_uuid() not null,
  case_id uuid not null,
  agent_run_id uuid,
  title text not null,
  description text,
  severity text default 'medium'::text,
  finding_type text,
  legal_basis jsonb default '[]'::jsonb,
  recommendation text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  evidence_refs jsonb default '[]'::jsonb not null,
  page_references jsonb default '[]'::jsonb not null
);
alter table public.agent_findings enable row level security;

create table public.aggregated_reports (
  id uuid default gen_random_uuid() not null,
  case_id uuid not null,
  report_type text default 'full'::text,
  title text,
  executive_summary text,
  evidence_summary text,
  violations_summary text,
  defense_strategy text,
  prosecution_weaknesses text,
  recommendations text,
  full_report text,
  statistics jsonb,
  data_gaps jsonb default '[]'::jsonb,
  warnings jsonb default '[]'::jsonb,
  generated_at timestamp with time zone default now() not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  agent_runs jsonb default '[]'::jsonb not null
);
alter table public.aggregated_reports enable row level security;

create table public.ai_prompt_versions (
  id uuid default gen_random_uuid() not null,
  prompt_id uuid not null,
  version_number integer not null,
  prompt_text text not null,
  change_reason text,
  changed_at timestamp with time zone default now() not null
);
alter table public.ai_prompt_versions enable row level security;

create table public.ai_prompts (
  id uuid default gen_random_uuid() not null,
  function_name text not null,
  module_type text not null,
  name_hy text default ''::text not null,
  name_ru text default ''::text not null,
  name_en text,
  description text,
  prompt_text text not null,
  is_active boolean default true not null,
  current_version integer default 1 not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
alter table public.ai_prompts enable row level security;

create table public.app_settings (
  key text not null,
  value text,
  updated_at timestamp with time zone default now() not null
);
alter table public.app_settings enable row level security;

create table public.audio_transcriptions (
  id uuid default gen_random_uuid() not null,
  file_id uuid,
  transcription_text text,
  confidence double precision,
  language character varying(20) default 'unknown'::character varying,
  needs_review boolean default false,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  duration_seconds double precision,
  reviewed_by uuid
);
alter table public.audio_transcriptions enable row level security;

create table public.audit_logs (
  id uuid default gen_random_uuid() not null,
  user_id uuid,
  action text not null,
  table_name text,
  record_id uuid,
  details jsonb,
  created_at timestamp with time zone default now() not null
);
alter table public.audit_logs enable row level security;

create table public.authorities (
  authority_id uuid default gen_random_uuid() not null,
  name_raw text not null,
  name_normalized text,
  authority_type text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
alter table public.authorities enable row level security;

create table public.case_comments (
  id uuid default gen_random_uuid() not null,
  case_id uuid not null,
  author_id uuid not null,
  content text not null,
  is_internal boolean default true not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
alter table public.case_comments enable row level security;

create table public.case_parties (
  case_party_id uuid default gen_random_uuid() not null,
  court_case_id uuid not null,
  party_id uuid not null,
  party_role text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
alter table public.case_parties enable row level security;

create table public.case_volumes (
  id uuid default gen_random_uuid() not null,
  case_id uuid not null,
  file_id uuid,
  volume_number integer,
  title text,
  ocr_text text,
  metadata jsonb default '{}'::jsonb not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
alter table public.case_volumes enable row level security;

create table public.chat_messages (
  id uuid default gen_random_uuid() not null,
  chat_id uuid not null,
  role text not null,
  content text not null,
  sources jsonb,
  created_at timestamp with time zone default now() not null
);
alter table public.chat_messages enable row level security;

create table public.chats (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  title text default 'Новый чат'::text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
alter table public.chats enable row level security;

create table public.court_cases (
  court_case_id uuid default gen_random_uuid() not null,
  document_id uuid,
  case_number text,
  court_name text,
  hearing_date date,
  verdict_date date,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
alter table public.court_cases enable row level security;

create table public.document_pages (
  page_id uuid default gen_random_uuid() not null,
  version_id uuid not null,
  page_number integer not null,
  page_text text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
alter table public.document_pages enable row level security;

create table public.document_references (
  reference_id uuid default gen_random_uuid() not null,
  from_document_id uuid not null,
  to_document_id uuid,
  reference_type text,
  reference_text text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
alter table public.document_references enable row level security;

create table public.document_table_cells (
  cell_id uuid default gen_random_uuid() not null,
  table_id uuid not null,
  row_idx integer not null,
  col_idx integer not null,
  value_raw text,
  value_norm text,
  value_type text default 'text'::text,
  cell_confidence numeric
);
alter table public.document_table_cells enable row level security;

create table public.document_tables (
  table_id uuid default gen_random_uuid() not null,
  document_id uuid not null,
  version_id uuid not null,
  page_from integer,
  page_to integer,
  index_on_page integer,
  n_rows integer,
  n_cols integer,
  headers jsonb,
  table_markdown text,
  source_sha256 text,
  extraction_tool text,
  extraction_confidence numeric,
  table_class text default 'unknown'::text,
  needs_human_review boolean default true not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
alter table public.document_tables enable row level security;

create table public.document_templates (
  id uuid default gen_random_uuid() not null,
  category text not null,
  subcategory text,
  name_hy text default ''::text not null,
  name_ru text default ''::text not null,
  name_en text,
  description text,
  required_fields jsonb default '[]'::jsonb not null,
  template_text text,
  is_active boolean default true not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
alter table public.document_templates enable row level security;

create table public.document_topics (
  document_topic_id uuid default gen_random_uuid() not null,
  document_id uuid not null,
  topic_id uuid not null,
  assigned_by text,
  confidence numeric,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
alter table public.document_topics enable row level security;

create table public.document_types (
  document_type_id uuid default gen_random_uuid() not null,
  code text not null,
  label_hy text,
  label_ru text,
  label_en text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
alter table public.document_types enable row level security;

create table public.document_versions (
  version_id uuid default gen_random_uuid() not null,
  document_id uuid not null,
  version_number integer not null,
  source_file_id uuid,
  full_text text,
  text_sha256 text,
  page_count integer,
  language_code text default 'hy'::text not null,
  is_current boolean default true not null,
  publication_source_id uuid,
  published_at date,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
alter table public.document_versions enable row level security;

create table public.documents (
  document_id uuid default gen_random_uuid() not null,
  canonical_key text,
  arlis_doc_id text,
  document_type_id uuid,
  jurisdiction_id uuid,
  content_domain content_domain default 'unknown'::content_domain not null,
  title_hy text,
  title_ru text,
  title_en text,
  doc_number_raw text,
  doc_number_clean text,
  issued_date date,
  effective_from date,
  effective_to date,
  raw_status text,
  normalized_status normalized_status default 'unknown'::normalized_status not null,
  quality_flags jsonb default '[]'::jsonb not null,
  needs_human_review boolean default false not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  source_metadata jsonb
);
alter table public.documents enable row level security;

create table public.embeddings (
  embedding_id uuid default gen_random_uuid() not null,
  chunk_id uuid not null,
  model text not null,
  dimension integer not null,
  vector vector(1024),
  chunk_text_sha256 text,
  status text default 'pending'::text not null,
  error_message text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
alter table public.embeddings enable row level security;

create table public.error_logs (
  id uuid default gen_random_uuid() not null,
  user_id uuid,
  error_type text,
  error_message text,
  error_stack text,
  context jsonb,
  created_at timestamp with time zone default now() not null,
  resolved boolean default false not null,
  resolved_at timestamp with time zone
);
alter table public.error_logs enable row level security;

create table public.evidence_registry (
  id uuid default gen_random_uuid() not null,
  case_id uuid not null,
  evidence_number integer,
  title text,
  evidence_type text,
  admissibility_status text default 'pending'::text,
  description text,
  ai_analysis text,
  admissibility_notes text,
  page_reference text,
  source_document text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  metadata jsonb
);
alter table public.evidence_registry enable row level security;

create table public.fragment_translations (
  translation_id uuid default gen_random_uuid() not null,
  chunk_id uuid not null,
  source_lang text not null,
  target_lang text default 'hy'::text not null,
  source_sha256 text not null,
  translated_text text not null,
  model text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
alter table public.fragment_translations enable row level security;

create table public.judges (
  judge_id uuid default gen_random_uuid() not null,
  name_raw text,
  name_normalized text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
alter table public.judges enable row level security;

create table public.jurisdictions (
  jurisdiction_id uuid default gen_random_uuid() not null,
  code text not null,
  name_hy text,
  name_ru text,
  name_en text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
alter table public.jurisdictions enable row level security;

create table public.kb_versions (
  id uuid default gen_random_uuid() not null,
  document_id uuid not null,
  version_number integer default 1 not null,
  content_text text,
  change_reason text,
  created_at timestamp with time zone default now() not null,
  title text,
  changed_at timestamp with time zone default now() not null
);
alter table public.kb_versions enable row level security;

create table public.knowledge_base (
  id uuid default gen_random_uuid() not null,
  document_id uuid,
  chunk_id uuid,
  title text,
  content text,
  source_url text,
  metadata jsonb default '{}'::jsonb not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  category kb_category,
  content_text text,
  article_number text,
  source_name text,
  version_date date,
  language text,
  is_active boolean default true not null
);
alter table public.knowledge_base enable row level security;

create table public.knowledge_document_profiles (
  profile_id uuid default gen_random_uuid() not null,
  document_id uuid not null,
  has_articles boolean,
  has_chapters boolean,
  classifier_confidence numeric,
  classifier_method text,
  classified_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
alter table public.knowledge_document_profiles enable row level security;

create table public.legal_documents (
  id uuid default gen_random_uuid() not null,
  document_id uuid,
  chunk_id uuid,
  title text,
  content text,
  source_url text,
  metadata jsonb default '{}'::jsonb not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
alter table public.legal_documents enable row level security;

create table public.legal_edges (
  edge_id uuid default gen_random_uuid() not null,
  from_document_id uuid not null,
  to_document_id uuid,
  edge_type text not null,
  source text,
  confidence numeric,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
alter table public.legal_edges enable row level security;

create table public.legal_units (
  unit_id uuid default gen_random_uuid() not null,
  document_id uuid not null,
  version_id uuid not null,
  parent_unit_id uuid,
  unit_type text,
  unit_number text,
  unit_title text,
  unit_text text,
  sort_order integer,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
alter table public.legal_units enable row level security;

create table public.notifications (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  reminder_id uuid,
  title text not null,
  message text,
  is_read boolean default false not null,
  notification_type text default 'general'::text not null,
  created_at timestamp with time zone default now() not null
);
alter table public.notifications enable row level security;

create table public.ocr_results (
  id uuid default gen_random_uuid() not null,
  file_id uuid,
  extracted_text text,
  confidence double precision,
  language character varying(20) default 'unknown'::character varying,
  needs_review boolean default false,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
alter table public.ocr_results enable row level security;

create table public.parties (
  party_id uuid default gen_random_uuid() not null,
  name_raw text not null,
  party_type text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
alter table public.parties enable row level security;

create table public.practice_document_profiles (
  profile_id uuid default gen_random_uuid() not null,
  document_id uuid not null,
  case_number text,
  court_level text,
  verdict_type text,
  classifier_confidence numeric,
  classifier_method text,
  classified_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
alter table public.practice_document_profiles enable row level security;

create table public.practice_to_knowledge_references (
  ref_id uuid default gen_random_uuid() not null,
  practice_doc_id uuid not null,
  knowledge_doc_id uuid,
  reference_text text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
alter table public.practice_to_knowledge_references enable row level security;

create table public.profile_compat_settings (
  user_id uuid not null,
  telegram_chat_id text,
  notification_preferences jsonb default '{}'::jsonb not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
alter table public.profile_compat_settings enable row level security;

create table public.publication_sources (
  source_id uuid default gen_random_uuid() not null,
  name text not null,
  source_type text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
alter table public.publication_sources enable row level security;

create table public.reminders (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  case_id uuid,
  title text not null,
  description text,
  reminder_type text default 'other'::text not null,
  priority text default 'medium'::text not null,
  event_datetime timestamp with time zone not null,
  notify_before integer[] default '{60}'::integer[] not null,
  status text default 'active'::text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
alter table public.reminders enable row level security;

create table public.search_chunks (
  chunk_id uuid default gen_random_uuid() not null,
  chunk_key text not null,
  document_id uuid not null,
  version_id uuid not null,
  legal_unit_id uuid,
  text text not null,
  token_count integer,
  page_from integer,
  page_to integer,
  char_start integer,
  char_end integer,
  language_code text default 'hy'::text not null,
  content_domain content_domain default 'unknown'::content_domain not null,
  norm_status normalized_status default 'unknown'::normalized_status not null,
  effective_from date,
  effective_to date,
  source_url text,
  citation_anchor text,
  chunk_text_sha256 text not null,
  fts_vector tsvector generated always as (to_tsvector('simple'::regconfig, COALESCE(text, ''::text))) stored,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  source_document_id uuid,
  legal_unit_type text,
  legal_unit_number text,
  parent_legal_unit_id uuid,
  article_number text,
  part_number text,
  point_number text,
  paragraph_number text,
  legal_status text,
  source_date date,
  normalized_title text,
  normalized_domain text,
  language text,
  chunk_quality_flags jsonb default '{}'::jsonb not null,
  chunk_version text default 'legacy_sentence_v1'::text
);
alter table public.search_chunks enable row level security;

create table public.search_chunks_legal_unit (
  chunk_id uuid default gen_random_uuid() not null,
  chunk_key text not null,
  source_document_id uuid not null,
  document_id uuid not null,
  version_id uuid not null,
  legacy_chunk_id uuid,
  legal_unit_id uuid,
  legal_unit_type text,
  legal_unit_number text,
  parent_legal_unit_id uuid,
  article_number text,
  part_number text,
  point_number text,
  paragraph_number text,
  text text not null,
  token_count integer not null,
  page_from integer,
  page_to integer,
  char_start integer not null,
  char_end integer not null,
  language text,
  language_code text,
  content_domain content_domain,
  normalized_domain text,
  norm_status normalized_status,
  legal_status text,
  effective_from date,
  effective_to date,
  source_date date,
  source_url text,
  citation_anchor text,
  normalized_title text,
  chunk_quality_flags jsonb default '{}'::jsonb not null,
  chunk_text_sha256 text not null,
  chunk_version text default 'legal_unit_v1'::text not null,
  fts_vector tsvector generated always as (to_tsvector('simple'::regconfig, text)) stored,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
alter table public.search_chunks_legal_unit enable row level security;

create table public.search_chunks_legal_unit_embeddings (
  embedding_id uuid default gen_random_uuid() not null,
  chunk_id uuid not null,
  chunk_text_sha256 text not null,
  provider text not null,
  model text not null,
  dimension integer not null,
  embedding vector(1024),
  status text default 'success'::text not null,
  error_message text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
alter table public.search_chunks_legal_unit_embeddings enable row level security;

create table public.team_members (
  id uuid default gen_random_uuid() not null,
  team_id uuid not null,
  user_id uuid not null,
  created_at timestamp with time zone default now() not null
);
alter table public.team_members enable row level security;

create table public.teams (
  id uuid default gen_random_uuid() not null,
  name text not null,
  description text,
  leader_id uuid not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
alter table public.teams enable row level security;

create table public.telegram_uploads (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  telegram_chat_id text not null,
  filename text,
  original_filename text,
  storage_path text,
  file_type text,
  file_size bigint,
  caption text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
alter table public.telegram_uploads enable row level security;

create table public.telegram_verification_codes (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  code text not null,
  expires_at timestamp with time zone not null,
  used_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
alter table public.telegram_verification_codes enable row level security;

create table public.topics (
  topic_id uuid default gen_random_uuid() not null,
  code text not null,
  label_hy text,
  label_ru text,
  label_en text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
alter table public.topics enable row level security;

create table public.user_feedback (
  id uuid default gen_random_uuid() not null,
  case_id uuid not null,
  analysis_id uuid,
  user_id uuid not null,
  rating integer not null,
  comment text,
  created_at timestamp with time zone default now() not null
);
alter table public.user_feedback enable row level security;

create table public.user_notes (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  title text default ''::text not null,
  content_html text default ''::text not null,
  content_text text default ''::text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
alter table public.user_notes enable row level security;

create table public.version_authorities (
  version_authority_id uuid default gen_random_uuid() not null,
  version_id uuid not null,
  authority_id uuid not null,
  authority_role text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
alter table public.version_authorities enable row level security;

-- Functions [PRODUCTION_RUNTIME_REQUIRED / APPLICATION_CONTRACT_REQUIRED]
CREATE OR REPLACE FUNCTION app.can_manage_case(p_case_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'app', 'public', 'auth'
AS $function$
  select app.get_my_role() = 'admin'
    or app.is_case_lawyer(p_case_id)
$function$;


CREATE OR REPLACE FUNCTION app.can_read_case(p_case_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'app', 'public', 'auth'
AS $function$
  select app.get_my_role() = 'admin'
    or app.is_case_lawyer(p_case_id)
    or app.is_case_member(p_case_id)
    or exists (
      select 1 from app.cases c
      where c.case_id = p_case_id
        and c.client_id = auth.uid()
    )
$function$;


CREATE OR REPLACE FUNCTION app.check_case_upload_access(_case_id uuid)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM app.cases c WHERE c.case_id = _case_id
    AND (
      c.client_id = auth.uid() OR
      c.lawyer_id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM app.user_profiles
        WHERE user_id = auth.uid() AND app_role::text = 'admin'
      )
    )
  )
  OR EXISTS (
    SELECT 1 FROM app.case_members cm WHERE cm.case_id = _case_id AND cm.user_id = auth.uid()
  );
$function$;


CREATE OR REPLACE FUNCTION app.get_my_role()
 RETURNS app.app_role
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'app', 'public', 'auth'
AS $function$
  select up.app_role
  from app.user_profiles up
  where up.user_id = auth.uid()
    and up.is_active = true
$function$;


CREATE OR REPLACE FUNCTION app.is_case_lawyer(p_case_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'app', 'public', 'auth'
AS $function$
  select exists (
    select 1
    from app.cases c
    where c.case_id = p_case_id
      and c.lawyer_id = auth.uid()
  )
$function$;


CREATE OR REPLACE FUNCTION app.is_case_member(p_case_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'app', 'public', 'auth'
AS $function$
  select exists (
    select 1
    from app.case_members cm
    where cm.case_id = p_case_id
      and cm.user_id = auth.uid()
  )
$function$;


CREATE OR REPLACE FUNCTION app.prevent_legal_decision_data_update()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if new.decision_data is distinct from old.decision_data then
    raise exception 'decision_data is immutable after insert';
  end if;
  return new;
end;
$function$;


CREATE OR REPLACE FUNCTION app.save_legal_decision_atomic(p_case_id uuid, p_version_hash text, p_decision_status text, p_decision_data jsonb, p_source_pipeline_version text DEFAULT NULL::text, p_created_by uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
declare
  v_previous_id   uuid;
  v_new_row       app.legal_decisions%rowtype;
  v_existing_row  app.legal_decisions%rowtype;
begin
  -- ── Step 0: Advisory lock ────────────────────────────────────────────────
  -- Serialize all concurrent save_legal_decision_atomic calls for the same
  -- case_id.  The lock is held for the duration of the enclosing transaction
  -- and released automatically on COMMIT or ROLLBACK.
  --
  -- Two-argument form avoids cross-table collisions (first arg = table tag,
  -- second arg = case_id hash).  abs() keeps values in the positive int4 range.
  perform pg_advisory_xact_lock(
    abs(hashtext('app.legal_decisions')),
    abs(hashtext(p_case_id::text))
  );

  -- ── Step 1: Duplicate check ───────────────────────────────────────────────
  -- If this version_hash already exists for the case, return it immediately.
  -- No new snapshot is created; this is an idempotent re-call.
  select * into v_existing_row
  from app.legal_decisions
  where case_id = p_case_id
    and version_hash = p_version_hash
  limit 1;

  if found then
    return jsonb_build_object(
      '_action',                  'duplicate',
      'id',                       v_existing_row.id,
      'case_id',                  v_existing_row.case_id,
      'version_hash',             v_existing_row.version_hash,
      'decision_status',          v_existing_row.decision_status,
      'decision_data',            v_existing_row.decision_data,
      'source_pipeline_version',  v_existing_row.source_pipeline_version,
      'created_by',               v_existing_row.created_by,
      'created_at',               v_existing_row.created_at,
      'supersedes_decision_id',   v_existing_row.supersedes_decision_id,
      'is_latest',                v_existing_row.is_latest
    );
  end if;

  -- ── Step 2: Identify current latest ──────────────────────────────────────
  -- Advisory lock means no concurrent transaction can be between steps 2 and 4
  -- for the same case_id.  SELECT FOR UPDATE provides an additional row-level
  -- lock as belt-and-suspenders (catches edge cases where advisory lock is
  -- bypassed via direct SQL access).
  select id into v_previous_id
  from app.legal_decisions
  where case_id = p_case_id
    and is_latest = true
  for update;
  -- v_previous_id is NULL when this is the first snapshot for the case.

  -- ── Step 3: Clear previous latest BEFORE inserting new ───────────────────
  -- No window exists where two rows simultaneously have is_latest = true.
  -- If the subsequent INSERT fails, this UPDATE is rolled back atomically.
  if v_previous_id is not null then
    update app.legal_decisions
    set is_latest = false
    where id = v_previous_id;
    -- Note: the immutable-data trigger (prevent_legal_decision_data_update)
    -- fires here but passes because only is_latest changes, not decision_data.
  end if;

  -- ── Step 4: Insert new snapshot ──────────────────────────────────────────
  insert into app.legal_decisions (
    case_id,
    version_hash,
    decision_status,
    decision_data,
    source_pipeline_version,
    created_by,
    supersedes_decision_id,
    is_latest
  )
  values (
    p_case_id,
    p_version_hash,
    p_decision_status,
    p_decision_data,
    p_source_pipeline_version,
    p_created_by,
    v_previous_id,  -- supersedes the row we just cleared
    true
  )
  returning * into v_new_row;

  -- ── Step 5: Return inserted row ───────────────────────────────────────────
  return jsonb_build_object(
    '_action',                  'inserted',
    'id',                       v_new_row.id,
    'case_id',                  v_new_row.case_id,
    'version_hash',             v_new_row.version_hash,
    'decision_status',          v_new_row.decision_status,
    'decision_data',            v_new_row.decision_data,
    'source_pipeline_version',  v_new_row.source_pipeline_version,
    'created_by',               v_new_row.created_by,
    'created_at',               v_new_row.created_at,
    'supersedes_decision_id',   v_new_row.supersedes_decision_id,
    'is_latest',                v_new_row.is_latest
  );
end;
$function$;


CREATE OR REPLACE FUNCTION public.admin_set_user_role(p_user_id uuid, p_role app.app_role)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'app', 'auth', 'pg_temp'
AS $function$
begin
  if app.get_my_role() <> 'admin' then
    raise exception 'Only admin can change roles' using errcode = '42501';
  end if;
  update app.user_profiles
     set app_role = p_role, updated_at = now()
   where user_id = p_user_id;
  if not found then
    raise exception 'User not found: %', p_user_id using errcode = 'P0002';
  end if;
end;
$function$;


CREATE OR REPLACE FUNCTION public.ai_analysis_view_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'app'
AS $function$
begin
  insert into app.ai_analysis_runs (case_id, triggered_by, query_text, model_used, result_jsonb)
  values (
    new.case_id,
    coalesce(new.created_by, auth.uid()),
    new.prompt_used,
    new.role,
    jsonb_build_object(
      'response_text', new.response_text,
      'sources_used', coalesce(new.sources_used, '[]'::jsonb)
    )
  )
  returning run_id, created_at into new.id, new.created_at;
  return new;
end;
$function$;


CREATE OR REPLACE FUNCTION public.case_files_compat_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'app', 'auth', 'pg_temp'
AS $function$
begin
  delete from app.client_documents where doc_id = old.id;
  if not found then
    return null;
  end if;
  return old;
end;
$function$;


CREATE OR REPLACE FUNCTION public.case_files_compat_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'app', 'auth', 'pg_temp'
AS $function$
declare
  inserted app.client_documents%rowtype;
begin
  insert into app.client_documents (
    case_id,
    uploaded_by,
    file_name,
    file_url,
    file_size
  )
  values (
    new.case_id,
    coalesce(new.uploaded_by, auth.uid()),
    coalesce(new.original_filename, new.filename),
    new.storage_path,
    new.file_size
  )
  returning * into inserted;

  select * into new
  from public.case_files
  where id = inserted.doc_id;

  return new;
end;
$function$;


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


CREATE OR REPLACE FUNCTION public.case_members_compat_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'app', 'auth', 'pg_temp'
AS $function$
begin
  delete from app.case_members
  where case_id = old.case_id
    and user_id = old.user_id;

  if not found then
    return null;
  end if;

  return old;
end;
$function$;


CREATE OR REPLACE FUNCTION public.case_members_compat_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'app', 'auth', 'pg_temp'
AS $function$
declare
  inserted app.case_members%rowtype;
begin
  if new.case_role is null or new.case_role not in ('lawyer', 'client') then
    raise exception 'Invalid case member role: %. Allowed values: lawyer, client', new.case_role
      using errcode = '22023';
  end if;

  insert into app.case_members (
    case_id,
    user_id,
    case_role
  )
  values (
    new.case_id,
    new.user_id,
    new.case_role
  )
  returning * into inserted;

  new.case_id := inserted.case_id;
  new.user_id := inserted.user_id;
  new.case_role := inserted.case_role;

  return new;
end;
$function$;


CREATE OR REPLACE FUNCTION public.cases_compat_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'app', 'auth', 'pg_temp'
AS $function$
begin
  delete from app.cases
  where case_id = old.id;

  if not found then
    return null;
  end if;

  return old;
end;
$function$;


CREATE OR REPLACE FUNCTION public.cases_compat_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'auth', 'pg_temp'
AS $function$
declare
  inserted app.cases%rowtype;
  v_uid uuid := auth.uid();
  v_role app.app_role := app.get_my_role();
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if v_role is null or v_role not in ('admin','lawyer') then
    raise exception 'Forbidden: only admin or lawyer may create cases' using errcode = '42501';
  end if;
  insert into app.cases (
    title, description, status, created_by, lawyer_id,
    case_number, case_type, facts, legal_question
  )
  values (
    new.title,
    new.description,
    case when new.status in ('open','closed','archived') then new.status else 'open' end,
    v_uid,
    case when v_role = 'admin' then coalesce(new.lawyer_id, v_uid) else v_uid end,
    new.case_number, new.case_type, new.facts, new.legal_question
  )
  returning * into inserted;
  select * into new from public.cases where id = inserted.case_id;
  return new;
end;
$function$;


CREATE OR REPLACE FUNCTION public.cases_compat_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'app', 'auth', 'pg_temp'
AS $function$
declare
  updated app.cases%rowtype;
begin
  if new.status is not null and new.status not in ('open', 'closed', 'archived') then
    raise exception 'Invalid case status: %. Allowed values: open, closed, archived', new.status
      using errcode = '22023';
  end if;

  update app.cases
  set
    title = coalesce(new.title, old.title),
    description = new.description,
    status = coalesce(new.status, old.status),
    case_number = new.case_number,
    case_type = new.case_type,
    facts = new.facts,
    legal_question = new.legal_question
  where case_id = old.id
  returning * into updated;

  if not found then
    return null;
  end if;

  select * into new from public.cases where id = updated.case_id;
  return new;
end;
$function$;


CREATE OR REPLACE FUNCTION public.generated_documents_compat_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'app', 'auth', 'pg_temp'
AS $function$
begin
  delete from app.generated_documents
  where generated_id = old.id;

  return old;
end;
$function$;


CREATE OR REPLACE FUNCTION public.generated_documents_compat_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'app', 'auth', 'pg_temp'
AS $function$
declare
  inserted app.generated_documents%rowtype;
begin
  insert into app.generated_documents (
    case_id,
    created_by,
    template,
    content
  )
  values (
    new.case_id,
    coalesce(new.user_id, auth.uid()),
    coalesce(new.document_type, new.title, new.template_id::text),
    coalesce(new.content_text, new.content)
  )
  returning * into inserted;

  select * into new
  from public.generated_documents
  where id = inserted.generated_id;

  return new;
end;
$function$;


CREATE OR REPLACE FUNCTION public.generated_documents_compat_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'app', 'auth', 'pg_temp'
AS $function$
begin
  update app.generated_documents
  set
    template = coalesce(new.document_type, new.title, old.document_type),
    content = coalesce(new.content_text, new.content, old.content)
  where generated_id = old.id;

  select * into new
  from public.generated_documents
  where id = old.id;

  return new;
end;
$function$;


CREATE OR REPLACE FUNCTION public.generated_documents_view_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'app'
AS $function$
begin
  insert into app.generated_documents (case_id, created_by, template, content, metadata)
  values (
    new.case_id,
    coalesce(new.user_id, auth.uid()),
    coalesce(new.title, new.document_type, 'document'),
    coalesce(new.content, new.content_text),
    coalesce(new.metadata, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
      'template_id', new.template_id,
      'status', new.status,
      'document_type', new.document_type,
      'recipient_name', new.recipient_name,
      'recipient_position', new.recipient_position,
      'recipient_organization', new.recipient_organization,
      'sender_name', new.sender_name,
      'sender_address', new.sender_address,
      'sender_contact', new.sender_contact,
      'source_text', new.source_text
    ))
  )
  returning generated_id, created_at, updated_at
    into new.id, new.created_at, new.updated_at;
  return new;
end;
$function$;


CREATE OR REPLACE FUNCTION public.get_ai_metrics_summary(p_days integer DEFAULT 30)
 RETURNS TABLE(day date, fn_name text, model text, calls bigint, total_tokens bigint, cost_usd numeric, avg_latency_ms numeric, failures bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'internal', 'public', 'auth', 'pg_temp'
AS $function$
begin
  if app.get_my_role() is distinct from 'admin' then
    return;
  end if;

  return query
    select date_trunc('day', m.created_at)::date as day,
           m.fn_name, m.model,
           count(*)::bigint as calls,
           coalesce(sum(m.total_tokens),0)::bigint as total_tokens,
           round(coalesce(sum(m.cost_usd),0), 4) as cost_usd,
           round(avg(m.latency_ms)::numeric, 0) as avg_latency_ms,
           count(*) filter (where m.status='failed')::bigint as failures
    from internal.ai_metrics m
    where m.created_at >= now() - make_interval(days => greatest(p_days,1))
    group by 1,2,3
    order by 1 desc, calls desc;
end;
$function$;


CREATE OR REPLACE FUNCTION public.get_embedding_metrics(p_model text DEFAULT 'armenian-text-embeddings-2-large'::text)
 RETURNS TABLE(model text, total_chunks bigint, embedded bigint, pending bigint, failed bigint, est_total_tokens bigint, est_total_cost_usd numeric, est_remaining_cost_usd numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'app', 'pg_temp'
AS $function$
declare
  price_per_m numeric := 0.0;  -- self-hosted open-source model: no per-token cost
begin
  if app.get_my_role() <> 'admin' then
    raise exception 'Only admin may read embedding metrics' using errcode = '42501';
  end if;
  return query
  with sc as (
    select s.chunk_id,
           ceil(length(coalesce(s.text,'')) / 4.0)::bigint as toks,
           exists (
             select 1 from public.embeddings e
             where e.chunk_id = s.chunk_id and e.model = p_model and e.status = 'success'
           ) as done
    from public.search_chunks s
  )
  select
    p_model,
    count(*)::bigint,
    count(*) filter (where done)::bigint,
    count(*) filter (where not done)::bigint,
    (select count(*) from public.embeddings em where em.model = p_model and em.status = 'failed')::bigint,
    coalesce(sum(toks),0)::bigint,
    round(coalesce(sum(toks),0) / 1000000.0 * price_per_m, 4),
    round(coalesce(sum(toks) filter (where not done),0) / 1000000.0 * price_per_m, 4)
  from sc;
end;
$function$;


CREATE OR REPLACE FUNCTION public.get_my_role()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select role from public.users where id = auth.uid();
$function$;


CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'app'
AS $function$
BEGIN
  INSERT INTO app.user_profiles (user_id, full_name, email, app_role, is_active)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    NEW.email,
    'client'::app.app_role,
    true
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$function$;


CREATE OR REPLACE FUNCTION public.lookup_by_article(p_document_ref text DEFAULT NULL::text, p_article_number text DEFAULT NULL::text, p_limit integer DEFAULT 10)
 RETURNS TABLE(match_type text, document_id uuid, version_id uuid, chunk_id uuid, legal_unit_id uuid, canonical_key text, arlis_doc_id text, doc_number_clean text, title_hy text, title_ru text, unit_type text, unit_number text, unit_title text, text text, source_url text, citation_anchor text, page_from integer, page_to integer, effective_from date, effective_to date, rank_score real)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  with input as (
    select
      regexp_replace(lower(coalesce(p_document_ref, '')), '[^[:alnum:]]+', '', 'g') as document_ref_norm,
      regexp_replace(lower(coalesce(p_article_number, '')), '[^[:alnum:]]+', '', 'g') as article_norm,
      least(greatest(coalesce(p_limit, 10), 0), 50) as result_limit
  )
  select
    'article'::text as match_type,
    d.document_id,
    lu.version_id,
    sc.chunk_id,
    lu.unit_id as legal_unit_id,
    d.canonical_key,
    d.arlis_doc_id,
    d.doc_number_clean,
    d.title_hy,
    d.title_ru,
    lu.unit_type,
    lu.unit_number,
    lu.unit_title,
    coalesce(sc.text, lu.unit_text) as text,
    sc.source_url,
    sc.citation_anchor,
    sc.page_from,
    sc.page_to,
    coalesce(sc.effective_from, d.effective_from) as effective_from,
    coalesce(sc.effective_to, d.effective_to) as effective_to,
    case
      when lower(coalesce(lu.unit_type, '')) in ('article', 'հոդված', 'статья') then 1.0
      else 0.9
    end::real as rank_score
  from input i
  join public.legal_units lu
    on regexp_replace(lower(coalesce(lu.unit_number, '')), '[^[:alnum:]]+', '', 'g') = i.article_norm
  join public.document_versions dv
    on dv.version_id = lu.version_id
   and dv.is_current = true
  join public.documents d
    on d.document_id = lu.document_id
  left join public.search_chunks sc
    on sc.legal_unit_id = lu.unit_id
  where
    i.article_norm <> ''
    and (
      i.document_ref_norm = ''
      or regexp_replace(lower(coalesce(d.canonical_key, '')), '[^[:alnum:]]+', '', 'g') = i.document_ref_norm
      or regexp_replace(lower(coalesce(d.arlis_doc_id, '')), '[^[:alnum:]]+', '', 'g') = i.document_ref_norm
      or regexp_replace(lower(coalesce(d.doc_number_clean, '')), '[^[:alnum:]]+', '', 'g') = i.document_ref_norm
    )
  order by
    rank_score desc,
    d.title_hy nulls last,
    lu.sort_order nulls last,
    sc.char_start nulls last
  limit (select result_limit from input);
$function$;


CREATE OR REPLACE FUNCTION public.lookup_by_citation(p_citation text DEFAULT NULL::text, p_limit integer DEFAULT 10)
 RETURNS TABLE(match_type text, document_id uuid, version_id uuid, chunk_id uuid, legal_unit_id uuid, canonical_key text, arlis_doc_id text, doc_number_clean text, title_hy text, title_ru text, unit_type text, unit_number text, unit_title text, text text, source_url text, citation_anchor text, page_from integer, page_to integer, effective_from date, effective_to date, rank_score real)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  with input as (
    select
      regexp_replace(lower(coalesce(p_citation, '')), '[^[:alnum:]]+', '', 'g') as citation_norm,
      regexp_replace(
        lower(coalesce(
          substring(
            coalesce(p_citation, '')
            from '(?:article|art\.?|статья|ст\.?|հոդված)[[:space:]]*([[:alnum:]./-]+)'
          ),
          ''
        )),
        '[^[:alnum:]]+',
        '',
        'g'
      ) as article_norm,
      least(greatest(coalesce(p_limit, 10), 0), 50) as result_limit
  ),
  rows as (
    select
      d.document_id,
      sc.version_id,
      sc.chunk_id,
      sc.legal_unit_id,
      d.canonical_key,
      d.arlis_doc_id,
      d.doc_number_clean,
      d.title_hy,
      d.title_ru,
      lu.unit_type,
      lu.unit_number,
      lu.unit_title,
      sc.text,
      sc.source_url,
      sc.citation_anchor,
      sc.page_from,
      sc.page_to,
      coalesce(sc.effective_from, d.effective_from) as effective_from,
      coalesce(sc.effective_to, d.effective_to) as effective_to,
      regexp_replace(lower(coalesce(sc.citation_anchor, '')), '[^[:alnum:]]+', '', 'g') as anchor_norm,
      regexp_replace(lower(coalesce(d.canonical_key, '')), '[^[:alnum:]]+', '', 'g') as canonical_norm,
      regexp_replace(lower(coalesce(d.arlis_doc_id, '')), '[^[:alnum:]]+', '', 'g') as arlis_norm,
      regexp_replace(lower(coalesce(d.doc_number_clean, '')), '[^[:alnum:]]+', '', 'g') as doc_number_norm,
      regexp_replace(lower(coalesce(lu.unit_number, '')), '[^[:alnum:]]+', '', 'g') as unit_number_norm
    from public.search_chunks sc
    join public.document_versions dv
      on dv.version_id = sc.version_id
     and dv.is_current = true
    join public.documents d
      on d.document_id = sc.document_id
    left join public.legal_units lu
      on lu.unit_id = sc.legal_unit_id
  )
  select
    case
      when r.anchor_norm <> '' and r.anchor_norm = i.citation_norm then 'citation_anchor'
      when r.anchor_norm <> '' and i.citation_norm like '%' || r.anchor_norm || '%' then 'citation_anchor'
      when i.article_norm <> '' then 'citation_article'
      else 'citation_document'
    end::text as match_type,
    r.document_id,
    r.version_id,
    r.chunk_id,
    r.legal_unit_id,
    r.canonical_key,
    r.arlis_doc_id,
    r.doc_number_clean,
    r.title_hy,
    r.title_ru,
    r.unit_type,
    r.unit_number,
    r.unit_title,
    r.text,
    r.source_url,
    r.citation_anchor,
    r.page_from,
    r.page_to,
    r.effective_from,
    r.effective_to,
    case
      when r.anchor_norm <> '' and r.anchor_norm = i.citation_norm then 1.0
      when r.anchor_norm <> '' and i.citation_norm like '%' || r.anchor_norm || '%' then 0.95
      when i.article_norm <> '' and r.unit_number_norm = i.article_norm then 0.9
      else 0.75
    end::real as rank_score
  from input i
  join rows r on true
  where
    i.citation_norm <> ''
    and (
      (r.anchor_norm <> '' and (r.anchor_norm = i.citation_norm or i.citation_norm like '%' || r.anchor_norm || '%'))
      or (
        (
          (length(r.canonical_norm) >= 3 and i.citation_norm like '%' || r.canonical_norm || '%')
          or (length(r.arlis_norm) >= 3 and i.citation_norm like '%' || r.arlis_norm || '%')
          or (length(r.doc_number_norm) >= 3 and i.citation_norm like '%' || r.doc_number_norm || '%')
        )
        and (i.article_norm = '' or r.unit_number_norm = i.article_norm)
      )
    )
  order by
    rank_score desc,
    r.title_hy nulls last,
    r.page_from nulls last
  limit (select result_limit from input);
$function$;


CREATE OR REPLACE FUNCTION public.lookup_table_rows(p_document_ref text DEFAULT NULL::text, p_table_ref text DEFAULT NULL::text, p_limit integer DEFAULT 50)
 RETURNS TABLE(match_type text, document_id uuid, version_id uuid, chunk_id uuid, legal_unit_id uuid, canonical_key text, arlis_doc_id text, doc_number_clean text, title_hy text, title_ru text, unit_type text, unit_number text, unit_title text, text text, source_url text, citation_anchor text, page_from integer, page_to integer, effective_from date, effective_to date, rank_score real)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  with input as (
    select
      regexp_replace(lower(coalesce(p_document_ref, '')), '[^[:alnum:]]+', '', 'g') as document_ref_norm,
      regexp_replace(lower(coalesce(p_table_ref, '')), '[^[:alnum:]]+', '', 'g') as table_ref_norm,
      least(greatest(coalesce(p_limit, 50), 0), 200) as result_limit
  )
  select
    'table_row'::text as match_type,
    d.document_id,
    lu.version_id,
    sc.chunk_id,
    lu.unit_id as legal_unit_id,
    d.canonical_key,
    d.arlis_doc_id,
    d.doc_number_clean,
    d.title_hy,
    d.title_ru,
    lu.unit_type,
    lu.unit_number,
    lu.unit_title,
    coalesce(sc.text, lu.unit_text) as text,
    sc.source_url,
    sc.citation_anchor,
    sc.page_from,
    sc.page_to,
    coalesce(sc.effective_from, d.effective_from) as effective_from,
    coalesce(sc.effective_to, d.effective_to) as effective_to,
    case
      when lower(coalesce(lu.unit_type, '')) in ('table_row', 'row') then 1.0
      when lower(coalesce(lu.unit_type, '')) = 'table' then 0.9
      else 0.75
    end::real as rank_score
  from input i
  join public.legal_units lu
    on true
  join public.document_versions dv
    on dv.version_id = lu.version_id
   and dv.is_current = true
  join public.documents d
    on d.document_id = lu.document_id
  left join public.search_chunks sc
    on sc.legal_unit_id = lu.unit_id
  where
    (
      lower(coalesce(lu.unit_type, '')) in ('table', 'table_row', 'row', 'աղյուսակ', 'таблица')
      or coalesce(lu.unit_title, '') ~* '(table|աղյուսակ|таблиц)'
      or coalesce(sc.citation_anchor, '') ~* '(table|աղյուսակ|таблиц)'
    )
    and (
      i.document_ref_norm = ''
      or regexp_replace(lower(coalesce(d.canonical_key, '')), '[^[:alnum:]]+', '', 'g') = i.document_ref_norm
      or regexp_replace(lower(coalesce(d.arlis_doc_id, '')), '[^[:alnum:]]+', '', 'g') = i.document_ref_norm
      or regexp_replace(lower(coalesce(d.doc_number_clean, '')), '[^[:alnum:]]+', '', 'g') = i.document_ref_norm
    )
    and (
      i.table_ref_norm = ''
      or regexp_replace(lower(coalesce(lu.unit_number, '')), '[^[:alnum:]]+', '', 'g') = i.table_ref_norm
      or regexp_replace(lower(coalesce(lu.unit_title, '')), '[^[:alnum:]]+', '', 'g') like '%' || i.table_ref_norm || '%'
      or regexp_replace(lower(coalesce(sc.citation_anchor, '')), '[^[:alnum:]]+', '', 'g') like '%' || i.table_ref_norm || '%'
    )
  order by
    rank_score desc,
    d.title_hy nulls last,
    lu.sort_order nulls last,
    sc.char_start nulls last
  limit (select result_limit from input);
$function$;


CREATE OR REPLACE FUNCTION public.profiles_compat_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'app', 'auth', 'pg_temp'
AS $function$
begin
  insert into public.profile_compat_settings (
    user_id,
    telegram_chat_id,
    notification_preferences
  )
  values (
    old.id,
    new.telegram_chat_id,
    coalesce(new.notification_preferences, '{}'::jsonb)
  )
  on conflict (user_id) do update
  set
    telegram_chat_id = excluded.telegram_chat_id,
    notification_preferences = excluded.notification_preferences,
    updated_at = now();

  select * into new
  from public.profiles
  where id = old.id;

  return new;
end;
$function$;


CREATE OR REPLACE FUNCTION public.profiles_view_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'app'
AS $function$
begin
  delete from app.user_profiles where user_id = old.id;
  return old;
end;
$function$;


CREATE OR REPLACE FUNCTION public.profiles_view_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'app'
AS $function$
begin
  insert into app.user_profiles (user_id, full_name, email, app_role, username, auditor_id)
  values (new.id, coalesce(new.full_name, 'User'), new.email, 'client'::app.app_role, new.username, new.auditor_id)
  on conflict (user_id) do update
    set full_name  = coalesce(excluded.full_name, app.user_profiles.full_name),
        email      = coalesce(excluded.email, app.user_profiles.email),
        username   = coalesce(excluded.username, app.user_profiles.username),
        auditor_id = coalesce(excluded.auditor_id, app.user_profiles.auditor_id),
        updated_at = now();
  return new;
end;
$function$;


CREATE OR REPLACE FUNCTION public.profiles_view_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'app'
AS $function$
begin
  if (new.username is distinct from old.username
      or new.auditor_id is distinct from old.auditor_id
      or new.is_active is distinct from old.is_active)
     and current_user <> 'service_role'
     and app.get_my_role() is distinct from 'admin'::app.app_role then
    raise exception 'Only admin may change username, auditor or active flag'
      using errcode = '42501';
  end if;
  update app.user_profiles
     set full_name  = new.full_name,
         email      = new.email,
         username   = new.username,
         auditor_id = new.auditor_id,
         is_active  = new.is_active,
         updated_at = now()
   where user_id = old.id;
  return new;
end;
$function$;


CREATE OR REPLACE FUNCTION public.record_ai_analysis_run(p_case_id uuid, p_result jsonb, p_query text, p_model text)
 RETURNS TABLE(run_id uuid, case_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'app', 'public'
AS $function$
declare
  v_triggered_by_text text;
  v_triggered_by uuid;
begin
  v_triggered_by_text := nullif(p_result #>> '{metadata,triggered_by}', '');

  if v_triggered_by_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    v_triggered_by := v_triggered_by_text::uuid;
  else
    v_triggered_by := auth.uid();
  end if;

  return query
  insert into app.ai_analysis_runs (
    case_id,
    triggered_by,
    query_text,
    result_jsonb,
    model_used
  )
  values (
    p_case_id,
    v_triggered_by,
    p_query,
    p_result,
    p_model
  )
  returning
    app.ai_analysis_runs.run_id,
    app.ai_analysis_runs.case_id;
end;
$function$;


CREATE OR REPLACE FUNCTION public.record_ai_metric(p_fn_name text, p_model text DEFAULT NULL::text, p_input_tokens integer DEFAULT 0, p_output_tokens integer DEFAULT 0, p_cost_usd numeric DEFAULT 0, p_latency_ms integer DEFAULT NULL::integer, p_status text DEFAULT 'success'::text, p_error_message text DEFAULT NULL::text, p_case_id uuid DEFAULT NULL::uuid, p_user_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'internal', 'public', 'auth', 'pg_temp'
AS $function$
begin
  insert into internal.ai_metrics
    (fn_name, model, input_tokens, output_tokens, cost_usd, latency_ms, status, error_message, case_id, user_id)
  values
    (p_fn_name, p_model, coalesce(p_input_tokens,0), coalesce(p_output_tokens,0),
     coalesce(p_cost_usd,0), p_latency_ms,
     case when p_status in ('success','failed') then p_status else 'success' end,
     p_error_message, p_case_id, coalesce(p_user_id, auth.uid()));
end;
$function$;


CREATE OR REPLACE FUNCTION public.search_legal_corpus(p_query_text text, p_query_embedding vector, p_content_domain content_domain DEFAULT NULL::content_domain, p_norm_status normalized_status DEFAULT 'active'::normalized_status, p_effective_at date DEFAULT NULL::date, p_language_code text DEFAULT NULL::text, p_limit integer DEFAULT 10, p_offset integer DEFAULT 0)
 RETURNS TABLE(chunk_id uuid, document_id uuid, version_id uuid, title_hy text, text_snippet text, source_url text, citation_anchor text, page_from integer, page_to integer, content_domain content_domain, norm_status normalized_status, effective_from date, effective_to date, hybrid_score real, vector_score real, fts_score real, match_reason text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
 SET statement_timeout TO '60000'
AS $function$
  with
  filtered as (
    select
      sc.chunk_id, sc.document_id, sc.version_id, sc.text, sc.source_url,
      sc.citation_anchor, sc.page_from, sc.page_to, sc.content_domain,
      sc.norm_status, sc.effective_from, sc.effective_to, sc.fts_vector,
      e.vector as embedding_vector,
      d.title_hy
    from public.search_chunks sc
    join public.document_versions dv
      on dv.version_id = sc.version_id and dv.is_current = true
    join public.documents d
      on d.document_id = sc.document_id
    left join public.embeddings e
      on e.chunk_id = sc.chunk_id
     and e.model    = 'armenian-text-embeddings-2-large'
     and e.status   = 'success'
    where
      (p_content_domain is null or sc.content_domain = p_content_domain)
      and (p_norm_status   is null or sc.norm_status   = p_norm_status)
      and (p_language_code is null or sc.language_code = p_language_code)
      and (
        p_effective_at is null
        or (sc.effective_from <= p_effective_at
            and (sc.effective_to is null or sc.effective_to > p_effective_at))
      )
  ),
  vector_scored as (
    select *,
      case when embedding_vector is not null
           then 1.0 - (embedding_vector <=> p_query_embedding)
           else 0.0 end as vector_score
    from filtered
  ),
  fts_scored as (
    select *,
      case when p_query_text is not null and p_query_text <> ''
           then ts_rank_cd(fts_vector, plainto_tsquery('simple', p_query_text))
           else 0.0 end as fts_score
    from vector_scored
  ),
  hybrid as (
    select *,
      (0.6 * vector_score)
      + (0.3 * fts_score)
      + (0.1 * case norm_status
                 when 'active'           then 1.0
                 when 'partially_active' then 0.5
                 else 0.0 end)
      as hybrid_score
    from fts_scored
  )
  select
    chunk_id, document_id, version_id, title_hy,
    left(text, 300) as text_snippet,
    source_url, citation_anchor, page_from, page_to,
    content_domain, norm_status, effective_from, effective_to,
    hybrid_score::float4, vector_score::float4, fts_score::float4,
    case
      when vector_score > 0.7 and fts_score > 0.01 then 'vector+fts'
      when vector_score > 0.7                       then 'vector'
      when fts_score > 0.01                         then 'fts'
      else 'metadata_only'
    end as match_reason
  from hybrid
  where hybrid_score > 0.01
  order by hybrid_score desc
  limit p_limit offset p_offset;
$function$;


CREATE OR REPLACE FUNCTION public.search_legal_corpus_dual(p_query_text text, p_metric_embedding vector DEFAULT NULL::vector, p_qwen_embedding vector DEFAULT NULL::vector, p_content_domain content_domain DEFAULT NULL::content_domain, p_norm_status normalized_status DEFAULT NULL::normalized_status, p_limit integer DEFAULT 10, p_metric_limit integer DEFAULT 30, p_qwen_limit integer DEFAULT 30, p_bm25_limit integer DEFAULT 30, p_effective_at date DEFAULT NULL::date)
 RETURNS TABLE(chunk_id uuid, document_id uuid, version_id uuid, doc_id text, title text, text_snippet text, source_url text, citation_anchor text, language text, source text, content_domain content_domain, norm_status normalized_status, score real, vector_score real, fts_score real, retrieval_model text, retrieval_route text, match_reason text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
 SET statement_timeout TO '60000'
AS $function$
declare
  v_final int := least(greatest(coalesce(p_limit,10),1),100);
  v_bm25  int := least(greatest(coalesce(p_bm25_limit,30),1),120);
  v_cand  int := least(500, greatest(150, least(greatest(coalesce(p_limit,10),1),100) * 5));
  v_sql   text;
begin
  v_sql := format($t$
    with settings as (select nullif(trim(coalesce(%4$L::text,'')),'') as query_text),
    metric_ann as materialized (
      select e.chunk_id, (1.0-(e.vector <=> %2$L::vector(1024)))::float4 as sim
      from public.embeddings e
      where %2$L::vector(1024) is not null and e.model='armenian-text-embeddings-2-large' and e.status='success'
      order by e.vector <=> %2$L::vector(1024) limit %1$s
    ),
    qwen_ann as materialized (
      select e.chunk_id, (1.0-(e.vector <=> %3$L::vector(1024)))::float4 as sim
      from public.embeddings e
      where %3$L::vector(1024) is not null and e.model='qwen3-embedding-0.6b' and e.status='success'
      order by e.vector <=> %3$L::vector(1024) limit %1$s
    ),
    metric_candidates as (
      select sc.chunk_id, sc.document_id, sc.version_id, d.canonical_key as doc_id,
        coalesce(d.title_hy,d.title_en,d.title_ru,d.canonical_key) as title, left(sc.text,900) as text_snippet,
        sc.source_url, sc.citation_anchor, sc.language_code as language,
        case when d.canonical_key like 'venice:%%' then 'venice' when d.arlis_doc_id is not null then 'arlis' else coalesce(d.source_metadata->>'source','armenian_legal') end as source,
        sc.content_domain, sc.norm_status, a.sim as score, a.sim as vector_score, 0.0::float4 as fts_score,
        'armenian-text-embeddings-2-large'::text as retrieval_model, 'metric_hy'::text as retrieval_route, 'metric_dense'::text as match_reason
      from metric_ann a
      join public.search_chunks sc on sc.chunk_id=a.chunk_id
      join public.document_versions dv on dv.version_id=sc.version_id and dv.is_current=true
      join public.documents d on d.document_id=sc.document_id
      where sc.language_code='hy' and d.canonical_key not like 'echr:%%'
        and (%5$L::content_domain is null or sc.content_domain=%5$L::content_domain)
        and (%6$L::normalized_status is null or sc.norm_status=%6$L::normalized_status)
        and (%7$L::date is null or sc.effective_from is null or (sc.effective_from<=%7$L::date and (sc.effective_to is null or sc.effective_to>%7$L::date)))
    ),
    qwen_candidates as (
      select sc.chunk_id, sc.document_id, sc.version_id, d.canonical_key as doc_id,
        coalesce(d.title_en,d.title_hy,d.title_ru,d.canonical_key) as title, left(sc.text,900) as text_snippet,
        sc.source_url, sc.citation_anchor, sc.language_code as language, 'echr'::text as source,
        sc.content_domain, sc.norm_status, a.sim as score, a.sim as vector_score, 0.0::float4 as fts_score,
        'qwen3-embedding-0.6b'::text as retrieval_model, 'qwen_echr'::text as retrieval_route, 'qwen_dense'::text as match_reason
      from qwen_ann a
      join public.search_chunks sc on sc.chunk_id=a.chunk_id
      join public.document_versions dv on dv.version_id=sc.version_id and dv.is_current=true
      join public.documents d on d.document_id=sc.document_id
      where d.canonical_key like 'echr:%%' and sc.language_code in ('en','fr')
        and (%5$L::content_domain is null or sc.content_domain=%5$L::content_domain)
        and (%6$L::normalized_status is null or sc.norm_status=%6$L::normalized_status)
    ),
    bm25_candidates as (
      select sc.chunk_id, sc.document_id, sc.version_id, d.canonical_key as doc_id,
        coalesce(d.title_hy,d.title_en,d.title_ru,d.canonical_key) as title, left(sc.text,900) as text_snippet,
        sc.source_url, sc.citation_anchor, sc.language_code as language,
        case when d.canonical_key like 'echr:%%' then 'echr' when d.canonical_key like 'venice:%%' then 'venice' when d.arlis_doc_id is not null then 'arlis' else coalesce(d.source_metadata->>'source','legal') end as source,
        sc.content_domain, sc.norm_status,
        ts_rank_cd(sc.fts_vector, websearch_to_tsquery('simple', s.query_text))::float4 as score, 0.0::float4 as vector_score,
        ts_rank_cd(sc.fts_vector, websearch_to_tsquery('simple', s.query_text))::float4 as fts_score,
        'fts:simple'::text as retrieval_model, 'bm25_fts'::text as retrieval_route, 'fts'::text as match_reason
      from public.search_chunks sc
      join public.document_versions dv on dv.version_id=sc.version_id and dv.is_current=true
      join public.documents d on d.document_id=sc.document_id cross join settings s
      where s.query_text is not null and sc.fts_vector @@ websearch_to_tsquery('simple', s.query_text)
        and (%5$L::content_domain is null or sc.content_domain=%5$L::content_domain)
        and (%6$L::normalized_status is null or sc.norm_status=%6$L::normalized_status)
      order by ts_rank_cd(sc.fts_vector, websearch_to_tsquery('simple', s.query_text)) desc limit %8$s
    ),
    unioned as (select * from metric_candidates union all select * from qwen_candidates union all select * from bm25_candidates),
    ranked as (select u.*, row_number() over (partition by retrieval_route order by score desc) as rnk from unioned u),
    rrf as (select chunk_id, sum(1.0/(60.0+rnk))::float4 as rrf_score from ranked group by chunk_id),
    best as (select distinct on (chunk_id) * from ranked order by chunk_id, case retrieval_route when 'metric_hy' then 3 when 'qwen_echr' then 3 when 'bm25_fts' then 2 else 1 end desc, score desc)
    select b.chunk_id, b.document_id, b.version_id, b.doc_id, b.title, b.text_snippet, b.source_url, b.citation_anchor,
      b.language, b.source, b.content_domain, b.norm_status, r.rrf_score as score, b.vector_score, b.fts_score,
      b.retrieval_model, b.retrieval_route, b.match_reason
    from best b join rrf r using (chunk_id) order by r.rrf_score desc limit %9$s
  $t$,
    v_cand, p_metric_embedding::text, p_qwen_embedding::text, p_query_text,
    p_content_domain::text, p_norm_status::text, p_effective_at::text, v_bm25, v_final
  );
  return query execute v_sql;
end
$function$;


CREATE OR REPLACE FUNCTION public.search_legal_unit_chunks_preview(p_query_text text, p_limit integer DEFAULT 10, p_content_domain content_domain DEFAULT NULL::content_domain, p_language text DEFAULT NULL::text, p_effective_at date DEFAULT NULL::date)
 RETURNS TABLE(chunk_id uuid, document_id uuid, version_id uuid, title text, text_snippet text, source_url text, citation_anchor text, language text, content_domain content_domain, norm_status normalized_status, legal_unit_id uuid, article_number text, chunk_version text, score real)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with tokens as (
    select distinct lower(token) as token
    from regexp_split_to_table(coalesce(p_query_text, ''), '[^[:alnum:]Ա-Ֆա-ֆև]+') token
    where length(token) >= 3
  ),
  scored as (
    select
      sc.*,
      coalesce(sum(
        case
          when lower(coalesce(sc.normalized_title, '')) like '%' || t.token || '%' then 3
          when lower(coalesce(sc.citation_anchor, '')) like '%' || t.token || '%' then 2
          when lower(sc.text) like '%' || t.token || '%' then 1
          else 0
        end
      ), 0)::real as lexical_score
    from public.search_chunks_legal_unit sc
    cross join tokens t
    where p_query_text is not null
      and p_query_text <> ''
      and (p_content_domain is null or sc.content_domain = p_content_domain)
      and (p_language is null or sc.language = p_language or sc.language_code = p_language)
      and (sc.norm_status is null or sc.norm_status = 'active'::public.normalized_status)
      and (p_effective_at is null or sc.effective_from is null or sc.effective_from <= p_effective_at)
      and (p_effective_at is null or sc.effective_to is null or sc.effective_to > p_effective_at)
      and (
        lower(coalesce(sc.normalized_title, '')) like '%' || t.token || '%'
        or lower(coalesce(sc.citation_anchor, '')) like '%' || t.token || '%'
        or lower(sc.text) like '%' || t.token || '%'
      )
    group by sc.chunk_id
  )
  select
    scored.chunk_id,
    scored.document_id,
    scored.version_id,
    scored.normalized_title as title,
    left(scored.text, 1200) as text_snippet,
    scored.source_url,
    scored.citation_anchor,
    scored.language,
    scored.content_domain,
    scored.norm_status,
    scored.legal_unit_id,
    scored.article_number,
    scored.chunk_version,
    scored.lexical_score as score
  from public.search_chunks_legal_unit sc
  join scored on scored.chunk_id = sc.chunk_id
  order by scored.lexical_score desc, scored.chunk_id
  limit least(greatest(coalesce(p_limit, 10), 1), 100);
$function$;


CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;


CREATE OR REPLACE FUNCTION public.user_roles_guard()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'app'
AS $function$
  select current_user = 'service_role'
      or app.get_my_role() = 'admin'::app.app_role;
$function$;


CREATE OR REPLACE FUNCTION public.user_roles_view_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'app'
AS $function$
begin
  if not public.user_roles_guard() then
    raise exception 'Only admin may remove roles' using errcode = '42501';
  end if;
  update app.user_profiles
     set app_role = 'client'::app.app_role, updated_at = now()
   where user_id = old.user_id
     and app_role = old.role::app.app_role;
  return old;
end;
$function$;


CREATE OR REPLACE FUNCTION public.user_roles_view_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'app'
AS $function$
begin
  if not public.user_roles_guard() then
    raise exception 'Only admin may assign roles' using errcode = '42501';
  end if;
  update app.user_profiles
     set app_role = new.role::app.app_role, updated_at = now()
   where user_id = new.user_id;
  if not found then
    raise exception 'User not found: %', new.user_id using errcode = 'P0002';
  end if;
  return new;
end;
$function$;


CREATE OR REPLACE FUNCTION public.user_roles_view_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'app'
AS $function$
begin
  if not public.user_roles_guard() then
    raise exception 'Only admin may change roles' using errcode = '42501';
  end if;
  update app.user_profiles
     set app_role = new.role::app.app_role, updated_at = now()
   where user_id = old.user_id;
  return new;
end;
$function$;


-- Constraints [PRODUCTION_RUNTIME_REQUIRED]
alter table only app.ai_analysis_runs add constraint ai_analysis_runs_pkey PRIMARY KEY (run_id);

alter table only app.case_members add constraint case_members_pkey PRIMARY KEY (case_member_id);

alter table only app.case_messages add constraint case_messages_pkey PRIMARY KEY (message_id);

alter table only app.cases add constraint cases_pkey PRIMARY KEY (case_id);

alter table only app.client_documents add constraint client_documents_pkey PRIMARY KEY (doc_id);

alter table only app.generated_documents add constraint generated_documents_pkey PRIMARY KEY (generated_id);

alter table only app.legal_decisions add constraint legal_decisions_pkey PRIMARY KEY (id);

alter table only app.multi_agent_analysis_runs add constraint multi_agent_analysis_runs_pkey PRIMARY KEY (run_id);

alter table only app.user_profiles add constraint user_profiles_pkey PRIMARY KEY (user_id);

alter table only internal.ai_metrics add constraint ai_metrics_pkey PRIMARY KEY (metric_id);

alter table only internal.extraction_runs add constraint extraction_runs_pkey PRIMARY KEY (run_id);

alter table only internal.ingestion_jobs add constraint ingestion_jobs_pkey PRIMARY KEY (job_id);

alter table only internal.source_files add constraint source_files_pkey PRIMARY KEY (source_file_id);

alter table only public.agent_analysis_runs add constraint agent_analysis_runs_pkey PRIMARY KEY (id);

alter table only public.agent_findings add constraint agent_findings_pkey PRIMARY KEY (id);

alter table only public.aggregated_reports add constraint aggregated_reports_pkey PRIMARY KEY (id);

alter table only public.ai_prompt_versions add constraint ai_prompt_versions_pkey PRIMARY KEY (id);

alter table only public.ai_prompts add constraint ai_prompts_pkey PRIMARY KEY (id);

alter table only public.app_settings add constraint app_settings_pkey PRIMARY KEY (key);

alter table only public.audio_transcriptions add constraint audio_transcriptions_pkey PRIMARY KEY (id);

alter table only public.audit_logs add constraint audit_logs_pkey PRIMARY KEY (id);

alter table only public.authorities add constraint authorities_pkey PRIMARY KEY (authority_id);

alter table only public.case_comments add constraint case_comments_pkey PRIMARY KEY (id);

alter table only public.case_parties add constraint case_parties_pkey PRIMARY KEY (case_party_id);

alter table only public.case_volumes add constraint case_volumes_pkey PRIMARY KEY (id);

alter table only public.chat_messages add constraint chat_messages_pkey PRIMARY KEY (id);

alter table only public.chats add constraint chats_pkey PRIMARY KEY (id);

alter table only public.court_cases add constraint court_cases_pkey PRIMARY KEY (court_case_id);

alter table only public.document_pages add constraint document_pages_pkey PRIMARY KEY (page_id);

alter table only public.document_references add constraint document_references_pkey PRIMARY KEY (reference_id);

alter table only public.document_table_cells add constraint document_table_cells_pkey PRIMARY KEY (cell_id);

alter table only public.document_tables add constraint document_tables_pkey PRIMARY KEY (table_id);

alter table only public.document_templates add constraint document_templates_pkey PRIMARY KEY (id);

alter table only public.document_topics add constraint document_topics_pkey PRIMARY KEY (document_topic_id);

alter table only public.document_types add constraint document_types_pkey PRIMARY KEY (document_type_id);

alter table only public.document_versions add constraint document_versions_pkey PRIMARY KEY (version_id);

alter table only public.documents add constraint documents_pkey PRIMARY KEY (document_id);

alter table only public.embeddings add constraint embeddings_pkey PRIMARY KEY (embedding_id);

alter table only public.error_logs add constraint error_logs_pkey PRIMARY KEY (id);

alter table only public.evidence_registry add constraint evidence_registry_pkey PRIMARY KEY (id);

alter table only public.fragment_translations add constraint fragment_translations_pkey PRIMARY KEY (translation_id);

alter table only public.judges add constraint judges_pkey PRIMARY KEY (judge_id);

alter table only public.jurisdictions add constraint jurisdictions_pkey PRIMARY KEY (jurisdiction_id);

alter table only public.kb_versions add constraint kb_versions_pkey PRIMARY KEY (id);

alter table only public.knowledge_base add constraint knowledge_base_pkey PRIMARY KEY (id);

alter table only public.knowledge_document_profiles add constraint knowledge_document_profiles_pkey PRIMARY KEY (profile_id);

alter table only public.legal_documents add constraint legal_documents_pkey PRIMARY KEY (id);

alter table only public.legal_edges add constraint legal_edges_pkey PRIMARY KEY (edge_id);

alter table only public.legal_units add constraint legal_units_pkey PRIMARY KEY (unit_id);

alter table only public.notifications add constraint notifications_pkey PRIMARY KEY (id);

alter table only public.ocr_results add constraint ocr_results_pkey PRIMARY KEY (id);

alter table only public.parties add constraint parties_pkey PRIMARY KEY (party_id);

alter table only public.practice_document_profiles add constraint practice_document_profiles_pkey PRIMARY KEY (profile_id);

alter table only public.practice_to_knowledge_references add constraint practice_to_knowledge_references_pkey PRIMARY KEY (ref_id);

alter table only public.profile_compat_settings add constraint profile_compat_settings_pkey PRIMARY KEY (user_id);

alter table only public.publication_sources add constraint publication_sources_pkey PRIMARY KEY (source_id);

alter table only public.reminders add constraint reminders_pkey PRIMARY KEY (id);

alter table only public.search_chunks add constraint search_chunks_pkey PRIMARY KEY (chunk_id);

alter table only public.search_chunks_legal_unit add constraint search_chunks_legal_unit_pkey PRIMARY KEY (chunk_id);

alter table only public.search_chunks_legal_unit_embeddings add constraint search_chunks_legal_unit_embeddings_pkey PRIMARY KEY (embedding_id);

alter table only public.team_members add constraint team_members_pkey PRIMARY KEY (id);

alter table only public.teams add constraint teams_pkey PRIMARY KEY (id);

alter table only public.telegram_uploads add constraint telegram_uploads_pkey PRIMARY KEY (id);

alter table only public.telegram_verification_codes add constraint telegram_verification_codes_pkey PRIMARY KEY (id);

alter table only public.topics add constraint topics_pkey PRIMARY KEY (topic_id);

alter table only public.user_feedback add constraint user_feedback_pkey PRIMARY KEY (id);

alter table only public.user_notes add constraint user_notes_pkey PRIMARY KEY (id);

alter table only public.version_authorities add constraint version_authorities_pkey PRIMARY KEY (version_authority_id);

alter table only app.case_members add constraint case_members_case_id_user_id_key UNIQUE (case_id, user_id);

alter table only app.legal_decisions add constraint legal_decisions_case_version_unique UNIQUE (case_id, version_hash);

alter table only app.multi_agent_analysis_runs add constraint multi_agent_analysis_runs_requested_by_idempotency_key_key UNIQUE (requested_by, idempotency_key);

alter table only app.user_profiles add constraint user_profiles_email_key UNIQUE (email);

alter table only internal.source_files add constraint source_files_raw_record_sha256_unique UNIQUE (raw_record_sha256);

alter table only public.document_pages add constraint document_pages_version_id_page_number_key UNIQUE (version_id, page_number);

alter table only public.document_table_cells add constraint document_table_cells_table_id_row_idx_col_idx_key UNIQUE (table_id, row_idx, col_idx);

alter table only public.document_tables add constraint document_tables_version_id_page_from_index_on_page_key UNIQUE (version_id, page_from, index_on_page);

alter table only public.document_topics add constraint document_topics_document_id_topic_id_key UNIQUE (document_id, topic_id);

alter table only public.document_types add constraint document_types_code_key UNIQUE (code);

alter table only public.document_versions add constraint document_versions_document_id_version_number_key UNIQUE (document_id, version_number);

alter table only public.documents add constraint documents_canonical_key_key UNIQUE (canonical_key);

alter table only public.embeddings add constraint embeddings_chunk_id_model_key UNIQUE (chunk_id, model);

alter table only public.fragment_translations add constraint fragment_translations_chunk_id_target_lang_key UNIQUE (chunk_id, target_lang);

alter table only public.jurisdictions add constraint jurisdictions_code_key UNIQUE (code);

alter table only public.knowledge_document_profiles add constraint knowledge_document_profiles_document_id_key UNIQUE (document_id);

alter table only public.practice_document_profiles add constraint practice_document_profiles_document_id_key UNIQUE (document_id);

alter table only public.profile_compat_settings add constraint profile_compat_settings_telegram_chat_id_key UNIQUE (telegram_chat_id);

alter table only public.search_chunks add constraint search_chunks_chunk_key_key UNIQUE (chunk_key);

alter table only public.search_chunks_legal_unit add constraint search_chunks_legal_unit_chunk_key_key UNIQUE (chunk_key);

alter table only public.search_chunks_legal_unit_embeddings add constraint search_chunks_legal_unit_embeddings_chunk_id_model_key UNIQUE (chunk_id, model);

alter table only public.team_members add constraint team_members_team_id_user_id_key UNIQUE (team_id, user_id);

alter table only public.topics add constraint topics_code_key UNIQUE (code);

alter table only public.user_feedback add constraint user_feedback_case_id_user_id_key UNIQUE (case_id, user_id);

alter table only public.version_authorities add constraint version_authorities_version_id_authority_id_authority_role_key UNIQUE (version_id, authority_id, authority_role);

alter table only app.case_members add constraint case_members_case_role_check CHECK (case_role = ANY (ARRAY['lawyer'::text, 'client'::text]));

alter table only app.cases add constraint app_cases_appeal_party_role_check CHECK (appeal_party_role IS NULL OR (appeal_party_role = ANY (ARRAY['appellant'::text, 'respondent'::text])));

alter table only app.cases add constraint app_cases_priority_check CHECK (priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'urgent'::text]));

alter table only app.cases add constraint cases_case_type_check CHECK (case_type IS NULL OR (case_type = ANY (ARRAY['criminal'::text, 'civil'::text, 'administrative'::text, 'echr'::text])));

alter table only app.cases add constraint cases_status_check CHECK (status = ANY (ARRAY['open'::text, 'closed'::text, 'archived'::text]));

alter table only app.client_documents add constraint client_documents_file_size_check CHECK (file_size IS NULL OR file_size >= 0);

alter table only app.legal_decisions add constraint legal_decisions_status_check CHECK (decision_status = ANY (ARRAY['READY'::text, 'WARNING'::text, 'HUMAN_REVIEW_REQUIRED'::text, 'BLOCKED'::text]));

alter table only app.multi_agent_analysis_runs add constraint multi_agent_analysis_runs_attempt_count_check CHECK (attempt_count >= 0);

alter table only app.multi_agent_analysis_runs add constraint multi_agent_analysis_runs_progress_check CHECK (progress >= 0 AND progress <= 100);

alter table only internal.ai_metrics add constraint ai_metrics_status_check CHECK (status = ANY (ARRAY['success'::text, 'failed'::text]));

alter table only internal.extraction_runs add constraint extraction_runs_status_check CHECK (extraction_status = ANY (ARRAY['success'::text, 'failed'::text, 'partial'::text]));

alter table only internal.ingestion_jobs add constraint ingestion_jobs_failed_records_check CHECK (failed_records >= 0);

alter table only internal.ingestion_jobs add constraint ingestion_jobs_status_check CHECK (status = ANY (ARRAY['running'::text, 'done'::text, 'failed'::text]));

alter table only internal.ingestion_jobs add constraint ingestion_jobs_total_records_check CHECK (total_records >= 0);

alter table only internal.source_files add constraint source_files_file_size_bytes_check CHECK (file_size_bytes IS NULL OR file_size_bytes >= 0);

alter table only internal.source_files add constraint source_files_raw_record_check CHECK (quarantined OR raw_record IS NOT NULL);

alter table only public.chat_messages add constraint chat_messages_role_check CHECK (role = ANY (ARRAY['user'::text, 'assistant'::text]));

alter table only public.document_pages add constraint document_pages_page_number_check CHECK (page_number > 0);

alter table only public.document_table_cells add constraint document_table_cells_cell_confidence_check CHECK (cell_confidence >= 0::numeric AND cell_confidence <= 100::numeric);

alter table only public.document_table_cells add constraint document_table_cells_value_type_check CHECK (value_type = ANY (ARRAY['text'::text, 'number'::text, 'date'::text, 'percent'::text, 'currency'::text, 'code'::text, 'empty'::text]));

alter table only public.document_tables add constraint document_tables_check CHECK (page_to >= page_from);

alter table only public.document_tables add constraint document_tables_extraction_confidence_check CHECK (extraction_confidence >= 0::numeric AND extraction_confidence <= 100::numeric);

alter table only public.document_tables add constraint document_tables_page_from_check CHECK (page_from > 0);

alter table only public.document_tables add constraint document_tables_table_class_check CHECK (table_class = ANY (ARRAY['real_grid'::text, 'meta_header'::text, 'body_text'::text, 'placeholder'::text, 'unknown'::text]));

alter table only public.document_topics add constraint document_topics_confidence_check CHECK (confidence IS NULL OR confidence >= 0::numeric AND confidence <= 1::numeric);

alter table only public.document_versions add constraint document_versions_page_count_check CHECK (page_count IS NULL OR page_count >= 0);

alter table only public.document_versions add constraint document_versions_version_number_check CHECK (version_number > 0);

alter table only public.embeddings add constraint embeddings_dimension_check CHECK (dimension = 1024);

alter table only public.embeddings add constraint embeddings_status_check CHECK (status = ANY (ARRAY['pending'::text, 'success'::text, 'failed'::text]));

alter table only public.knowledge_document_profiles add constraint knowledge_document_profiles_classifier_confidence_check CHECK (classifier_confidence IS NULL OR classifier_confidence >= 0::numeric AND classifier_confidence <= 1::numeric);

alter table only public.legal_edges add constraint legal_edges_confidence_check CHECK (confidence IS NULL OR confidence >= 0::numeric AND confidence <= 1::numeric);

alter table only public.legal_edges add constraint legal_edges_type_check CHECK (edge_type = ANY (ARRAY['cites'::text, 'amends'::text, 'repeals'::text, 'supersedes'::text, 'depends_on'::text, 'applies_precedent'::text, 'references_echr'::text]));

alter table only public.practice_document_profiles add constraint practice_document_profiles_classifier_confidence_check CHECK (classifier_confidence IS NULL OR classifier_confidence >= 0::numeric AND classifier_confidence <= 1::numeric);

alter table only public.reminders add constraint reminders_priority_check CHECK (priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'urgent'::text]));

alter table only public.reminders add constraint reminders_reminder_type_check CHECK (reminder_type = ANY (ARRAY['court_hearing'::text, 'deadline'::text, 'task'::text, 'meeting'::text, 'other'::text]));

alter table only public.reminders add constraint reminders_status_check CHECK (status = ANY (ARRAY['active'::text, 'completed'::text, 'dismissed'::text]));

alter table only public.search_chunks add constraint search_chunks_char_end_check CHECK (char_end IS NULL OR char_end >= 0);

alter table only public.search_chunks add constraint search_chunks_char_range_check CHECK (char_start IS NULL OR char_end IS NULL OR char_end >= char_start);

alter table only public.search_chunks add constraint search_chunks_char_start_check CHECK (char_start IS NULL OR char_start >= 0);

alter table only public.search_chunks add constraint search_chunks_page_from_check CHECK (page_from IS NULL OR page_from > 0);

alter table only public.search_chunks add constraint search_chunks_page_range_check CHECK (page_from IS NULL OR page_to IS NULL OR page_to >= page_from);

alter table only public.search_chunks add constraint search_chunks_page_to_check CHECK (page_to IS NULL OR page_to > 0);

alter table only public.search_chunks add constraint search_chunks_token_count_check CHECK (token_count IS NULL OR token_count >= 0);

alter table only public.search_chunks_legal_unit add constraint search_chunks_legal_unit_check CHECK (char_end >= char_start);

alter table only public.search_chunks_legal_unit add constraint search_chunks_legal_unit_chunk_version_check CHECK (chunk_version <> ''::text);

alter table only public.search_chunks_legal_unit_embeddings add constraint search_chunks_legal_unit_embeddings_dimension_check CHECK (dimension = 1024);

alter table only public.search_chunks_legal_unit_embeddings add constraint search_chunks_legal_unit_embeddings_status_check CHECK (status = ANY (ARRAY['success'::text, 'failed'::text, 'skipped'::text]));

alter table only public.telegram_uploads add constraint telegram_uploads_file_size_check CHECK (file_size IS NULL OR file_size >= 0);

alter table only public.user_feedback add constraint user_feedback_rating_check CHECK (rating >= 1 AND rating <= 5);

alter table only app.ai_analysis_runs add constraint ai_analysis_runs_case_id_fkey FOREIGN KEY (case_id) REFERENCES app.cases(case_id) ON DELETE CASCADE;

alter table only app.ai_analysis_runs add constraint ai_analysis_runs_triggered_by_fkey FOREIGN KEY (triggered_by) REFERENCES app.user_profiles(user_id) ON DELETE SET NULL;

alter table only app.case_members add constraint case_members_case_id_fkey FOREIGN KEY (case_id) REFERENCES app.cases(case_id) ON DELETE CASCADE;

alter table only app.case_members add constraint case_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES app.user_profiles(user_id) ON DELETE RESTRICT;

alter table only app.case_messages add constraint case_messages_case_id_fkey FOREIGN KEY (case_id) REFERENCES app.cases(case_id) ON DELETE CASCADE;

alter table only app.case_messages add constraint case_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES app.user_profiles(user_id) ON DELETE SET NULL;

alter table only app.cases add constraint cases_created_by_fkey FOREIGN KEY (created_by) REFERENCES app.user_profiles(user_id) ON DELETE RESTRICT;

alter table only app.cases add constraint cases_lawyer_id_fkey FOREIGN KEY (lawyer_id) REFERENCES app.user_profiles(user_id) ON DELETE RESTRICT;

alter table only app.client_documents add constraint client_documents_case_id_fkey FOREIGN KEY (case_id) REFERENCES app.cases(case_id) ON DELETE CASCADE;

alter table only app.client_documents add constraint client_documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES app.user_profiles(user_id) ON DELETE SET NULL;

alter table only app.generated_documents add constraint generated_documents_case_id_fkey FOREIGN KEY (case_id) REFERENCES app.cases(case_id) ON DELETE CASCADE;

alter table only app.generated_documents add constraint generated_documents_created_by_fkey FOREIGN KEY (created_by) REFERENCES app.user_profiles(user_id) ON DELETE SET NULL;

alter table only app.legal_decisions add constraint legal_decisions_case_id_fkey FOREIGN KEY (case_id) REFERENCES app.cases(case_id) ON DELETE CASCADE;

alter table only app.legal_decisions add constraint legal_decisions_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

alter table only app.legal_decisions add constraint legal_decisions_supersedes_decision_id_fkey FOREIGN KEY (supersedes_decision_id) REFERENCES app.legal_decisions(id);

alter table only app.multi_agent_analysis_runs add constraint multi_agent_analysis_runs_case_id_fkey FOREIGN KEY (case_id) REFERENCES app.cases(case_id) ON DELETE CASCADE;

alter table only app.multi_agent_analysis_runs add constraint multi_agent_analysis_runs_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES app.user_profiles(user_id) ON DELETE RESTRICT;

alter table only app.user_profiles add constraint user_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;

alter table only internal.extraction_runs add constraint extraction_runs_source_file_id_fkey FOREIGN KEY (source_file_id) REFERENCES internal.source_files(source_file_id) ON DELETE CASCADE;

alter table only internal.source_files add constraint source_files_job_id_fkey FOREIGN KEY (job_id) REFERENCES internal.ingestion_jobs(job_id) ON DELETE SET NULL;

alter table only public.agent_findings add constraint agent_findings_agent_run_id_fkey FOREIGN KEY (agent_run_id) REFERENCES agent_analysis_runs(id) ON DELETE CASCADE;

alter table only public.ai_prompt_versions add constraint ai_prompt_versions_prompt_id_fkey FOREIGN KEY (prompt_id) REFERENCES ai_prompts(id) ON DELETE CASCADE;

alter table only public.audio_transcriptions add constraint audio_transcriptions_file_id_fkey FOREIGN KEY (file_id) REFERENCES app.client_documents(doc_id) ON DELETE CASCADE;

alter table only public.case_comments add constraint case_comments_case_id_fkey FOREIGN KEY (case_id) REFERENCES app.cases(case_id) ON DELETE CASCADE;

alter table only public.case_parties add constraint case_parties_court_case_id_fkey FOREIGN KEY (court_case_id) REFERENCES court_cases(court_case_id) ON DELETE CASCADE;

alter table only public.case_parties add constraint case_parties_party_id_fkey FOREIGN KEY (party_id) REFERENCES parties(party_id) ON DELETE RESTRICT;

alter table only public.case_volumes add constraint case_volumes_case_id_fkey FOREIGN KEY (case_id) REFERENCES app.cases(case_id) ON DELETE CASCADE;

alter table only public.case_volumes add constraint case_volumes_file_id_fkey FOREIGN KEY (file_id) REFERENCES app.client_documents(doc_id) ON DELETE SET NULL;

alter table only public.chat_messages add constraint chat_messages_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE;

alter table only public.chats add constraint chats_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table only public.court_cases add constraint court_cases_document_id_fkey FOREIGN KEY (document_id) REFERENCES documents(document_id) ON DELETE CASCADE;

alter table only public.document_pages add constraint document_pages_version_id_fkey FOREIGN KEY (version_id) REFERENCES document_versions(version_id) ON DELETE CASCADE;

alter table only public.document_references add constraint document_references_from_document_id_fkey FOREIGN KEY (from_document_id) REFERENCES documents(document_id) ON DELETE CASCADE;

alter table only public.document_references add constraint document_references_to_document_id_fkey FOREIGN KEY (to_document_id) REFERENCES documents(document_id) ON DELETE SET NULL;

alter table only public.document_table_cells add constraint document_table_cells_table_id_fkey FOREIGN KEY (table_id) REFERENCES document_tables(table_id) ON DELETE CASCADE;

alter table only public.document_tables add constraint document_tables_document_id_fkey FOREIGN KEY (document_id) REFERENCES documents(document_id) ON DELETE CASCADE;

alter table only public.document_tables add constraint document_tables_version_id_fkey FOREIGN KEY (version_id) REFERENCES document_versions(version_id) ON DELETE CASCADE;

alter table only public.document_topics add constraint document_topics_document_id_fkey FOREIGN KEY (document_id) REFERENCES documents(document_id) ON DELETE CASCADE;

alter table only public.document_topics add constraint document_topics_topic_id_fkey FOREIGN KEY (topic_id) REFERENCES topics(topic_id) ON DELETE RESTRICT;

alter table only public.document_versions add constraint document_versions_document_id_fkey FOREIGN KEY (document_id) REFERENCES documents(document_id) ON DELETE CASCADE;

alter table only public.document_versions add constraint document_versions_publication_source_id_fkey FOREIGN KEY (publication_source_id) REFERENCES publication_sources(source_id) ON DELETE RESTRICT;

alter table only public.document_versions add constraint document_versions_source_file_id_fkey FOREIGN KEY (source_file_id) REFERENCES internal.source_files(source_file_id) ON DELETE RESTRICT;

alter table only public.documents add constraint documents_document_type_id_fkey FOREIGN KEY (document_type_id) REFERENCES document_types(document_type_id) ON DELETE RESTRICT;

alter table only public.documents add constraint documents_jurisdiction_id_fkey FOREIGN KEY (jurisdiction_id) REFERENCES jurisdictions(jurisdiction_id) ON DELETE RESTRICT;

alter table only public.embeddings add constraint embeddings_chunk_id_fkey FOREIGN KEY (chunk_id) REFERENCES search_chunks(chunk_id) ON DELETE CASCADE;

alter table only public.fragment_translations add constraint fragment_translations_chunk_id_fkey FOREIGN KEY (chunk_id) REFERENCES search_chunks(chunk_id) ON DELETE CASCADE;

alter table only public.kb_versions add constraint kb_versions_document_id_fkey FOREIGN KEY (document_id) REFERENCES knowledge_base(id) ON DELETE CASCADE;

alter table only public.knowledge_base add constraint knowledge_base_chunk_id_fkey FOREIGN KEY (chunk_id) REFERENCES search_chunks(chunk_id) ON DELETE SET NULL;

alter table only public.knowledge_base add constraint knowledge_base_document_id_fkey FOREIGN KEY (document_id) REFERENCES documents(document_id) ON DELETE SET NULL;

alter table only public.knowledge_document_profiles add constraint knowledge_document_profiles_document_id_fkey FOREIGN KEY (document_id) REFERENCES documents(document_id) ON DELETE CASCADE;

alter table only public.legal_documents add constraint legal_documents_chunk_id_fkey FOREIGN KEY (chunk_id) REFERENCES search_chunks(chunk_id) ON DELETE SET NULL;

alter table only public.legal_documents add constraint legal_documents_document_id_fkey FOREIGN KEY (document_id) REFERENCES documents(document_id) ON DELETE SET NULL;

alter table only public.legal_edges add constraint legal_edges_from_document_id_fkey FOREIGN KEY (from_document_id) REFERENCES documents(document_id) ON DELETE CASCADE;

alter table only public.legal_edges add constraint legal_edges_to_document_id_fkey FOREIGN KEY (to_document_id) REFERENCES documents(document_id) ON DELETE SET NULL;

alter table only public.legal_units add constraint legal_units_document_id_fkey FOREIGN KEY (document_id) REFERENCES documents(document_id) ON DELETE CASCADE;

alter table only public.legal_units add constraint legal_units_parent_unit_id_fkey FOREIGN KEY (parent_unit_id) REFERENCES legal_units(unit_id) ON DELETE CASCADE;

alter table only public.legal_units add constraint legal_units_version_id_fkey FOREIGN KEY (version_id) REFERENCES document_versions(version_id) ON DELETE CASCADE;

alter table only public.notifications add constraint notifications_reminder_id_fkey FOREIGN KEY (reminder_id) REFERENCES reminders(id) ON DELETE SET NULL;

alter table only public.practice_document_profiles add constraint practice_document_profiles_document_id_fkey FOREIGN KEY (document_id) REFERENCES documents(document_id) ON DELETE CASCADE;

alter table only public.practice_to_knowledge_references add constraint practice_to_knowledge_references_knowledge_doc_id_fkey FOREIGN KEY (knowledge_doc_id) REFERENCES documents(document_id) ON DELETE SET NULL;

alter table only public.practice_to_knowledge_references add constraint practice_to_knowledge_references_practice_doc_id_fkey FOREIGN KEY (practice_doc_id) REFERENCES documents(document_id) ON DELETE CASCADE;

alter table only public.profile_compat_settings add constraint profile_compat_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES app.user_profiles(user_id) ON DELETE CASCADE;

alter table only public.reminders add constraint reminders_user_id_fkey FOREIGN KEY (user_id) REFERENCES app.user_profiles(user_id) ON DELETE CASCADE;

alter table only public.search_chunks add constraint search_chunks_document_id_fkey FOREIGN KEY (document_id) REFERENCES documents(document_id) ON DELETE CASCADE;

alter table only public.search_chunks add constraint search_chunks_legal_unit_id_fkey FOREIGN KEY (legal_unit_id) REFERENCES legal_units(unit_id) ON DELETE SET NULL;

alter table only public.search_chunks add constraint search_chunks_version_id_fkey FOREIGN KEY (version_id) REFERENCES document_versions(version_id) ON DELETE CASCADE;

alter table only public.search_chunks_legal_unit add constraint search_chunks_legal_unit_document_id_fkey FOREIGN KEY (document_id) REFERENCES documents(document_id) ON DELETE CASCADE;

alter table only public.search_chunks_legal_unit add constraint search_chunks_legal_unit_legacy_chunk_id_fkey FOREIGN KEY (legacy_chunk_id) REFERENCES search_chunks(chunk_id) ON DELETE SET NULL;

alter table only public.search_chunks_legal_unit add constraint search_chunks_legal_unit_source_document_id_fkey FOREIGN KEY (source_document_id) REFERENCES documents(document_id) ON DELETE CASCADE;

alter table only public.search_chunks_legal_unit add constraint search_chunks_legal_unit_version_id_fkey FOREIGN KEY (version_id) REFERENCES document_versions(version_id) ON DELETE CASCADE;

alter table only public.search_chunks_legal_unit_embeddings add constraint search_chunks_legal_unit_embeddings_chunk_id_fkey FOREIGN KEY (chunk_id) REFERENCES search_chunks_legal_unit(chunk_id) ON DELETE CASCADE;

alter table only public.team_members add constraint team_members_team_id_fkey FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE;

alter table only public.telegram_uploads add constraint telegram_uploads_user_id_fkey FOREIGN KEY (user_id) REFERENCES app.user_profiles(user_id) ON DELETE CASCADE;

alter table only public.telegram_verification_codes add constraint telegram_verification_codes_user_id_fkey FOREIGN KEY (user_id) REFERENCES app.user_profiles(user_id) ON DELETE CASCADE;

alter table only public.user_feedback add constraint user_feedback_case_id_fkey FOREIGN KEY (case_id) REFERENCES app.cases(case_id) ON DELETE CASCADE;

alter table only public.version_authorities add constraint version_authorities_authority_id_fkey FOREIGN KEY (authority_id) REFERENCES authorities(authority_id) ON DELETE RESTRICT;

alter table only public.version_authorities add constraint version_authorities_version_id_fkey FOREIGN KEY (version_id) REFERENCES document_versions(version_id) ON DELETE CASCADE;

-- Non-constraint indexes [APPLICATION_CONTRACT_REQUIRED]
CREATE INDEX ai_analysis_runs_case_id_idx ON app.ai_analysis_runs USING btree (case_id);

CREATE INDEX ai_analysis_runs_triggered_by_idx ON app.ai_analysis_runs USING btree (triggered_by);

CREATE INDEX case_members_case_id_idx ON app.case_members USING btree (case_id);

CREATE INDEX case_members_user_id_idx ON app.case_members USING btree (user_id);

CREATE INDEX case_messages_case_id_idx ON app.case_messages USING btree (case_id);

CREATE INDEX case_messages_sender_id_idx ON app.case_messages USING btree (sender_id);

CREATE INDEX cases_created_by_idx ON app.cases USING btree (created_by);

CREATE INDEX cases_lawyer_id_idx ON app.cases USING btree (lawyer_id);

CREATE INDEX cases_status_idx ON app.cases USING btree (status);

CREATE INDEX client_documents_case_id_idx ON app.client_documents USING btree (case_id);

CREATE INDEX client_documents_uploaded_by_idx ON app.client_documents USING btree (uploaded_by);

CREATE INDEX generated_documents_case_id_idx ON app.generated_documents USING btree (case_id);

CREATE INDEX generated_documents_created_by_idx ON app.generated_documents USING btree (created_by);

CREATE INDEX legal_decisions_case_created_at_idx ON app.legal_decisions USING btree (case_id, created_at DESC);

CREATE INDEX legal_decisions_case_latest_idx ON app.legal_decisions USING btree (case_id, is_latest);

CREATE INDEX legal_decisions_data_gin_idx ON app.legal_decisions USING gin (decision_data);

CREATE UNIQUE INDEX legal_decisions_single_latest_idx ON app.legal_decisions USING btree (case_id) WHERE (is_latest = true);

CREATE INDEX legal_decisions_version_hash_idx ON app.legal_decisions USING btree (version_hash);

CREATE INDEX multi_agent_runs_case_id_idx ON app.multi_agent_analysis_runs USING btree (case_id, created_at DESC);

CREATE INDEX multi_agent_runs_status_idx ON app.multi_agent_analysis_runs USING btree (status, updated_at);

CREATE UNIQUE INDEX user_profiles_username_key ON app.user_profiles USING btree (lower(username)) WHERE (username IS NOT NULL);

CREATE INDEX ai_metrics_case_id_idx ON internal.ai_metrics USING btree (case_id);

CREATE INDEX ai_metrics_created_at_idx ON internal.ai_metrics USING btree (created_at);

CREATE INDEX ai_metrics_fn_model_idx ON internal.ai_metrics USING btree (fn_name, model);

CREATE INDEX extraction_runs_source_file_id_idx ON internal.extraction_runs USING btree (source_file_id);

CREATE INDEX ingestion_jobs_status_idx ON internal.ingestion_jobs USING btree (status);

CREATE INDEX source_files_file_sha256_idx ON internal.source_files USING btree (file_sha256);

CREATE INDEX source_files_job_id_idx ON internal.source_files USING btree (job_id);

CREATE INDEX source_files_raw_record_sha256_idx ON internal.source_files USING btree (raw_record_sha256);

CREATE INDEX agent_analysis_runs_case_id_idx ON public.agent_analysis_runs USING btree (case_id);

CREATE INDEX agent_findings_agent_run_id_idx ON public.agent_findings USING btree (agent_run_id);

CREATE INDEX agent_findings_case_id_idx ON public.agent_findings USING btree (case_id);

CREATE INDEX aggregated_reports_case_id_idx ON public.aggregated_reports USING btree (case_id);

CREATE INDEX ai_prompt_versions_prompt_idx ON public.ai_prompt_versions USING btree (prompt_id, version_number DESC);

CREATE INDEX ai_prompts_function_idx ON public.ai_prompts USING btree (function_name, module_type);

CREATE UNIQUE INDEX ai_prompts_function_module_key ON public.ai_prompts USING btree (function_name, module_type);

CREATE UNIQUE INDEX authorities_name_normalized_unique_idx ON public.authorities USING btree (name_normalized) WHERE (name_normalized IS NOT NULL);

CREATE INDEX case_comments_case_idx ON public.case_comments USING btree (case_id, created_at);

CREATE INDEX case_parties_court_case_id_idx ON public.case_parties USING btree (court_case_id);

CREATE INDEX case_parties_party_id_idx ON public.case_parties USING btree (party_id);

CREATE INDEX case_volumes_case_id_idx ON public.case_volumes USING btree (case_id);

CREATE INDEX case_volumes_file_id_idx ON public.case_volumes USING btree (file_id);

CREATE INDEX idx_chat_messages_chat_id ON public.chat_messages USING btree (chat_id, created_at);

CREATE INDEX idx_chats_updated_at ON public.chats USING btree (updated_at DESC);

CREATE INDEX idx_chats_user_id ON public.chats USING btree (user_id);

CREATE INDEX court_cases_document_id_idx ON public.court_cases USING btree (document_id);

CREATE INDEX document_pages_version_id_idx ON public.document_pages USING btree (version_id);

CREATE INDEX document_references_from_document_id_idx ON public.document_references USING btree (from_document_id);

CREATE INDEX document_references_to_document_id_idx ON public.document_references USING btree (to_document_id);

CREATE INDEX document_tables_document_id_idx ON public.document_tables USING btree (document_id);

CREATE INDEX document_tables_needs_human_review_idx ON public.document_tables USING btree (needs_human_review);

CREATE INDEX document_tables_table_class_idx ON public.document_tables USING btree (table_class);

CREATE INDEX document_tables_version_id_idx ON public.document_tables USING btree (version_id);

CREATE UNIQUE INDEX document_templates_category_subcategory_key ON public.document_templates USING btree (category, subcategory);

CREATE INDEX document_topics_document_id_idx ON public.document_topics USING btree (document_id);

CREATE INDEX document_topics_topic_id_idx ON public.document_topics USING btree (topic_id);

CREATE INDEX document_versions_current_idx ON public.document_versions USING btree (document_id, is_current);

CREATE INDEX document_versions_document_id_idx ON public.document_versions USING btree (document_id);

CREATE INDEX document_versions_publication_source_id_idx ON public.document_versions USING btree (publication_source_id);

CREATE INDEX document_versions_source_file_id_idx ON public.document_versions USING btree (source_file_id);

CREATE INDEX documents_arlis_doc_id_lookup_idx ON public.documents USING btree (regexp_replace(lower(COALESCE(arlis_doc_id, ''::text)), '[^[:alnum:]]+'::text, ''::text, 'g'::text));

CREATE INDEX documents_canonical_key_lookup_idx ON public.documents USING btree (regexp_replace(lower(COALESCE(canonical_key, ''::text)), '[^[:alnum:]]+'::text, ''::text, 'g'::text));

CREATE INDEX documents_canonical_key_pattern_idx ON public.documents USING btree (canonical_key text_pattern_ops);

CREATE INDEX documents_content_status_idx ON public.documents USING btree (content_domain, normalized_status);

CREATE INDEX documents_doc_number_clean_lookup_idx ON public.documents USING btree (regexp_replace(lower(COALESCE(doc_number_clean, ''::text)), '[^[:alnum:]]+'::text, ''::text, 'g'::text));

CREATE INDEX documents_doc_number_clean_trgm_idx ON public.documents USING gin (doc_number_clean gin_trgm_ops);

CREATE INDEX documents_document_type_id_idx ON public.documents USING btree (document_type_id);

CREATE INDEX documents_effective_dates_idx ON public.documents USING btree (effective_from, effective_to);

CREATE INDEX documents_jurisdiction_id_idx ON public.documents USING btree (jurisdiction_id);

CREATE INDEX documents_source_metadata_gin ON public.documents USING gin (source_metadata);

CREATE INDEX documents_title_hy_trgm_idx ON public.documents USING gin (title_hy gin_trgm_ops);

CREATE INDEX documents_title_ru_trgm_idx ON public.documents USING gin (title_ru gin_trgm_ops);

CREATE INDEX embeddings_chunk_id_idx ON public.embeddings USING btree (chunk_id);

CREATE INDEX embeddings_ivf_metric_idx ON public.embeddings USING ivfflat (vector vector_cosine_ops) WITH (lists='900') WHERE ((model = 'armenian-text-embeddings-2-large'::text) AND (status = 'success'::text));

CREATE INDEX embeddings_ivf_qwen_idx ON public.embeddings USING ivfflat (vector vector_cosine_ops) WITH (lists='400') WHERE ((model = 'qwen3-embedding-0.6b'::text) AND (status = 'success'::text));

CREATE INDEX embeddings_model_status_idx ON public.embeddings USING btree (model, status);

CREATE INDEX evidence_registry_case_id_idx ON public.evidence_registry USING btree (case_id);

CREATE INDEX fragment_translations_chunk_idx ON public.fragment_translations USING btree (chunk_id);

CREATE INDEX knowledge_base_chunk_id_idx ON public.knowledge_base USING btree (chunk_id);

CREATE INDEX knowledge_base_document_id_idx ON public.knowledge_base USING btree (document_id);

CREATE INDEX knowledge_document_profiles_document_id_idx ON public.knowledge_document_profiles USING btree (document_id);

CREATE INDEX legal_documents_chunk_id_idx ON public.legal_documents USING btree (chunk_id);

CREATE INDEX legal_documents_document_id_idx ON public.legal_documents USING btree (document_id);

CREATE INDEX legal_edges_from_idx ON public.legal_edges USING btree (from_document_id);

CREATE INDEX legal_edges_to_idx ON public.legal_edges USING btree (to_document_id);

CREATE INDEX legal_edges_type_idx ON public.legal_edges USING btree (edge_type);

CREATE INDEX legal_units_document_id_idx ON public.legal_units USING btree (document_id);

CREATE INDEX legal_units_parent_unit_id_idx ON public.legal_units USING btree (parent_unit_id);

CREATE INDEX legal_units_unit_number_lookup_idx ON public.legal_units USING btree (regexp_replace(lower(COALESCE(unit_number, ''::text)), '[^[:alnum:]]+'::text, ''::text, 'g'::text));

CREATE INDEX legal_units_version_id_idx ON public.legal_units USING btree (version_id);

CREATE INDEX notifications_user_idx ON public.notifications USING btree (user_id, is_read, created_at DESC);

CREATE INDEX idx_ocr_text_gin ON public.ocr_results USING gin (to_tsvector('simple'::regconfig, extracted_text));

CREATE INDEX practice_document_profiles_document_id_idx ON public.practice_document_profiles USING btree (document_id);

CREATE INDEX practice_to_knowledge_references_knowledge_doc_id_idx ON public.practice_to_knowledge_references USING btree (knowledge_doc_id);

CREATE INDEX practice_to_knowledge_references_practice_doc_id_idx ON public.practice_to_knowledge_references USING btree (practice_doc_id);

CREATE INDEX profile_compat_settings_telegram_chat_id_idx ON public.profile_compat_settings USING btree (telegram_chat_id);

CREATE INDEX reminders_event_idx ON public.reminders USING btree (event_datetime) WHERE (status = 'active'::text);

CREATE INDEX reminders_user_idx ON public.reminders USING btree (user_id, status);

CREATE INDEX search_chunks_article_number_idx ON public.search_chunks USING btree (article_number);

CREATE INDEX search_chunks_chunk_text_sha256_idx ON public.search_chunks USING btree (chunk_text_sha256);

CREATE INDEX search_chunks_chunk_version_idx ON public.search_chunks USING btree (chunk_version);

CREATE INDEX search_chunks_citation_anchor_idx ON public.search_chunks USING btree (citation_anchor);

CREATE INDEX search_chunks_citation_anchor_lookup_idx ON public.search_chunks USING btree (regexp_replace(lower(COALESCE(citation_anchor, ''::text)), '[^[:alnum:]]+'::text, ''::text, 'g'::text));

CREATE INDEX search_chunks_content_status_idx ON public.search_chunks USING btree (content_domain, norm_status);

CREATE INDEX search_chunks_document_id_idx ON public.search_chunks USING btree (document_id);

CREATE INDEX search_chunks_echr_practice_idx ON public.search_chunks USING btree (content_domain, language_code, created_at, chunk_id) WHERE ((content_domain = 'practice'::content_domain) AND (language_code = ANY (ARRAY['en'::text, 'fr'::text])));

CREATE INDEX search_chunks_effective_dates_idx ON public.search_chunks USING btree (effective_from, effective_to);

CREATE INDEX search_chunks_fts_vector_idx ON public.search_chunks USING gin (fts_vector);

CREATE INDEX search_chunks_language_created_idx ON public.search_chunks USING btree (language_code, created_at, chunk_id);

CREATE INDEX search_chunks_language_idx ON public.search_chunks USING btree (language);

CREATE INDEX search_chunks_legal_unit_id_idx ON public.search_chunks USING btree (legal_unit_id);

CREATE INDEX search_chunks_legal_unit_type_number_idx ON public.search_chunks USING btree (legal_unit_type, legal_unit_number);

CREATE INDEX search_chunks_normalized_domain_idx ON public.search_chunks USING btree (normalized_domain);

CREATE INDEX search_chunks_parent_legal_unit_id_idx ON public.search_chunks USING btree (parent_legal_unit_id);

CREATE INDEX search_chunks_source_date_idx ON public.search_chunks USING btree (source_date);

CREATE INDEX search_chunks_source_document_id_idx ON public.search_chunks USING btree (source_document_id);

CREATE INDEX search_chunks_version_id_idx ON public.search_chunks USING btree (version_id);

CREATE INDEX search_chunks_legal_unit_chunk_version_idx ON public.search_chunks_legal_unit USING btree (chunk_version);

CREATE INDEX search_chunks_legal_unit_citation_anchor_idx ON public.search_chunks_legal_unit USING btree (citation_anchor);

CREATE INDEX search_chunks_legal_unit_content_domain_idx ON public.search_chunks_legal_unit USING btree (content_domain);

CREATE INDEX search_chunks_legal_unit_document_id_idx ON public.search_chunks_legal_unit USING btree (document_id);

CREATE INDEX search_chunks_legal_unit_effective_dates_idx ON public.search_chunks_legal_unit USING btree (effective_from, effective_to);

CREATE INDEX search_chunks_legal_unit_fts_idx ON public.search_chunks_legal_unit USING gin (fts_vector);

CREATE INDEX search_chunks_legal_unit_hash_idx ON public.search_chunks_legal_unit USING btree (chunk_text_sha256);

CREATE INDEX search_chunks_legal_unit_language_idx ON public.search_chunks_legal_unit USING btree (language);

CREATE INDEX search_chunks_legal_unit_legal_unit_id_idx ON public.search_chunks_legal_unit USING btree (legal_unit_id);

CREATE INDEX search_chunks_legal_unit_parent_legal_unit_id_idx ON public.search_chunks_legal_unit USING btree (parent_legal_unit_id);

CREATE INDEX search_chunks_legal_unit_source_date_idx ON public.search_chunks_legal_unit USING btree (source_date);

CREATE INDEX search_chunks_legal_unit_source_document_id_idx ON public.search_chunks_legal_unit USING btree (source_document_id);

CREATE INDEX search_chunks_legal_unit_version_id_idx ON public.search_chunks_legal_unit USING btree (version_id);

CREATE INDEX search_chunks_legal_unit_embeddings_chunk_idx ON public.search_chunks_legal_unit_embeddings USING btree (chunk_id);

CREATE INDEX search_chunks_legal_unit_embeddings_hash_idx ON public.search_chunks_legal_unit_embeddings USING btree (chunk_text_sha256);

CREATE INDEX search_chunks_legal_unit_embeddings_model_idx ON public.search_chunks_legal_unit_embeddings USING btree (model);

CREATE INDEX search_chunks_legal_unit_embeddings_vector_idx ON public.search_chunks_legal_unit_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists='100') WHERE ((status = 'success'::text) AND (embedding IS NOT NULL));

CREATE INDEX telegram_uploads_telegram_chat_id_idx ON public.telegram_uploads USING btree (telegram_chat_id);

CREATE INDEX telegram_uploads_user_id_idx ON public.telegram_uploads USING btree (user_id);

CREATE INDEX telegram_verification_codes_code_idx ON public.telegram_verification_codes USING btree (code);

CREATE INDEX telegram_verification_codes_user_id_idx ON public.telegram_verification_codes USING btree (user_id);

CREATE INDEX user_feedback_rating_idx ON public.user_feedback USING btree (rating, created_at DESC);

CREATE INDEX user_notes_user_idx ON public.user_notes USING btree (user_id, updated_at DESC);

CREATE INDEX version_authorities_authority_id_idx ON public.version_authorities USING btree (authority_id);

CREATE INDEX version_authorities_version_id_idx ON public.version_authorities USING btree (version_id);

-- Compatibility views [COMPATIBILITY_REQUIRED]
create view public.ai_analysis with (security_invoker=on) as
 SELECT run_id AS id,
    case_id,
    model_used AS role,
    COALESCE(result_jsonb ->> 'response_text'::text, result_jsonb ->> 'analysis'::text, result_jsonb ->> 'summary'::text) AS response_text,
    COALESCE(result_jsonb -> 'sources_used'::text, '[]'::jsonb) AS sources_used,
    created_at,
    query_text AS prompt_used,
    triggered_by AS created_by
   FROM app.ai_analysis_runs ar;;

create view public.case_files with (security_invoker=on) as
 SELECT doc_id AS id,
    case_id,
    file_name AS filename,
    file_name AS original_filename,
    file_url AS storage_path,
    NULL::text AS file_type,
    file_size,
    1 AS version,
    uploaded_by,
    NULL::timestamp with time zone AS deleted_at,
    created_at,
    updated_at,
    NULL::text AS notes
   FROM app.client_documents cd;;

create view public.case_members with (security_invoker=on) as
 SELECT case_id,
    user_id,
    case_role
   FROM app.case_members cm;;

create view public.cases with (security_invoker=on) as
 SELECT case_id AS id,
    case_number,
    title,
    description,
    status,
    priority,
    lawyer_id,
    client_id,
    case_type,
    current_stage,
    court_name,
    court_date,
    facts,
    legal_question,
    deleted_at,
    created_at,
    updated_at,
    court_name AS court,
    party_role,
    appeal_party_role,
    notes
   FROM app.cases c;;

create view public.generated_documents with (security_invoker=on) as
 SELECT generated_id AS id,
    case_id,
    created_by AS user_id,
    template AS document_type,
    template AS title,
    content,
    metadata,
    created_at,
    updated_at,
    NULL::uuid AS template_id,
    content AS content_text,
    'draft'::text AS status,
    NULL::text AS recipient_name,
    NULL::text AS recipient_position,
    NULL::text AS recipient_organization,
    NULL::text AS sender_name,
    NULL::text AS sender_address,
    NULL::text AS sender_contact,
    NULL::text AS source_text
   FROM app.generated_documents gd;;

create view public.profiles with (security_invoker=on) as
 SELECT up.user_id AS id,
    up.full_name,
    up.email,
    up.app_role::text AS role,
    up.is_active,
    true AS has_migrated,
    up.updated_at AS last_login_at,
    up.updated_at,
    NULL::text AS avatar_url,
    NULL::jsonb AS preferences,
    pcs.telegram_chat_id,
    pcs.notification_preferences,
    up.created_at,
    up.username,
    up.auditor_id
   FROM app.user_profiles up
     LEFT JOIN profile_compat_settings pcs ON pcs.user_id = up.user_id;;

create view public.user_roles with (security_invoker=on) as
 SELECT user_id AS id,
    user_id,
    app_role::text AS role
   FROM app.user_profiles up;;

-- Triggers, including Auth bootstrap [SECURITY_BASELINE_REQUIRED]
CREATE TRIGGER set_updated_at BEFORE UPDATE ON app.ai_analysis_runs FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON app.case_members FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON app.case_messages FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON app.cases FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON app.client_documents FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON app.generated_documents FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER legal_decisions_immutable_data BEFORE UPDATE ON app.legal_decisions FOR EACH ROW EXECUTE FUNCTION app.prevent_legal_decision_data_update();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON app.multi_agent_analysis_runs FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON app.user_profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON internal.extraction_runs FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON internal.ingestion_jobs FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON internal.source_files FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON agent_analysis_runs FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON agent_findings FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON aggregated_reports FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER ai_analysis_insert_tg INSTEAD OF INSERT ON ai_analysis FOR EACH ROW EXECUTE FUNCTION ai_analysis_view_insert();

CREATE TRIGGER ai_prompts_set_updated_at BEFORE UPDATE ON ai_prompts FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON authorities FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER case_comments_set_updated_at BEFORE UPDATE ON case_comments FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER case_files_compat_delete INSTEAD OF DELETE ON case_files FOR EACH ROW EXECUTE FUNCTION case_files_compat_delete();

CREATE TRIGGER case_files_compat_insert INSTEAD OF INSERT ON case_files FOR EACH ROW EXECUTE FUNCTION case_files_compat_insert();

CREATE TRIGGER case_members_compat_delete INSTEAD OF DELETE ON case_members FOR EACH ROW EXECUTE FUNCTION case_members_compat_delete();

CREATE TRIGGER case_members_compat_insert INSTEAD OF INSERT ON case_members FOR EACH ROW EXECUTE FUNCTION case_members_compat_insert();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON case_parties FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON case_volumes FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON court_cases FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON document_pages FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON document_references FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON document_tables FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER document_templates_set_updated_at BEFORE UPDATE ON document_templates FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON document_topics FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON document_types FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON document_versions FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON documents FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON embeddings FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON evidence_registry FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER generated_documents_insert_tg INSTEAD OF INSERT ON generated_documents FOR EACH ROW EXECUTE FUNCTION generated_documents_view_insert();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON judges FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON jurisdictions FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON knowledge_base FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON knowledge_document_profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON legal_documents FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON legal_edges FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON legal_units FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON parties FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON practice_document_profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON practice_to_knowledge_references FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON profile_compat_settings FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER profiles_compat_update INSTEAD OF UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION profiles_compat_update();

CREATE TRIGGER profiles_delete_tg INSTEAD OF DELETE ON profiles FOR EACH ROW EXECUTE FUNCTION profiles_view_delete();

CREATE TRIGGER profiles_insert_tg INSTEAD OF INSERT ON profiles FOR EACH ROW EXECUTE FUNCTION profiles_view_insert();

CREATE TRIGGER profiles_update_tg INSTEAD OF UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION profiles_view_update();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON publication_sources FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER reminders_set_updated_at BEFORE UPDATE ON reminders FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON search_chunks FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at_search_chunks_legal_unit BEFORE UPDATE ON search_chunks_legal_unit FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at_search_chunks_legal_unit_embeddings BEFORE UPDATE ON search_chunks_legal_unit_embeddings FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER teams_set_updated_at BEFORE UPDATE ON teams FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON telegram_uploads FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON telegram_verification_codes FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON topics FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER user_notes_set_updated_at BEFORE UPDATE ON user_notes FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER user_roles_delete_tg INSTEAD OF DELETE ON user_roles FOR EACH ROW EXECUTE FUNCTION user_roles_view_delete();

CREATE TRIGGER user_roles_insert_tg INSTEAD OF INSERT ON user_roles FOR EACH ROW EXECUTE FUNCTION user_roles_view_insert();

CREATE TRIGGER user_roles_update_tg INSTEAD OF UPDATE ON user_roles FOR EACH ROW EXECUTE FUNCTION user_roles_view_update();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON version_authorities FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Row-level security policies [SECURITY_BASELINE_REQUIRED]
create policy ai_delete on app.ai_analysis_runs as permissive for delete to authenticated
using ((app.get_my_role() = 'admin'::app.app_role));

create policy ai_insert on app.ai_analysis_runs as permissive for insert to authenticated
with check (((triggered_by = auth.uid()) AND app.can_read_case(case_id)));

create policy ai_select on app.ai_analysis_runs as permissive for select to authenticated
using ((app.can_read_case(case_id) OR (triggered_by = auth.uid())));

create policy ai_update on app.ai_analysis_runs as permissive for update to authenticated
using (false)
with check (false);

create policy cm_delete on app.case_members as permissive for delete to authenticated
using (app.can_manage_case(case_id));

create policy cm_insert on app.case_members as permissive for insert to authenticated
with check (app.can_manage_case(case_id));

create policy cm_select on app.case_members as permissive for select to authenticated
using (((app.get_my_role() = 'admin'::app.app_role) OR (user_id = auth.uid()) OR app.is_case_lawyer(case_id)));

create policy cm_update on app.case_members as permissive for update to authenticated
using (app.can_manage_case(case_id))
with check (app.can_manage_case(case_id));

create policy msg_delete on app.case_messages as permissive for delete to authenticated
using ((app.get_my_role() = 'admin'::app.app_role));

create policy msg_insert on app.case_messages as permissive for insert to authenticated
with check (((sender_id = auth.uid()) AND app.can_read_case(case_id)));

create policy msg_select on app.case_messages as permissive for select to authenticated
using ((app.can_read_case(case_id) OR (sender_id = auth.uid())));

create policy msg_update on app.case_messages as permissive for update to authenticated
using (((sender_id = auth.uid()) OR (app.get_my_role() = 'admin'::app.app_role)))
with check ((((sender_id = auth.uid()) OR (app.get_my_role() = 'admin'::app.app_role)) AND app.can_read_case(case_id)));

create policy cases_delete on app.cases as permissive for delete to authenticated
using ((app.get_my_role() = 'admin'::app.app_role));

create policy cases_insert on app.cases as permissive for insert to authenticated
with check (((created_by = auth.uid()) AND ((app.get_my_role() = 'admin'::app.app_role) OR ((app.get_my_role() = 'lawyer'::app.app_role) AND (lawyer_id = auth.uid())))));

create policy cases_select on app.cases as permissive for select to authenticated
using (app.can_read_case(case_id));

create policy cases_update on app.cases as permissive for update to authenticated
using (app.can_manage_case(case_id))
with check (((app.get_my_role() = 'admin'::app.app_role) OR ((app.get_my_role() = 'lawyer'::app.app_role) AND (lawyer_id = auth.uid()))));

create policy "Case members can upload documents" on app.client_documents as permissive for insert to authenticated
with check (app.check_case_upload_access(case_id));

create policy cd_delete on app.client_documents as permissive for delete to authenticated
using (((uploaded_by = auth.uid()) OR app.can_manage_case(case_id)));

create policy cd_select on app.client_documents as permissive for select to authenticated
using (app.can_read_case(case_id));

create policy cd_update on app.client_documents as permissive for update to authenticated
using (((app.get_my_role() = 'admin'::app.app_role) OR (uploaded_by = auth.uid()) OR app.is_case_lawyer(case_id)))
with check ((((app.get_my_role() = 'admin'::app.app_role) OR (uploaded_by = auth.uid()) OR app.is_case_lawyer(case_id)) AND app.can_read_case(case_id)));

create policy gd_delete on app.generated_documents as permissive for delete to authenticated
using ((app.get_my_role() = 'admin'::app.app_role));

create policy gd_insert on app.generated_documents as permissive for insert to authenticated
with check (((created_by = auth.uid()) AND ((case_id IS NULL) OR app.can_read_case(case_id))));

create policy gd_select on app.generated_documents as permissive for select to authenticated
using ((app.can_read_case(case_id) OR (created_by = auth.uid())));

create policy gd_update on app.generated_documents as permissive for update to authenticated
using (((created_by = auth.uid()) OR (app.get_my_role() = 'admin'::app.app_role)))
with check ((((created_by = auth.uid()) OR (app.get_my_role() = 'admin'::app.app_role)) AND app.can_manage_case(case_id)));

create policy legal_decisions_case_access_select on app.legal_decisions as permissive for select to authenticated
using (app.can_read_case(case_id));

create policy legal_decisions_service_insert on app.legal_decisions as permissive for insert to service_role
with check (true);

create policy legal_decisions_service_select on app.legal_decisions as permissive for select to service_role
using (true);

create policy legal_decisions_service_update on app.legal_decisions as permissive for update to service_role
using (true)
with check (true);

create policy multi_agent_runs_select on app.multi_agent_analysis_runs as permissive for select to authenticated
using ((app.can_read_case(case_id) AND ((requested_by = auth.uid()) OR (app.get_my_role() = 'admin'::app.app_role) OR app.is_case_lawyer(case_id))));

create policy multi_agent_runs_service on app.multi_agent_analysis_runs as permissive for all to service_role
using (true)
with check (true);

create policy up_delete on app.user_profiles as permissive for delete to authenticated
using ((app.get_my_role() = 'admin'::app.app_role));

create policy up_insert_service on app.user_profiles as permissive for insert to service_role
with check (true);

create policy up_select on app.user_profiles as permissive for select to authenticated
using (((user_id = auth.uid()) OR (app.get_my_role() = 'admin'::app.app_role)));

create policy up_update on app.user_profiles as permissive for update to authenticated
using (((user_id = auth.uid()) OR (app.get_my_role() = 'admin'::app.app_role)))
with check (((user_id = auth.uid()) OR (app.get_my_role() = 'admin'::app.app_role)));

create policy ai_metrics_service on internal.ai_metrics as permissive for all to service_role
using (true)
with check (true);

create policy internal_service_only on internal.extraction_runs as permissive for all to service_role
using (true)
with check (true);

create policy internal_service_only on internal.ingestion_jobs as permissive for all to service_role
using (true)
with check (true);

create policy internal_service_only on internal.source_files as permissive for all to service_role
using (true)
with check (true);

create policy aar_insert on public.agent_analysis_runs as permissive for insert to authenticated
with check (app.can_read_case(case_id));

create policy aar_select on public.agent_analysis_runs as permissive for select to authenticated
using (app.can_read_case(case_id));

create policy aar_service on public.agent_analysis_runs as permissive for all to service_role
using (true)
with check (true);

create policy aar_update on public.agent_analysis_runs as permissive for update to authenticated
using (app.can_read_case(case_id))
with check (app.can_read_case(case_id));

create policy af_insert on public.agent_findings as permissive for insert to authenticated
with check (app.can_read_case(case_id));

create policy af_select on public.agent_findings as permissive for select to authenticated
using (app.can_read_case(case_id));

create policy af_service on public.agent_findings as permissive for all to service_role
using (true)
with check (true);

create policy ar_insert on public.aggregated_reports as permissive for insert to authenticated
with check (app.can_read_case(case_id));

create policy ar_select on public.aggregated_reports as permissive for select to authenticated
using (app.can_read_case(case_id));

create policy ar_service on public.aggregated_reports as permissive for all to service_role
using (true)
with check (true);

create policy ai_prompt_versions_admin_write on public.ai_prompt_versions as permissive for insert to authenticated
with check ((app.get_my_role() = 'admin'::app.app_role));

create policy ai_prompt_versions_read on public.ai_prompt_versions as permissive for select to authenticated
using (true);

create policy ai_prompt_versions_service on public.ai_prompt_versions as permissive for all to service_role
using (true)
with check (true);

create policy ai_prompts_admin_delete on public.ai_prompts as permissive for delete to authenticated
using ((app.get_my_role() = 'admin'::app.app_role));

create policy ai_prompts_admin_update on public.ai_prompts as permissive for update to authenticated
using ((app.get_my_role() = 'admin'::app.app_role))
with check ((app.get_my_role() = 'admin'::app.app_role));

create policy ai_prompts_admin_write on public.ai_prompts as permissive for insert to authenticated
with check ((app.get_my_role() = 'admin'::app.app_role));

create policy ai_prompts_read on public.ai_prompts as permissive for select to authenticated
using (true);

create policy ai_prompts_service on public.ai_prompts as permissive for all to service_role
using (true)
with check (true);

create policy app_settings_admin_insert on public.app_settings as permissive for insert to authenticated
with check ((app.get_my_role() = 'admin'::app.app_role));

create policy app_settings_admin_update on public.app_settings as permissive for update to authenticated
using ((app.get_my_role() = 'admin'::app.app_role))
with check ((app.get_my_role() = 'admin'::app.app_role));

create policy app_settings_read on public.app_settings as permissive for select to authenticated
using (true);

create policy app_settings_service on public.app_settings as permissive for all to service_role
using (true)
with check (true);

create policy "Case members can insert audio transcriptions" on public.audio_transcriptions as permissive for insert to authenticated
with check (((file_id IN ( SELECT cf.id
   FROM (case_files cf
     JOIN cases c ON ((c.id = cf.case_id)))
  WHERE ((cf.deleted_at IS NULL) AND ((c.lawyer_id = auth.uid()) OR (c.client_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::text))))));

create policy "Users can view audio transcriptions of their files" on public.audio_transcriptions as permissive for select to authenticated
using (((file_id IN ( SELECT cf.id
   FROM (case_files cf
     JOIN cases c ON ((cf.case_id = c.id)))
  WHERE ((c.lawyer_id = auth.uid()) OR (c.client_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::text))))));

create policy audit_logs_admin_read on public.audit_logs as permissive for select to authenticated
using ((app.get_my_role() = 'admin'::app.app_role));

create policy audit_logs_service on public.audit_logs as permissive for all to service_role
using (true)
with check (true);

create policy corpus_read on public.authorities as permissive for select to authenticated
using (true);

create policy corpus_write on public.authorities as permissive for all to service_role
using (true)
with check (true);

create policy case_comments_delete on public.case_comments as permissive for delete to authenticated
using (((author_id = auth.uid()) OR (app.get_my_role() = 'admin'::app.app_role)));

create policy case_comments_insert on public.case_comments as permissive for insert to authenticated
with check (((author_id = auth.uid()) AND app.can_read_case(case_id)));

create policy case_comments_select on public.case_comments as permissive for select to authenticated
using (app.can_read_case(case_id));

create policy case_comments_service on public.case_comments as permissive for all to service_role
using (true)
with check (true);

create policy case_comments_update on public.case_comments as permissive for update to authenticated
using (((author_id = auth.uid()) OR (app.get_my_role() = 'admin'::app.app_role)))
with check (app.can_read_case(case_id));

create policy case_parties_read on public.case_parties as permissive for select to authenticated
using (true);

create policy case_parties_service on public.case_parties as permissive for all to service_role
using (true)
with check (true);

create policy case_volumes_read on public.case_volumes as permissive for select to authenticated
using (app.can_read_case(case_id));

create policy case_volumes_service on public.case_volumes as permissive for all to service_role
using (true)
with check (true);

create policy chat_messages_delete_own on public.chat_messages as permissive for delete to authenticated
using ((chat_id IN ( SELECT chats.id
   FROM chats
  WHERE (chats.user_id = auth.uid()))));

create policy chat_messages_insert_own on public.chat_messages as permissive for insert to authenticated
with check ((chat_id IN ( SELECT chats.id
   FROM chats
  WHERE (chats.user_id = auth.uid()))));

create policy chat_messages_select_own on public.chat_messages as permissive for select to authenticated
using ((chat_id IN ( SELECT chats.id
   FROM chats
  WHERE (chats.user_id = auth.uid()))));

create policy chat_messages_update_own on public.chat_messages as permissive for update to authenticated
using ((chat_id IN ( SELECT chats.id
   FROM chats
  WHERE (chats.user_id = auth.uid()))));

create policy chats_delete_own on public.chats as permissive for delete to authenticated
using ((user_id = auth.uid()));

create policy chats_insert_own on public.chats as permissive for insert to authenticated
with check ((user_id = auth.uid()));

create policy chats_select_own on public.chats as permissive for select to authenticated
using ((user_id = auth.uid()));

create policy chats_update_own on public.chats as permissive for update to authenticated
using ((user_id = auth.uid()));

create policy court_cases_read on public.court_cases as permissive for select to authenticated
using (true);

create policy court_cases_service on public.court_cases as permissive for all to service_role
using (true)
with check (true);

create policy corpus_read on public.document_pages as permissive for select to authenticated
using (true);

create policy corpus_write on public.document_pages as permissive for all to service_role
using (true)
with check (true);

create policy corpus_read on public.document_references as permissive for select to authenticated
using (true);

create policy corpus_write on public.document_references as permissive for all to service_role
using (true)
with check (true);

create policy corpus_read on public.document_table_cells as permissive for select to authenticated
using (true);

create policy corpus_write on public.document_table_cells as permissive for all to service_role
using (true)
with check (true);

create policy corpus_read on public.document_tables as permissive for select to authenticated
using (true);

create policy corpus_write on public.document_tables as permissive for all to service_role
using (true)
with check (true);

create policy document_templates_admin_update on public.document_templates as permissive for update to authenticated
using ((app.get_my_role() = 'admin'::app.app_role))
with check ((app.get_my_role() = 'admin'::app.app_role));

create policy document_templates_admin_write on public.document_templates as permissive for insert to authenticated
with check ((app.get_my_role() = 'admin'::app.app_role));

create policy document_templates_read on public.document_templates as permissive for select to authenticated
using (true);

create policy document_templates_service on public.document_templates as permissive for all to service_role
using (true)
with check (true);

create policy corpus_read on public.document_topics as permissive for select to authenticated
using (true);

create policy corpus_write on public.document_topics as permissive for all to service_role
using (true)
with check (true);

create policy corpus_read on public.document_types as permissive for select to authenticated
using (true);

create policy corpus_write on public.document_types as permissive for all to service_role
using (true)
with check (true);

create policy corpus_read on public.document_versions as permissive for select to authenticated
using (true);

create policy corpus_write on public.document_versions as permissive for all to service_role
using (true)
with check (true);

create policy corpus_read on public.documents as permissive for select to authenticated
using (true);

create policy corpus_write on public.documents as permissive for all to service_role
using (true)
with check (true);

create policy corpus_read on public.embeddings as permissive for select to authenticated
using (true);

create policy corpus_write on public.embeddings as permissive for all to service_role
using (true)
with check (true);

create policy error_logs_insert on public.error_logs as permissive for insert to authenticated
with check (true);

create policy error_logs_select on public.error_logs as permissive for select to authenticated
using (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM app.user_profiles
  WHERE ((user_profiles.user_id = auth.uid()) AND (user_profiles.app_role = 'admin'::app.app_role))))));

create policy error_logs_service on public.error_logs as permissive for all to service_role
using (true)
with check (true);

create policy er_insert on public.evidence_registry as permissive for insert to authenticated
with check (app.can_read_case(case_id));

create policy er_select on public.evidence_registry as permissive for select to authenticated
using (app.can_read_case(case_id));

create policy er_service on public.evidence_registry as permissive for all to service_role
using (true)
with check (true);

create policy er_update on public.evidence_registry as permissive for update to authenticated
using (app.can_read_case(case_id))
with check (app.can_read_case(case_id));

create policy fragment_translations_read on public.fragment_translations as permissive for select to authenticated
using (true);

create policy judges_read on public.judges as permissive for select to authenticated
using (true);

create policy judges_service on public.judges as permissive for all to service_role
using (true)
with check (true);

create policy corpus_read on public.jurisdictions as permissive for select to authenticated
using (true);

create policy corpus_write on public.jurisdictions as permissive for all to service_role
using (true)
with check (true);

create policy kb_versions_read on public.kb_versions as permissive for select to authenticated
using (true);

create policy kb_versions_service on public.kb_versions as permissive for all to service_role
using (true)
with check (true);

create policy knowledge_base_read on public.knowledge_base as permissive for select to authenticated
using (true);

create policy knowledge_base_service on public.knowledge_base as permissive for all to service_role
using (true)
with check (true);

create policy corpus_read on public.knowledge_document_profiles as permissive for select to authenticated
using (true);

create policy corpus_write on public.knowledge_document_profiles as permissive for all to service_role
using (true)
with check (true);

create policy legal_documents_read on public.legal_documents as permissive for select to authenticated
using (true);

create policy legal_documents_service on public.legal_documents as permissive for all to service_role
using (true)
with check (true);

create policy legal_edges_read on public.legal_edges as permissive for select to authenticated
using (true);

create policy legal_edges_service on public.legal_edges as permissive for all to service_role
using (true)
with check (true);

create policy corpus_read on public.legal_units as permissive for select to authenticated
using (true);

create policy corpus_write on public.legal_units as permissive for all to service_role
using (true)
with check (true);

create policy notifications_owner_delete on public.notifications as permissive for delete to authenticated
using ((user_id = auth.uid()));

create policy notifications_owner_select on public.notifications as permissive for select to authenticated
using ((user_id = auth.uid()));

create policy notifications_owner_update on public.notifications as permissive for update to authenticated
using ((user_id = auth.uid()))
with check ((user_id = auth.uid()));

create policy notifications_service on public.notifications as permissive for all to service_role
using (true)
with check (true);

create policy "Case members can insert OCR results" on public.ocr_results as permissive for insert to authenticated
with check (((file_id IN ( SELECT cf.id
   FROM (case_files cf
     JOIN cases c ON ((c.id = cf.case_id)))
  WHERE ((cf.deleted_at IS NULL) AND ((c.lawyer_id = auth.uid()) OR (c.client_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::text))))));

create policy "Users can view OCR of their files" on public.ocr_results as permissive for select to authenticated
using (((file_id IN ( SELECT cf.id
   FROM (case_files cf
     JOIN cases c ON ((cf.case_id = c.id)))
  WHERE ((c.lawyer_id = auth.uid()) OR (c.client_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::text))))));

create policy parties_read on public.parties as permissive for select to authenticated
using (true);

create policy parties_service on public.parties as permissive for all to service_role
using (true)
with check (true);

create policy corpus_read on public.practice_document_profiles as permissive for select to authenticated
using (true);

create policy corpus_write on public.practice_document_profiles as permissive for all to service_role
using (true)
with check (true);

create policy corpus_read on public.practice_to_knowledge_references as permissive for select to authenticated
using (true);

create policy corpus_write on public.practice_to_knowledge_references as permissive for all to service_role
using (true)
with check (true);

create policy profile_compat_settings_insert on public.profile_compat_settings as permissive for insert to authenticated
with check (((user_id = auth.uid()) OR (app.get_my_role() = 'admin'::app.app_role)));

create policy profile_compat_settings_select on public.profile_compat_settings as permissive for select to authenticated
using (((user_id = auth.uid()) OR (app.get_my_role() = 'admin'::app.app_role)));

create policy profile_compat_settings_service on public.profile_compat_settings as permissive for all to service_role
using (true)
with check (true);

create policy profile_compat_settings_update on public.profile_compat_settings as permissive for update to authenticated
using (((user_id = auth.uid()) OR (app.get_my_role() = 'admin'::app.app_role)))
with check (((user_id = auth.uid()) OR (app.get_my_role() = 'admin'::app.app_role)));

create policy corpus_read on public.publication_sources as permissive for select to authenticated
using (true);

create policy corpus_write on public.publication_sources as permissive for all to service_role
using (true)
with check (true);

create policy reminders_owner_delete on public.reminders as permissive for delete to authenticated
using ((user_id = auth.uid()));

create policy reminders_owner_insert on public.reminders as permissive for insert to authenticated
with check ((user_id = auth.uid()));

create policy reminders_owner_select on public.reminders as permissive for select to authenticated
using ((user_id = auth.uid()));

create policy reminders_owner_update on public.reminders as permissive for update to authenticated
using ((user_id = auth.uid()))
with check ((user_id = auth.uid()));

create policy reminders_service on public.reminders as permissive for all to service_role
using (true)
with check (true);

create policy corpus_read on public.search_chunks as permissive for select to authenticated
using (true);

create policy corpus_write on public.search_chunks as permissive for all to service_role
using (true)
with check (true);

create policy legal_unit_chunks_read on public.search_chunks_legal_unit as permissive for select to authenticated
using (true);

create policy legal_unit_chunks_service_write on public.search_chunks_legal_unit as permissive for all to service_role
using (true)
with check (true);

create policy legal_unit_embeddings_service_only on public.search_chunks_legal_unit_embeddings as permissive for all to service_role
using (true)
with check (true);

create policy team_members_admin_delete on public.team_members as permissive for delete to authenticated
using ((app.get_my_role() = 'admin'::app.app_role));

create policy team_members_admin_write on public.team_members as permissive for insert to authenticated
with check ((app.get_my_role() = 'admin'::app.app_role));

create policy team_members_read on public.team_members as permissive for select to authenticated
using (true);

create policy team_members_service on public.team_members as permissive for all to service_role
using (true)
with check (true);

create policy teams_admin_delete on public.teams as permissive for delete to authenticated
using ((app.get_my_role() = 'admin'::app.app_role));

create policy teams_admin_update on public.teams as permissive for update to authenticated
using ((app.get_my_role() = 'admin'::app.app_role))
with check ((app.get_my_role() = 'admin'::app.app_role));

create policy teams_admin_write on public.teams as permissive for insert to authenticated
with check ((app.get_my_role() = 'admin'::app.app_role));

create policy teams_read on public.teams as permissive for select to authenticated
using (true);

create policy teams_service on public.teams as permissive for all to service_role
using (true)
with check (true);

create policy telegram_uploads_read on public.telegram_uploads as permissive for select to authenticated
using (((user_id = auth.uid()) OR (app.get_my_role() = 'admin'::app.app_role)));

create policy telegram_uploads_service on public.telegram_uploads as permissive for all to service_role
using (true)
with check (true);

create policy telegram_verification_codes_insert on public.telegram_verification_codes as permissive for insert to authenticated
with check (((user_id = auth.uid()) OR (app.get_my_role() = 'admin'::app.app_role)));

create policy telegram_verification_codes_read on public.telegram_verification_codes as permissive for select to authenticated
using (((user_id = auth.uid()) OR (app.get_my_role() = 'admin'::app.app_role)));

create policy telegram_verification_codes_service on public.telegram_verification_codes as permissive for all to service_role
using (true)
with check (true);

create policy corpus_read on public.topics as permissive for select to authenticated
using (true);

create policy corpus_write on public.topics as permissive for all to service_role
using (true)
with check (true);

create policy user_feedback_delete on public.user_feedback as permissive for delete to authenticated
using (((user_id = auth.uid()) OR (app.get_my_role() = 'admin'::app.app_role)));

create policy user_feedback_insert on public.user_feedback as permissive for insert to authenticated
with check (((user_id = auth.uid()) AND app.can_read_case(case_id)));

create policy user_feedback_select on public.user_feedback as permissive for select to authenticated
using (((user_id = auth.uid()) OR (app.get_my_role() = 'admin'::app.app_role)));

create policy user_feedback_service on public.user_feedback as permissive for all to service_role
using (true)
with check (true);

create policy user_notes_owner on public.user_notes as permissive for all to authenticated
using ((user_id = auth.uid()))
with check ((user_id = auth.uid()));

create policy user_notes_service on public.user_notes as permissive for all to service_role
using (true)
with check (true);

create policy corpus_read on public.version_authorities as permissive for select to authenticated
using (true);

create policy corpus_write on public.version_authorities as permissive for all to service_role
using (true)
with check (true);

create policy "Case members can upload to case-files bucket" on storage.objects as permissive for insert to authenticated
with check (((bucket_id = 'case-files'::text) AND app.check_case_upload_access(case_files_object_case_id(name))));

create policy "Users can delete their user folder files" on storage.objects as permissive for delete to authenticated
using (((bucket_id = 'case-files'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text) AND ((storage.foldername(name))[2] = ANY (ARRAY['autofill'::text, 'complaints'::text, 'standalone'::text]))));

create policy "Users can upload to their user folder" on storage.objects as permissive for insert to authenticated
with check (((bucket_id = 'case-files'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text) AND ((storage.foldername(name))[2] = ANY (ARRAY['autofill'::text, 'complaints'::text, 'standalone'::text]))));

create policy "Users can view their user folder files" on storage.objects as permissive for select to authenticated
using (((bucket_id = 'case-files'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text) AND ((storage.foldername(name))[2] = ANY (ARRAY['autofill'::text, 'complaints'::text, 'standalone'::text]))));

create policy case_files_delete on storage.objects as permissive for delete to authenticated
using (((bucket_id = 'case-files'::text) AND ((owner = auth.uid()) OR app.can_manage_case(case_files_object_case_id(name)))));

create policy case_files_insert on storage.objects as permissive for insert to authenticated
with check (((bucket_id = 'case-files'::text) AND app.can_read_case(case_files_object_case_id(name))));

create policy case_files_read on storage.objects as permissive for select to authenticated
using (((bucket_id = 'case-files'::text) AND app.can_read_case(case_files_object_case_id(name))));

create policy media_uploads_insert on storage.objects as permissive for insert to authenticated
with check ((bucket_id = 'media-uploads'::text));

create policy media_uploads_select on storage.objects as permissive for select to authenticated
using ((bucket_id = 'media-uploads'::text));

-- Storage bucket definitions [APPLICATION_CONTRACT_REQUIRED]
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values
  (
    'case-files',
    'case-files',
    false,
    52428800,
    array[
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
    ]::text[]
  ),
  ('media-uploads','media-uploads',false,null,null);

-- Explicit privilege baseline [SECURITY_BASELINE_REQUIRED]
revoke all on schema app, internal from public, anon, authenticated;
revoke all on table app.ai_analysis_runs from public, anon, authenticated, service_role;
revoke all on table app.case_members from public, anon, authenticated, service_role;
revoke all on table app.case_messages from public, anon, authenticated, service_role;
revoke all on table app.cases from public, anon, authenticated, service_role;
revoke all on table app.client_documents from public, anon, authenticated, service_role;
revoke all on table app.generated_documents from public, anon, authenticated, service_role;
revoke all on table app.legal_decisions from public, anon, authenticated, service_role;
revoke all on table app.multi_agent_analysis_runs from public, anon, authenticated, service_role;
revoke all on table app.user_profiles from public, anon, authenticated, service_role;
revoke all on table internal.ai_metrics from public, anon, authenticated, service_role;
revoke all on table internal.extraction_runs from public, anon, authenticated, service_role;
revoke all on table internal.ingestion_jobs from public, anon, authenticated, service_role;
revoke all on table internal.source_files from public, anon, authenticated, service_role;
revoke all on table public.agent_analysis_runs from public, anon, authenticated, service_role;
revoke all on table public.agent_findings from public, anon, authenticated, service_role;
revoke all on table public.aggregated_reports from public, anon, authenticated, service_role;
revoke all on table public.ai_prompt_versions from public, anon, authenticated, service_role;
revoke all on table public.ai_prompts from public, anon, authenticated, service_role;
revoke all on table public.app_settings from public, anon, authenticated, service_role;
revoke all on table public.audio_transcriptions from public, anon, authenticated, service_role;
revoke all on table public.audit_logs from public, anon, authenticated, service_role;
revoke all on table public.authorities from public, anon, authenticated, service_role;
revoke all on table public.case_comments from public, anon, authenticated, service_role;
revoke all on table public.case_parties from public, anon, authenticated, service_role;
revoke all on table public.case_volumes from public, anon, authenticated, service_role;
revoke all on table public.chat_messages from public, anon, authenticated, service_role;
revoke all on table public.chats from public, anon, authenticated, service_role;
revoke all on table public.court_cases from public, anon, authenticated, service_role;
revoke all on table public.document_pages from public, anon, authenticated, service_role;
revoke all on table public.document_references from public, anon, authenticated, service_role;
revoke all on table public.document_table_cells from public, anon, authenticated, service_role;
revoke all on table public.document_tables from public, anon, authenticated, service_role;
revoke all on table public.document_templates from public, anon, authenticated, service_role;
revoke all on table public.document_topics from public, anon, authenticated, service_role;
revoke all on table public.document_types from public, anon, authenticated, service_role;
revoke all on table public.document_versions from public, anon, authenticated, service_role;
revoke all on table public.documents from public, anon, authenticated, service_role;
revoke all on table public.embeddings from public, anon, authenticated, service_role;
revoke all on table public.error_logs from public, anon, authenticated, service_role;
revoke all on table public.evidence_registry from public, anon, authenticated, service_role;
revoke all on table public.fragment_translations from public, anon, authenticated, service_role;
revoke all on table public.judges from public, anon, authenticated, service_role;
revoke all on table public.jurisdictions from public, anon, authenticated, service_role;
revoke all on table public.kb_versions from public, anon, authenticated, service_role;
revoke all on table public.knowledge_base from public, anon, authenticated, service_role;
revoke all on table public.knowledge_document_profiles from public, anon, authenticated, service_role;
revoke all on table public.legal_documents from public, anon, authenticated, service_role;
revoke all on table public.legal_edges from public, anon, authenticated, service_role;
revoke all on table public.legal_units from public, anon, authenticated, service_role;
revoke all on table public.notifications from public, anon, authenticated, service_role;
revoke all on table public.ocr_results from public, anon, authenticated, service_role;
revoke all on table public.parties from public, anon, authenticated, service_role;
revoke all on table public.practice_document_profiles from public, anon, authenticated, service_role;
revoke all on table public.practice_to_knowledge_references from public, anon, authenticated, service_role;
revoke all on table public.profile_compat_settings from public, anon, authenticated, service_role;
revoke all on table public.publication_sources from public, anon, authenticated, service_role;
revoke all on table public.reminders from public, anon, authenticated, service_role;
revoke all on table public.search_chunks from public, anon, authenticated, service_role;
revoke all on table public.search_chunks_legal_unit from public, anon, authenticated, service_role;
revoke all on table public.search_chunks_legal_unit_embeddings from public, anon, authenticated, service_role;
revoke all on table public.team_members from public, anon, authenticated, service_role;
revoke all on table public.teams from public, anon, authenticated, service_role;
revoke all on table public.telegram_uploads from public, anon, authenticated, service_role;
revoke all on table public.telegram_verification_codes from public, anon, authenticated, service_role;
revoke all on table public.topics from public, anon, authenticated, service_role;
revoke all on table public.user_feedback from public, anon, authenticated, service_role;
revoke all on table public.user_notes from public, anon, authenticated, service_role;
revoke all on table public.version_authorities from public, anon, authenticated, service_role;
revoke all on function app.can_manage_case(p_case_id uuid) from public, anon, authenticated, service_role;
revoke all on function app.can_read_case(p_case_id uuid) from public, anon, authenticated, service_role;
revoke all on function app.check_case_upload_access(_case_id uuid) from public, anon, authenticated, service_role;
revoke all on function app.get_my_role() from public, anon, authenticated, service_role;
revoke all on function app.is_case_lawyer(p_case_id uuid) from public, anon, authenticated, service_role;
revoke all on function app.is_case_member(p_case_id uuid) from public, anon, authenticated, service_role;
revoke all on function app.prevent_legal_decision_data_update() from public, anon, authenticated, service_role;
revoke all on function app.save_legal_decision_atomic(p_case_id uuid, p_version_hash text, p_decision_status text, p_decision_data jsonb, p_source_pipeline_version text DEFAULT NULL::text, p_created_by uuid DEFAULT NULL::uuid) from public, anon, authenticated, service_role;
revoke all on function public.admin_set_user_role(p_user_id uuid, p_role app.app_role) from public, anon, authenticated, service_role;
revoke all on function public.ai_analysis_view_insert() from public, anon, authenticated, service_role;
revoke all on function public.case_files_compat_delete() from public, anon, authenticated, service_role;
revoke all on function public.case_files_compat_insert() from public, anon, authenticated, service_role;
revoke all on function public.case_files_object_case_id(object_name text) from public, anon, authenticated, service_role;
revoke all on function public.case_members_compat_delete() from public, anon, authenticated, service_role;
revoke all on function public.case_members_compat_insert() from public, anon, authenticated, service_role;
revoke all on function public.cases_compat_delete() from public, anon, authenticated, service_role;
revoke all on function public.cases_compat_insert() from public, anon, authenticated, service_role;
revoke all on function public.cases_compat_update() from public, anon, authenticated, service_role;
revoke all on function public.generated_documents_compat_delete() from public, anon, authenticated, service_role;
revoke all on function public.generated_documents_compat_insert() from public, anon, authenticated, service_role;
revoke all on function public.generated_documents_compat_update() from public, anon, authenticated, service_role;
revoke all on function public.generated_documents_view_insert() from public, anon, authenticated, service_role;
revoke all on function public.get_ai_metrics_summary(p_days integer DEFAULT 30) from public, anon, authenticated, service_role;
revoke all on function public.get_embedding_metrics(p_model text DEFAULT 'armenian-text-embeddings-2-large'::text) from public, anon, authenticated, service_role;
revoke all on function public.get_my_role() from public, anon, authenticated, service_role;
revoke all on function public.handle_new_user() from public, anon, authenticated, service_role;
revoke all on function public.lookup_by_article(p_document_ref text DEFAULT NULL::text, p_article_number text DEFAULT NULL::text, p_limit integer DEFAULT 10) from public, anon, authenticated, service_role;
revoke all on function public.lookup_by_citation(p_citation text DEFAULT NULL::text, p_limit integer DEFAULT 10) from public, anon, authenticated, service_role;
revoke all on function public.lookup_table_rows(p_document_ref text DEFAULT NULL::text, p_table_ref text DEFAULT NULL::text, p_limit integer DEFAULT 50) from public, anon, authenticated, service_role;
revoke all on function public.profiles_compat_update() from public, anon, authenticated, service_role;
revoke all on function public.profiles_view_delete() from public, anon, authenticated, service_role;
revoke all on function public.profiles_view_insert() from public, anon, authenticated, service_role;
revoke all on function public.profiles_view_update() from public, anon, authenticated, service_role;
revoke all on function public.record_ai_analysis_run(p_case_id uuid, p_result jsonb, p_query text, p_model text) from public, anon, authenticated, service_role;
revoke all on function public.record_ai_metric(p_fn_name text, p_model text DEFAULT NULL::text, p_input_tokens integer DEFAULT 0, p_output_tokens integer DEFAULT 0, p_cost_usd numeric DEFAULT 0, p_latency_ms integer DEFAULT NULL::integer, p_status text DEFAULT 'success'::text, p_error_message text DEFAULT NULL::text, p_case_id uuid DEFAULT NULL::uuid, p_user_id uuid DEFAULT NULL::uuid) from public, anon, authenticated, service_role;
revoke all on function public.search_legal_corpus(p_query_text text, p_query_embedding vector, p_content_domain content_domain DEFAULT NULL::content_domain, p_norm_status normalized_status DEFAULT 'active'::normalized_status, p_effective_at date DEFAULT NULL::date, p_language_code text DEFAULT NULL::text, p_limit integer DEFAULT 10, p_offset integer DEFAULT 0) from public, anon, authenticated, service_role;
revoke all on function public.search_legal_corpus_dual(p_query_text text, p_metric_embedding vector DEFAULT NULL::vector, p_qwen_embedding vector DEFAULT NULL::vector, p_content_domain content_domain DEFAULT NULL::content_domain, p_norm_status normalized_status DEFAULT NULL::normalized_status, p_limit integer DEFAULT 10, p_metric_limit integer DEFAULT 30, p_qwen_limit integer DEFAULT 30, p_bm25_limit integer DEFAULT 30, p_effective_at date DEFAULT NULL::date) from public, anon, authenticated, service_role;
revoke all on function public.search_legal_unit_chunks_preview(p_query_text text, p_limit integer DEFAULT 10, p_content_domain content_domain DEFAULT NULL::content_domain, p_language text DEFAULT NULL::text, p_effective_at date DEFAULT NULL::date) from public, anon, authenticated, service_role;
revoke all on function public.set_updated_at() from public, anon, authenticated, service_role;
revoke all on function public.user_roles_guard() from public, anon, authenticated, service_role;
revoke all on function public.user_roles_view_delete() from public, anon, authenticated, service_role;
revoke all on function public.user_roles_view_insert() from public, anon, authenticated, service_role;
revoke all on function public.user_roles_view_update() from public, anon, authenticated, service_role;
grant USAGE on schema app to authenticated;

grant USAGE on schema app to service_role;

grant USAGE on schema internal to service_role;

grant USAGE on schema public to public;

grant USAGE on schema public to anon;

grant USAGE on schema public to authenticated;

grant USAGE on schema public to service_role;
grant DELETE on table app.ai_analysis_runs to authenticated;

grant INSERT on table app.ai_analysis_runs to authenticated;

grant SELECT on table app.ai_analysis_runs to authenticated;

grant UPDATE on table app.ai_analysis_runs to authenticated;

grant DELETE on table app.ai_analysis_runs to service_role;

grant INSERT on table app.ai_analysis_runs to service_role;

grant MAINTAIN on table app.ai_analysis_runs to service_role;

grant REFERENCES on table app.ai_analysis_runs to service_role;

grant SELECT on table app.ai_analysis_runs to service_role;

grant TRIGGER on table app.ai_analysis_runs to service_role;

grant TRUNCATE on table app.ai_analysis_runs to service_role;

grant UPDATE on table app.ai_analysis_runs to service_role;

grant DELETE on table app.case_members to authenticated;

grant INSERT on table app.case_members to authenticated;

grant SELECT on table app.case_members to authenticated;

grant UPDATE on table app.case_members to authenticated;

grant DELETE on table app.case_members to service_role;

grant INSERT on table app.case_members to service_role;

grant MAINTAIN on table app.case_members to service_role;

grant REFERENCES on table app.case_members to service_role;

grant SELECT on table app.case_members to service_role;

grant TRIGGER on table app.case_members to service_role;

grant TRUNCATE on table app.case_members to service_role;

grant UPDATE on table app.case_members to service_role;

grant DELETE on table app.case_messages to authenticated;

grant INSERT on table app.case_messages to authenticated;

grant SELECT on table app.case_messages to authenticated;

grant UPDATE on table app.case_messages to authenticated;

grant DELETE on table app.case_messages to service_role;

grant INSERT on table app.case_messages to service_role;

grant MAINTAIN on table app.case_messages to service_role;

grant REFERENCES on table app.case_messages to service_role;

grant SELECT on table app.case_messages to service_role;

grant TRIGGER on table app.case_messages to service_role;

grant TRUNCATE on table app.case_messages to service_role;

grant UPDATE on table app.case_messages to service_role;

grant DELETE on table app.cases to authenticated;

grant INSERT on table app.cases to authenticated;

grant SELECT on table app.cases to authenticated;

grant UPDATE on table app.cases to authenticated;

grant DELETE on table app.cases to service_role;

grant INSERT on table app.cases to service_role;

grant MAINTAIN on table app.cases to service_role;

grant REFERENCES on table app.cases to service_role;

grant SELECT on table app.cases to service_role;

grant TRIGGER on table app.cases to service_role;

grant TRUNCATE on table app.cases to service_role;

grant UPDATE on table app.cases to service_role;

grant DELETE on table app.client_documents to authenticated;

grant INSERT on table app.client_documents to authenticated;

grant SELECT on table app.client_documents to authenticated;

grant UPDATE on table app.client_documents to authenticated;

grant DELETE on table app.client_documents to service_role;

grant INSERT on table app.client_documents to service_role;

grant MAINTAIN on table app.client_documents to service_role;

grant REFERENCES on table app.client_documents to service_role;

grant SELECT on table app.client_documents to service_role;

grant TRIGGER on table app.client_documents to service_role;

grant TRUNCATE on table app.client_documents to service_role;

grant UPDATE on table app.client_documents to service_role;

grant DELETE on table app.generated_documents to authenticated;

grant INSERT on table app.generated_documents to authenticated;

grant SELECT on table app.generated_documents to authenticated;

grant UPDATE on table app.generated_documents to authenticated;

grant DELETE on table app.generated_documents to service_role;

grant INSERT on table app.generated_documents to service_role;

grant MAINTAIN on table app.generated_documents to service_role;

grant REFERENCES on table app.generated_documents to service_role;

grant SELECT on table app.generated_documents to service_role;

grant TRIGGER on table app.generated_documents to service_role;

grant TRUNCATE on table app.generated_documents to service_role;

grant UPDATE on table app.generated_documents to service_role;

grant SELECT on table app.legal_decisions to authenticated;

grant INSERT on table app.legal_decisions to service_role;

grant SELECT on table app.legal_decisions to service_role;

grant SELECT on table app.multi_agent_analysis_runs to authenticated;

grant DELETE on table app.multi_agent_analysis_runs to service_role;

grant INSERT on table app.multi_agent_analysis_runs to service_role;

grant MAINTAIN on table app.multi_agent_analysis_runs to service_role;

grant REFERENCES on table app.multi_agent_analysis_runs to service_role;

grant SELECT on table app.multi_agent_analysis_runs to service_role;

grant TRIGGER on table app.multi_agent_analysis_runs to service_role;

grant TRUNCATE on table app.multi_agent_analysis_runs to service_role;

grant UPDATE on table app.multi_agent_analysis_runs to service_role;

grant DELETE on table app.user_profiles to authenticated;

grant INSERT on table app.user_profiles to authenticated;

grant SELECT on table app.user_profiles to authenticated;

grant UPDATE on table app.user_profiles to authenticated;

grant DELETE on table app.user_profiles to service_role;

grant INSERT on table app.user_profiles to service_role;

grant MAINTAIN on table app.user_profiles to service_role;

grant REFERENCES on table app.user_profiles to service_role;

grant SELECT on table app.user_profiles to service_role;

grant TRIGGER on table app.user_profiles to service_role;

grant TRUNCATE on table app.user_profiles to service_role;

grant UPDATE on table app.user_profiles to service_role;

grant DELETE on table internal.extraction_runs to service_role;

grant INSERT on table internal.extraction_runs to service_role;

grant MAINTAIN on table internal.extraction_runs to service_role;

grant REFERENCES on table internal.extraction_runs to service_role;

grant SELECT on table internal.extraction_runs to service_role;

grant TRIGGER on table internal.extraction_runs to service_role;

grant TRUNCATE on table internal.extraction_runs to service_role;

grant UPDATE on table internal.extraction_runs to service_role;

grant DELETE on table internal.ingestion_jobs to service_role;

grant INSERT on table internal.ingestion_jobs to service_role;

grant MAINTAIN on table internal.ingestion_jobs to service_role;

grant REFERENCES on table internal.ingestion_jobs to service_role;

grant SELECT on table internal.ingestion_jobs to service_role;

grant TRIGGER on table internal.ingestion_jobs to service_role;

grant TRUNCATE on table internal.ingestion_jobs to service_role;

grant UPDATE on table internal.ingestion_jobs to service_role;

grant DELETE on table internal.source_files to service_role;

grant INSERT on table internal.source_files to service_role;

grant MAINTAIN on table internal.source_files to service_role;

grant REFERENCES on table internal.source_files to service_role;

grant SELECT on table internal.source_files to service_role;

grant TRIGGER on table internal.source_files to service_role;

grant TRUNCATE on table internal.source_files to service_role;

grant UPDATE on table internal.source_files to service_role;

grant DELETE on table public.agent_analysis_runs to anon;

grant INSERT on table public.agent_analysis_runs to anon;

grant MAINTAIN on table public.agent_analysis_runs to anon;

grant REFERENCES on table public.agent_analysis_runs to anon;

grant SELECT on table public.agent_analysis_runs to anon;

grant TRIGGER on table public.agent_analysis_runs to anon;

grant TRUNCATE on table public.agent_analysis_runs to anon;

grant UPDATE on table public.agent_analysis_runs to anon;

grant DELETE on table public.agent_analysis_runs to authenticated;

grant INSERT on table public.agent_analysis_runs to authenticated;

grant MAINTAIN on table public.agent_analysis_runs to authenticated;

grant REFERENCES on table public.agent_analysis_runs to authenticated;

grant SELECT on table public.agent_analysis_runs to authenticated;

grant TRIGGER on table public.agent_analysis_runs to authenticated;

grant TRUNCATE on table public.agent_analysis_runs to authenticated;

grant UPDATE on table public.agent_analysis_runs to authenticated;

grant DELETE on table public.agent_analysis_runs to service_role;

grant INSERT on table public.agent_analysis_runs to service_role;

grant MAINTAIN on table public.agent_analysis_runs to service_role;

grant REFERENCES on table public.agent_analysis_runs to service_role;

grant SELECT on table public.agent_analysis_runs to service_role;

grant TRIGGER on table public.agent_analysis_runs to service_role;

grant TRUNCATE on table public.agent_analysis_runs to service_role;

grant UPDATE on table public.agent_analysis_runs to service_role;

grant DELETE on table public.agent_findings to anon;

grant INSERT on table public.agent_findings to anon;

grant MAINTAIN on table public.agent_findings to anon;

grant REFERENCES on table public.agent_findings to anon;

grant SELECT on table public.agent_findings to anon;

grant TRIGGER on table public.agent_findings to anon;

grant TRUNCATE on table public.agent_findings to anon;

grant UPDATE on table public.agent_findings to anon;

grant DELETE on table public.agent_findings to authenticated;

grant INSERT on table public.agent_findings to authenticated;

grant MAINTAIN on table public.agent_findings to authenticated;

grant REFERENCES on table public.agent_findings to authenticated;

grant SELECT on table public.agent_findings to authenticated;

grant TRIGGER on table public.agent_findings to authenticated;

grant TRUNCATE on table public.agent_findings to authenticated;

grant UPDATE on table public.agent_findings to authenticated;

grant DELETE on table public.agent_findings to service_role;

grant INSERT on table public.agent_findings to service_role;

grant MAINTAIN on table public.agent_findings to service_role;

grant REFERENCES on table public.agent_findings to service_role;

grant SELECT on table public.agent_findings to service_role;

grant TRIGGER on table public.agent_findings to service_role;

grant TRUNCATE on table public.agent_findings to service_role;

grant UPDATE on table public.agent_findings to service_role;

grant DELETE on table public.aggregated_reports to anon;

grant INSERT on table public.aggregated_reports to anon;

grant MAINTAIN on table public.aggregated_reports to anon;

grant REFERENCES on table public.aggregated_reports to anon;

grant SELECT on table public.aggregated_reports to anon;

grant TRIGGER on table public.aggregated_reports to anon;

grant TRUNCATE on table public.aggregated_reports to anon;

grant UPDATE on table public.aggregated_reports to anon;

grant DELETE on table public.aggregated_reports to authenticated;

grant INSERT on table public.aggregated_reports to authenticated;

grant MAINTAIN on table public.aggregated_reports to authenticated;

grant REFERENCES on table public.aggregated_reports to authenticated;

grant SELECT on table public.aggregated_reports to authenticated;

grant TRIGGER on table public.aggregated_reports to authenticated;

grant TRUNCATE on table public.aggregated_reports to authenticated;

grant UPDATE on table public.aggregated_reports to authenticated;

grant DELETE on table public.aggregated_reports to service_role;

grant INSERT on table public.aggregated_reports to service_role;

grant MAINTAIN on table public.aggregated_reports to service_role;

grant REFERENCES on table public.aggregated_reports to service_role;

grant SELECT on table public.aggregated_reports to service_role;

grant TRIGGER on table public.aggregated_reports to service_role;

grant TRUNCATE on table public.aggregated_reports to service_role;

grant UPDATE on table public.aggregated_reports to service_role;

grant DELETE on table public.ai_analysis to anon;

grant INSERT on table public.ai_analysis to anon;

grant MAINTAIN on table public.ai_analysis to anon;

grant REFERENCES on table public.ai_analysis to anon;

grant SELECT on table public.ai_analysis to anon;

grant TRIGGER on table public.ai_analysis to anon;

grant TRUNCATE on table public.ai_analysis to anon;

grant UPDATE on table public.ai_analysis to anon;

grant DELETE on table public.ai_analysis to authenticated;

grant INSERT on table public.ai_analysis to authenticated;

grant MAINTAIN on table public.ai_analysis to authenticated;

grant REFERENCES on table public.ai_analysis to authenticated;

grant SELECT on table public.ai_analysis to authenticated;

grant TRIGGER on table public.ai_analysis to authenticated;

grant TRUNCATE on table public.ai_analysis to authenticated;

grant UPDATE on table public.ai_analysis to authenticated;

grant DELETE on table public.ai_analysis to service_role;

grant INSERT on table public.ai_analysis to service_role;

grant MAINTAIN on table public.ai_analysis to service_role;

grant REFERENCES on table public.ai_analysis to service_role;

grant SELECT on table public.ai_analysis to service_role;

grant TRIGGER on table public.ai_analysis to service_role;

grant TRUNCATE on table public.ai_analysis to service_role;

grant UPDATE on table public.ai_analysis to service_role;

grant DELETE on table public.ai_prompt_versions to anon;

grant INSERT on table public.ai_prompt_versions to anon;

grant MAINTAIN on table public.ai_prompt_versions to anon;

grant REFERENCES on table public.ai_prompt_versions to anon;

grant SELECT on table public.ai_prompt_versions to anon;

grant TRIGGER on table public.ai_prompt_versions to anon;

grant TRUNCATE on table public.ai_prompt_versions to anon;

grant UPDATE on table public.ai_prompt_versions to anon;

grant DELETE on table public.ai_prompt_versions to authenticated;

grant INSERT on table public.ai_prompt_versions to authenticated;

grant MAINTAIN on table public.ai_prompt_versions to authenticated;

grant REFERENCES on table public.ai_prompt_versions to authenticated;

grant SELECT on table public.ai_prompt_versions to authenticated;

grant TRIGGER on table public.ai_prompt_versions to authenticated;

grant TRUNCATE on table public.ai_prompt_versions to authenticated;

grant UPDATE on table public.ai_prompt_versions to authenticated;

grant DELETE on table public.ai_prompt_versions to service_role;

grant INSERT on table public.ai_prompt_versions to service_role;

grant MAINTAIN on table public.ai_prompt_versions to service_role;

grant REFERENCES on table public.ai_prompt_versions to service_role;

grant SELECT on table public.ai_prompt_versions to service_role;

grant TRIGGER on table public.ai_prompt_versions to service_role;

grant TRUNCATE on table public.ai_prompt_versions to service_role;

grant UPDATE on table public.ai_prompt_versions to service_role;

grant DELETE on table public.ai_prompts to anon;

grant INSERT on table public.ai_prompts to anon;

grant MAINTAIN on table public.ai_prompts to anon;

grant REFERENCES on table public.ai_prompts to anon;

grant SELECT on table public.ai_prompts to anon;

grant TRIGGER on table public.ai_prompts to anon;

grant TRUNCATE on table public.ai_prompts to anon;

grant UPDATE on table public.ai_prompts to anon;

grant DELETE on table public.ai_prompts to authenticated;

grant INSERT on table public.ai_prompts to authenticated;

grant MAINTAIN on table public.ai_prompts to authenticated;

grant REFERENCES on table public.ai_prompts to authenticated;

grant SELECT on table public.ai_prompts to authenticated;

grant TRIGGER on table public.ai_prompts to authenticated;

grant TRUNCATE on table public.ai_prompts to authenticated;

grant UPDATE on table public.ai_prompts to authenticated;

grant DELETE on table public.ai_prompts to service_role;

grant INSERT on table public.ai_prompts to service_role;

grant MAINTAIN on table public.ai_prompts to service_role;

grant REFERENCES on table public.ai_prompts to service_role;

grant SELECT on table public.ai_prompts to service_role;

grant TRIGGER on table public.ai_prompts to service_role;

grant TRUNCATE on table public.ai_prompts to service_role;

grant UPDATE on table public.ai_prompts to service_role;

grant DELETE on table public.app_settings to anon;

grant INSERT on table public.app_settings to anon;

grant MAINTAIN on table public.app_settings to anon;

grant REFERENCES on table public.app_settings to anon;

grant SELECT on table public.app_settings to anon;

grant TRIGGER on table public.app_settings to anon;

grant TRUNCATE on table public.app_settings to anon;

grant UPDATE on table public.app_settings to anon;

grant DELETE on table public.app_settings to authenticated;

grant INSERT on table public.app_settings to authenticated;

grant MAINTAIN on table public.app_settings to authenticated;

grant REFERENCES on table public.app_settings to authenticated;

grant SELECT on table public.app_settings to authenticated;

grant TRIGGER on table public.app_settings to authenticated;

grant TRUNCATE on table public.app_settings to authenticated;

grant UPDATE on table public.app_settings to authenticated;

grant DELETE on table public.app_settings to service_role;

grant INSERT on table public.app_settings to service_role;

grant MAINTAIN on table public.app_settings to service_role;

grant REFERENCES on table public.app_settings to service_role;

grant SELECT on table public.app_settings to service_role;

grant TRIGGER on table public.app_settings to service_role;

grant TRUNCATE on table public.app_settings to service_role;

grant UPDATE on table public.app_settings to service_role;

grant DELETE on table public.audio_transcriptions to anon;

grant INSERT on table public.audio_transcriptions to anon;

grant MAINTAIN on table public.audio_transcriptions to anon;

grant REFERENCES on table public.audio_transcriptions to anon;

grant SELECT on table public.audio_transcriptions to anon;

grant TRIGGER on table public.audio_transcriptions to anon;

grant TRUNCATE on table public.audio_transcriptions to anon;

grant UPDATE on table public.audio_transcriptions to anon;

grant DELETE on table public.audio_transcriptions to authenticated;

grant INSERT on table public.audio_transcriptions to authenticated;

grant MAINTAIN on table public.audio_transcriptions to authenticated;

grant REFERENCES on table public.audio_transcriptions to authenticated;

grant SELECT on table public.audio_transcriptions to authenticated;

grant TRIGGER on table public.audio_transcriptions to authenticated;

grant TRUNCATE on table public.audio_transcriptions to authenticated;

grant UPDATE on table public.audio_transcriptions to authenticated;

grant DELETE on table public.audio_transcriptions to service_role;

grant INSERT on table public.audio_transcriptions to service_role;

grant MAINTAIN on table public.audio_transcriptions to service_role;

grant REFERENCES on table public.audio_transcriptions to service_role;

grant SELECT on table public.audio_transcriptions to service_role;

grant TRIGGER on table public.audio_transcriptions to service_role;

grant TRUNCATE on table public.audio_transcriptions to service_role;

grant UPDATE on table public.audio_transcriptions to service_role;

grant DELETE on table public.audit_logs to anon;

grant INSERT on table public.audit_logs to anon;

grant MAINTAIN on table public.audit_logs to anon;

grant REFERENCES on table public.audit_logs to anon;

grant SELECT on table public.audit_logs to anon;

grant TRIGGER on table public.audit_logs to anon;

grant TRUNCATE on table public.audit_logs to anon;

grant UPDATE on table public.audit_logs to anon;

grant DELETE on table public.audit_logs to authenticated;

grant INSERT on table public.audit_logs to authenticated;

grant MAINTAIN on table public.audit_logs to authenticated;

grant REFERENCES on table public.audit_logs to authenticated;

grant SELECT on table public.audit_logs to authenticated;

grant TRIGGER on table public.audit_logs to authenticated;

grant TRUNCATE on table public.audit_logs to authenticated;

grant UPDATE on table public.audit_logs to authenticated;

grant DELETE on table public.audit_logs to service_role;

grant INSERT on table public.audit_logs to service_role;

grant MAINTAIN on table public.audit_logs to service_role;

grant REFERENCES on table public.audit_logs to service_role;

grant SELECT on table public.audit_logs to service_role;

grant TRIGGER on table public.audit_logs to service_role;

grant TRUNCATE on table public.audit_logs to service_role;

grant UPDATE on table public.audit_logs to service_role;

grant DELETE on table public.authorities to anon;

grant INSERT on table public.authorities to anon;

grant MAINTAIN on table public.authorities to anon;

grant REFERENCES on table public.authorities to anon;

grant SELECT on table public.authorities to anon;

grant TRIGGER on table public.authorities to anon;

grant TRUNCATE on table public.authorities to anon;

grant UPDATE on table public.authorities to anon;

grant DELETE on table public.authorities to authenticated;

grant INSERT on table public.authorities to authenticated;

grant MAINTAIN on table public.authorities to authenticated;

grant REFERENCES on table public.authorities to authenticated;

grant SELECT on table public.authorities to authenticated;

grant TRIGGER on table public.authorities to authenticated;

grant TRUNCATE on table public.authorities to authenticated;

grant UPDATE on table public.authorities to authenticated;

grant DELETE on table public.authorities to service_role;

grant INSERT on table public.authorities to service_role;

grant MAINTAIN on table public.authorities to service_role;

grant REFERENCES on table public.authorities to service_role;

grant SELECT on table public.authorities to service_role;

grant TRIGGER on table public.authorities to service_role;

grant TRUNCATE on table public.authorities to service_role;

grant UPDATE on table public.authorities to service_role;

grant DELETE on table public.case_comments to anon;

grant INSERT on table public.case_comments to anon;

grant MAINTAIN on table public.case_comments to anon;

grant REFERENCES on table public.case_comments to anon;

grant SELECT on table public.case_comments to anon;

grant TRIGGER on table public.case_comments to anon;

grant TRUNCATE on table public.case_comments to anon;

grant UPDATE on table public.case_comments to anon;

grant DELETE on table public.case_comments to authenticated;

grant INSERT on table public.case_comments to authenticated;

grant MAINTAIN on table public.case_comments to authenticated;

grant REFERENCES on table public.case_comments to authenticated;

grant SELECT on table public.case_comments to authenticated;

grant TRIGGER on table public.case_comments to authenticated;

grant TRUNCATE on table public.case_comments to authenticated;

grant UPDATE on table public.case_comments to authenticated;

grant DELETE on table public.case_comments to service_role;

grant INSERT on table public.case_comments to service_role;

grant MAINTAIN on table public.case_comments to service_role;

grant REFERENCES on table public.case_comments to service_role;

grant SELECT on table public.case_comments to service_role;

grant TRIGGER on table public.case_comments to service_role;

grant TRUNCATE on table public.case_comments to service_role;

grant UPDATE on table public.case_comments to service_role;

grant DELETE on table public.case_files to anon;

grant INSERT on table public.case_files to anon;

grant MAINTAIN on table public.case_files to anon;

grant REFERENCES on table public.case_files to anon;

grant SELECT on table public.case_files to anon;

grant TRIGGER on table public.case_files to anon;

grant TRUNCATE on table public.case_files to anon;

grant UPDATE on table public.case_files to anon;

grant DELETE on table public.case_files to authenticated;

grant INSERT on table public.case_files to authenticated;

grant MAINTAIN on table public.case_files to authenticated;

grant REFERENCES on table public.case_files to authenticated;

grant SELECT on table public.case_files to authenticated;

grant TRIGGER on table public.case_files to authenticated;

grant TRUNCATE on table public.case_files to authenticated;

grant UPDATE on table public.case_files to authenticated;

grant DELETE on table public.case_files to service_role;

grant INSERT on table public.case_files to service_role;

grant MAINTAIN on table public.case_files to service_role;

grant REFERENCES on table public.case_files to service_role;

grant SELECT on table public.case_files to service_role;

grant TRIGGER on table public.case_files to service_role;

grant TRUNCATE on table public.case_files to service_role;

grant UPDATE on table public.case_files to service_role;

grant DELETE on table public.case_members to anon;

grant INSERT on table public.case_members to anon;

grant MAINTAIN on table public.case_members to anon;

grant REFERENCES on table public.case_members to anon;

grant SELECT on table public.case_members to anon;

grant TRIGGER on table public.case_members to anon;

grant TRUNCATE on table public.case_members to anon;

grant UPDATE on table public.case_members to anon;

grant DELETE on table public.case_members to authenticated;

grant INSERT on table public.case_members to authenticated;

grant MAINTAIN on table public.case_members to authenticated;

grant REFERENCES on table public.case_members to authenticated;

grant SELECT on table public.case_members to authenticated;

grant TRIGGER on table public.case_members to authenticated;

grant TRUNCATE on table public.case_members to authenticated;

grant UPDATE on table public.case_members to authenticated;

grant DELETE on table public.case_members to service_role;

grant INSERT on table public.case_members to service_role;

grant MAINTAIN on table public.case_members to service_role;

grant REFERENCES on table public.case_members to service_role;

grant SELECT on table public.case_members to service_role;

grant TRIGGER on table public.case_members to service_role;

grant TRUNCATE on table public.case_members to service_role;

grant UPDATE on table public.case_members to service_role;

grant DELETE on table public.case_parties to anon;

grant INSERT on table public.case_parties to anon;

grant MAINTAIN on table public.case_parties to anon;

grant REFERENCES on table public.case_parties to anon;

grant SELECT on table public.case_parties to anon;

grant TRIGGER on table public.case_parties to anon;

grant TRUNCATE on table public.case_parties to anon;

grant UPDATE on table public.case_parties to anon;

grant DELETE on table public.case_parties to authenticated;

grant INSERT on table public.case_parties to authenticated;

grant MAINTAIN on table public.case_parties to authenticated;

grant REFERENCES on table public.case_parties to authenticated;

grant SELECT on table public.case_parties to authenticated;

grant TRIGGER on table public.case_parties to authenticated;

grant TRUNCATE on table public.case_parties to authenticated;

grant UPDATE on table public.case_parties to authenticated;

grant DELETE on table public.case_parties to service_role;

grant INSERT on table public.case_parties to service_role;

grant MAINTAIN on table public.case_parties to service_role;

grant REFERENCES on table public.case_parties to service_role;

grant SELECT on table public.case_parties to service_role;

grant TRIGGER on table public.case_parties to service_role;

grant TRUNCATE on table public.case_parties to service_role;

grant UPDATE on table public.case_parties to service_role;

grant DELETE on table public.case_volumes to anon;

grant INSERT on table public.case_volumes to anon;

grant MAINTAIN on table public.case_volumes to anon;

grant REFERENCES on table public.case_volumes to anon;

grant SELECT on table public.case_volumes to anon;

grant TRIGGER on table public.case_volumes to anon;

grant TRUNCATE on table public.case_volumes to anon;

grant UPDATE on table public.case_volumes to anon;

grant DELETE on table public.case_volumes to authenticated;

grant INSERT on table public.case_volumes to authenticated;

grant MAINTAIN on table public.case_volumes to authenticated;

grant REFERENCES on table public.case_volumes to authenticated;

grant SELECT on table public.case_volumes to authenticated;

grant TRIGGER on table public.case_volumes to authenticated;

grant TRUNCATE on table public.case_volumes to authenticated;

grant UPDATE on table public.case_volumes to authenticated;

grant DELETE on table public.case_volumes to service_role;

grant INSERT on table public.case_volumes to service_role;

grant MAINTAIN on table public.case_volumes to service_role;

grant REFERENCES on table public.case_volumes to service_role;

grant SELECT on table public.case_volumes to service_role;

grant TRIGGER on table public.case_volumes to service_role;

grant TRUNCATE on table public.case_volumes to service_role;

grant UPDATE on table public.case_volumes to service_role;

grant DELETE on table public.cases to anon;

grant INSERT on table public.cases to anon;

grant MAINTAIN on table public.cases to anon;

grant REFERENCES on table public.cases to anon;

grant SELECT on table public.cases to anon;

grant TRIGGER on table public.cases to anon;

grant TRUNCATE on table public.cases to anon;

grant UPDATE on table public.cases to anon;

grant DELETE on table public.cases to authenticated;

grant INSERT on table public.cases to authenticated;

grant MAINTAIN on table public.cases to authenticated;

grant REFERENCES on table public.cases to authenticated;

grant SELECT on table public.cases to authenticated;

grant TRIGGER on table public.cases to authenticated;

grant TRUNCATE on table public.cases to authenticated;

grant UPDATE on table public.cases to authenticated;

grant DELETE on table public.cases to service_role;

grant INSERT on table public.cases to service_role;

grant MAINTAIN on table public.cases to service_role;

grant REFERENCES on table public.cases to service_role;

grant SELECT on table public.cases to service_role;

grant TRIGGER on table public.cases to service_role;

grant TRUNCATE on table public.cases to service_role;

grant UPDATE on table public.cases to service_role;

grant DELETE on table public.chat_messages to anon;

grant INSERT on table public.chat_messages to anon;

grant MAINTAIN on table public.chat_messages to anon;

grant REFERENCES on table public.chat_messages to anon;

grant SELECT on table public.chat_messages to anon;

grant TRIGGER on table public.chat_messages to anon;

grant TRUNCATE on table public.chat_messages to anon;

grant UPDATE on table public.chat_messages to anon;

grant DELETE on table public.chat_messages to authenticated;

grant INSERT on table public.chat_messages to authenticated;

grant MAINTAIN on table public.chat_messages to authenticated;

grant REFERENCES on table public.chat_messages to authenticated;

grant SELECT on table public.chat_messages to authenticated;

grant TRIGGER on table public.chat_messages to authenticated;

grant TRUNCATE on table public.chat_messages to authenticated;

grant UPDATE on table public.chat_messages to authenticated;

grant DELETE on table public.chat_messages to service_role;

grant INSERT on table public.chat_messages to service_role;

grant MAINTAIN on table public.chat_messages to service_role;

grant REFERENCES on table public.chat_messages to service_role;

grant SELECT on table public.chat_messages to service_role;

grant TRIGGER on table public.chat_messages to service_role;

grant TRUNCATE on table public.chat_messages to service_role;

grant UPDATE on table public.chat_messages to service_role;

grant DELETE on table public.chats to anon;

grant INSERT on table public.chats to anon;

grant MAINTAIN on table public.chats to anon;

grant REFERENCES on table public.chats to anon;

grant SELECT on table public.chats to anon;

grant TRIGGER on table public.chats to anon;

grant TRUNCATE on table public.chats to anon;

grant UPDATE on table public.chats to anon;

grant DELETE on table public.chats to authenticated;

grant INSERT on table public.chats to authenticated;

grant MAINTAIN on table public.chats to authenticated;

grant REFERENCES on table public.chats to authenticated;

grant SELECT on table public.chats to authenticated;

grant TRIGGER on table public.chats to authenticated;

grant TRUNCATE on table public.chats to authenticated;

grant UPDATE on table public.chats to authenticated;

grant DELETE on table public.chats to service_role;

grant INSERT on table public.chats to service_role;

grant MAINTAIN on table public.chats to service_role;

grant REFERENCES on table public.chats to service_role;

grant SELECT on table public.chats to service_role;

grant TRIGGER on table public.chats to service_role;

grant TRUNCATE on table public.chats to service_role;

grant UPDATE on table public.chats to service_role;

grant DELETE on table public.court_cases to anon;

grant INSERT on table public.court_cases to anon;

grant MAINTAIN on table public.court_cases to anon;

grant REFERENCES on table public.court_cases to anon;

grant SELECT on table public.court_cases to anon;

grant TRIGGER on table public.court_cases to anon;

grant TRUNCATE on table public.court_cases to anon;

grant UPDATE on table public.court_cases to anon;

grant DELETE on table public.court_cases to authenticated;

grant INSERT on table public.court_cases to authenticated;

grant MAINTAIN on table public.court_cases to authenticated;

grant REFERENCES on table public.court_cases to authenticated;

grant SELECT on table public.court_cases to authenticated;

grant TRIGGER on table public.court_cases to authenticated;

grant TRUNCATE on table public.court_cases to authenticated;

grant UPDATE on table public.court_cases to authenticated;

grant DELETE on table public.court_cases to service_role;

grant INSERT on table public.court_cases to service_role;

grant MAINTAIN on table public.court_cases to service_role;

grant REFERENCES on table public.court_cases to service_role;

grant SELECT on table public.court_cases to service_role;

grant TRIGGER on table public.court_cases to service_role;

grant TRUNCATE on table public.court_cases to service_role;

grant UPDATE on table public.court_cases to service_role;

grant DELETE on table public.document_pages to anon;

grant INSERT on table public.document_pages to anon;

grant MAINTAIN on table public.document_pages to anon;

grant REFERENCES on table public.document_pages to anon;

grant SELECT on table public.document_pages to anon;

grant TRIGGER on table public.document_pages to anon;

grant TRUNCATE on table public.document_pages to anon;

grant UPDATE on table public.document_pages to anon;

grant DELETE on table public.document_pages to authenticated;

grant INSERT on table public.document_pages to authenticated;

grant MAINTAIN on table public.document_pages to authenticated;

grant REFERENCES on table public.document_pages to authenticated;

grant SELECT on table public.document_pages to authenticated;

grant TRIGGER on table public.document_pages to authenticated;

grant TRUNCATE on table public.document_pages to authenticated;

grant UPDATE on table public.document_pages to authenticated;

grant DELETE on table public.document_pages to service_role;

grant INSERT on table public.document_pages to service_role;

grant MAINTAIN on table public.document_pages to service_role;

grant REFERENCES on table public.document_pages to service_role;

grant SELECT on table public.document_pages to service_role;

grant TRIGGER on table public.document_pages to service_role;

grant TRUNCATE on table public.document_pages to service_role;

grant UPDATE on table public.document_pages to service_role;

grant DELETE on table public.document_references to anon;

grant INSERT on table public.document_references to anon;

grant MAINTAIN on table public.document_references to anon;

grant REFERENCES on table public.document_references to anon;

grant SELECT on table public.document_references to anon;

grant TRIGGER on table public.document_references to anon;

grant TRUNCATE on table public.document_references to anon;

grant UPDATE on table public.document_references to anon;

grant DELETE on table public.document_references to authenticated;

grant INSERT on table public.document_references to authenticated;

grant MAINTAIN on table public.document_references to authenticated;

grant REFERENCES on table public.document_references to authenticated;

grant SELECT on table public.document_references to authenticated;

grant TRIGGER on table public.document_references to authenticated;

grant TRUNCATE on table public.document_references to authenticated;

grant UPDATE on table public.document_references to authenticated;

grant DELETE on table public.document_references to service_role;

grant INSERT on table public.document_references to service_role;

grant MAINTAIN on table public.document_references to service_role;

grant REFERENCES on table public.document_references to service_role;

grant SELECT on table public.document_references to service_role;

grant TRIGGER on table public.document_references to service_role;

grant TRUNCATE on table public.document_references to service_role;

grant UPDATE on table public.document_references to service_role;

grant DELETE on table public.document_table_cells to anon;

grant INSERT on table public.document_table_cells to anon;

grant MAINTAIN on table public.document_table_cells to anon;

grant REFERENCES on table public.document_table_cells to anon;

grant SELECT on table public.document_table_cells to anon;

grant TRIGGER on table public.document_table_cells to anon;

grant TRUNCATE on table public.document_table_cells to anon;

grant UPDATE on table public.document_table_cells to anon;

grant DELETE on table public.document_table_cells to authenticated;

grant INSERT on table public.document_table_cells to authenticated;

grant MAINTAIN on table public.document_table_cells to authenticated;

grant REFERENCES on table public.document_table_cells to authenticated;

grant SELECT on table public.document_table_cells to authenticated;

grant TRIGGER on table public.document_table_cells to authenticated;

grant TRUNCATE on table public.document_table_cells to authenticated;

grant UPDATE on table public.document_table_cells to authenticated;

grant DELETE on table public.document_table_cells to service_role;

grant INSERT on table public.document_table_cells to service_role;

grant MAINTAIN on table public.document_table_cells to service_role;

grant REFERENCES on table public.document_table_cells to service_role;

grant SELECT on table public.document_table_cells to service_role;

grant TRIGGER on table public.document_table_cells to service_role;

grant TRUNCATE on table public.document_table_cells to service_role;

grant UPDATE on table public.document_table_cells to service_role;

grant DELETE on table public.document_tables to anon;

grant INSERT on table public.document_tables to anon;

grant MAINTAIN on table public.document_tables to anon;

grant REFERENCES on table public.document_tables to anon;

grant SELECT on table public.document_tables to anon;

grant TRIGGER on table public.document_tables to anon;

grant TRUNCATE on table public.document_tables to anon;

grant UPDATE on table public.document_tables to anon;

grant DELETE on table public.document_tables to authenticated;

grant INSERT on table public.document_tables to authenticated;

grant MAINTAIN on table public.document_tables to authenticated;

grant REFERENCES on table public.document_tables to authenticated;

grant SELECT on table public.document_tables to authenticated;

grant TRIGGER on table public.document_tables to authenticated;

grant TRUNCATE on table public.document_tables to authenticated;

grant UPDATE on table public.document_tables to authenticated;

grant DELETE on table public.document_tables to service_role;

grant INSERT on table public.document_tables to service_role;

grant MAINTAIN on table public.document_tables to service_role;

grant REFERENCES on table public.document_tables to service_role;

grant SELECT on table public.document_tables to service_role;

grant TRIGGER on table public.document_tables to service_role;

grant TRUNCATE on table public.document_tables to service_role;

grant UPDATE on table public.document_tables to service_role;

grant DELETE on table public.document_templates to anon;

grant INSERT on table public.document_templates to anon;

grant MAINTAIN on table public.document_templates to anon;

grant REFERENCES on table public.document_templates to anon;

grant SELECT on table public.document_templates to anon;

grant TRIGGER on table public.document_templates to anon;

grant TRUNCATE on table public.document_templates to anon;

grant UPDATE on table public.document_templates to anon;

grant DELETE on table public.document_templates to authenticated;

grant INSERT on table public.document_templates to authenticated;

grant MAINTAIN on table public.document_templates to authenticated;

grant REFERENCES on table public.document_templates to authenticated;

grant SELECT on table public.document_templates to authenticated;

grant TRIGGER on table public.document_templates to authenticated;

grant TRUNCATE on table public.document_templates to authenticated;

grant UPDATE on table public.document_templates to authenticated;

grant DELETE on table public.document_templates to service_role;

grant INSERT on table public.document_templates to service_role;

grant MAINTAIN on table public.document_templates to service_role;

grant REFERENCES on table public.document_templates to service_role;

grant SELECT on table public.document_templates to service_role;

grant TRIGGER on table public.document_templates to service_role;

grant TRUNCATE on table public.document_templates to service_role;

grant UPDATE on table public.document_templates to service_role;

grant DELETE on table public.document_topics to anon;

grant INSERT on table public.document_topics to anon;

grant MAINTAIN on table public.document_topics to anon;

grant REFERENCES on table public.document_topics to anon;

grant SELECT on table public.document_topics to anon;

grant TRIGGER on table public.document_topics to anon;

grant TRUNCATE on table public.document_topics to anon;

grant UPDATE on table public.document_topics to anon;

grant DELETE on table public.document_topics to authenticated;

grant INSERT on table public.document_topics to authenticated;

grant MAINTAIN on table public.document_topics to authenticated;

grant REFERENCES on table public.document_topics to authenticated;

grant SELECT on table public.document_topics to authenticated;

grant TRIGGER on table public.document_topics to authenticated;

grant TRUNCATE on table public.document_topics to authenticated;

grant UPDATE on table public.document_topics to authenticated;

grant DELETE on table public.document_topics to service_role;

grant INSERT on table public.document_topics to service_role;

grant MAINTAIN on table public.document_topics to service_role;

grant REFERENCES on table public.document_topics to service_role;

grant SELECT on table public.document_topics to service_role;

grant TRIGGER on table public.document_topics to service_role;

grant TRUNCATE on table public.document_topics to service_role;

grant UPDATE on table public.document_topics to service_role;

grant DELETE on table public.document_types to anon;

grant INSERT on table public.document_types to anon;

grant MAINTAIN on table public.document_types to anon;

grant REFERENCES on table public.document_types to anon;

grant SELECT on table public.document_types to anon;

grant TRIGGER on table public.document_types to anon;

grant TRUNCATE on table public.document_types to anon;

grant UPDATE on table public.document_types to anon;

grant DELETE on table public.document_types to authenticated;

grant INSERT on table public.document_types to authenticated;

grant MAINTAIN on table public.document_types to authenticated;

grant REFERENCES on table public.document_types to authenticated;

grant SELECT on table public.document_types to authenticated;

grant TRIGGER on table public.document_types to authenticated;

grant TRUNCATE on table public.document_types to authenticated;

grant UPDATE on table public.document_types to authenticated;

grant DELETE on table public.document_types to service_role;

grant INSERT on table public.document_types to service_role;

grant MAINTAIN on table public.document_types to service_role;

grant REFERENCES on table public.document_types to service_role;

grant SELECT on table public.document_types to service_role;

grant TRIGGER on table public.document_types to service_role;

grant TRUNCATE on table public.document_types to service_role;

grant UPDATE on table public.document_types to service_role;

grant DELETE on table public.document_versions to anon;

grant INSERT on table public.document_versions to anon;

grant MAINTAIN on table public.document_versions to anon;

grant REFERENCES on table public.document_versions to anon;

grant SELECT on table public.document_versions to anon;

grant TRIGGER on table public.document_versions to anon;

grant TRUNCATE on table public.document_versions to anon;

grant UPDATE on table public.document_versions to anon;

grant DELETE on table public.document_versions to authenticated;

grant INSERT on table public.document_versions to authenticated;

grant MAINTAIN on table public.document_versions to authenticated;

grant REFERENCES on table public.document_versions to authenticated;

grant SELECT on table public.document_versions to authenticated;

grant TRIGGER on table public.document_versions to authenticated;

grant TRUNCATE on table public.document_versions to authenticated;

grant UPDATE on table public.document_versions to authenticated;

grant DELETE on table public.document_versions to service_role;

grant INSERT on table public.document_versions to service_role;

grant MAINTAIN on table public.document_versions to service_role;

grant REFERENCES on table public.document_versions to service_role;

grant SELECT on table public.document_versions to service_role;

grant TRIGGER on table public.document_versions to service_role;

grant TRUNCATE on table public.document_versions to service_role;

grant UPDATE on table public.document_versions to service_role;

grant DELETE on table public.documents to anon;

grant INSERT on table public.documents to anon;

grant MAINTAIN on table public.documents to anon;

grant REFERENCES on table public.documents to anon;

grant SELECT on table public.documents to anon;

grant TRIGGER on table public.documents to anon;

grant TRUNCATE on table public.documents to anon;

grant UPDATE on table public.documents to anon;

grant DELETE on table public.documents to authenticated;

grant INSERT on table public.documents to authenticated;

grant MAINTAIN on table public.documents to authenticated;

grant REFERENCES on table public.documents to authenticated;

grant SELECT on table public.documents to authenticated;

grant TRIGGER on table public.documents to authenticated;

grant TRUNCATE on table public.documents to authenticated;

grant UPDATE on table public.documents to authenticated;

grant DELETE on table public.documents to service_role;

grant INSERT on table public.documents to service_role;

grant MAINTAIN on table public.documents to service_role;

grant REFERENCES on table public.documents to service_role;

grant SELECT on table public.documents to service_role;

grant TRIGGER on table public.documents to service_role;

grant TRUNCATE on table public.documents to service_role;

grant UPDATE on table public.documents to service_role;

grant DELETE on table public.embeddings to anon;

grant INSERT on table public.embeddings to anon;

grant MAINTAIN on table public.embeddings to anon;

grant REFERENCES on table public.embeddings to anon;

grant SELECT on table public.embeddings to anon;

grant TRIGGER on table public.embeddings to anon;

grant TRUNCATE on table public.embeddings to anon;

grant UPDATE on table public.embeddings to anon;

grant DELETE on table public.embeddings to authenticated;

grant INSERT on table public.embeddings to authenticated;

grant MAINTAIN on table public.embeddings to authenticated;

grant REFERENCES on table public.embeddings to authenticated;

grant SELECT on table public.embeddings to authenticated;

grant TRIGGER on table public.embeddings to authenticated;

grant TRUNCATE on table public.embeddings to authenticated;

grant UPDATE on table public.embeddings to authenticated;

grant DELETE on table public.embeddings to service_role;

grant INSERT on table public.embeddings to service_role;

grant MAINTAIN on table public.embeddings to service_role;

grant REFERENCES on table public.embeddings to service_role;

grant SELECT on table public.embeddings to service_role;

grant TRIGGER on table public.embeddings to service_role;

grant TRUNCATE on table public.embeddings to service_role;

grant UPDATE on table public.embeddings to service_role;

grant DELETE on table public.error_logs to anon;

grant INSERT on table public.error_logs to anon;

grant MAINTAIN on table public.error_logs to anon;

grant REFERENCES on table public.error_logs to anon;

grant SELECT on table public.error_logs to anon;

grant TRIGGER on table public.error_logs to anon;

grant TRUNCATE on table public.error_logs to anon;

grant UPDATE on table public.error_logs to anon;

grant DELETE on table public.error_logs to authenticated;

grant INSERT on table public.error_logs to authenticated;

grant MAINTAIN on table public.error_logs to authenticated;

grant REFERENCES on table public.error_logs to authenticated;

grant SELECT on table public.error_logs to authenticated;

grant TRIGGER on table public.error_logs to authenticated;

grant TRUNCATE on table public.error_logs to authenticated;

grant UPDATE on table public.error_logs to authenticated;

grant DELETE on table public.error_logs to service_role;

grant INSERT on table public.error_logs to service_role;

grant MAINTAIN on table public.error_logs to service_role;

grant REFERENCES on table public.error_logs to service_role;

grant SELECT on table public.error_logs to service_role;

grant TRIGGER on table public.error_logs to service_role;

grant TRUNCATE on table public.error_logs to service_role;

grant UPDATE on table public.error_logs to service_role;

grant DELETE on table public.evidence_registry to anon;

grant INSERT on table public.evidence_registry to anon;

grant MAINTAIN on table public.evidence_registry to anon;

grant REFERENCES on table public.evidence_registry to anon;

grant SELECT on table public.evidence_registry to anon;

grant TRIGGER on table public.evidence_registry to anon;

grant TRUNCATE on table public.evidence_registry to anon;

grant UPDATE on table public.evidence_registry to anon;

grant DELETE on table public.evidence_registry to authenticated;

grant INSERT on table public.evidence_registry to authenticated;

grant MAINTAIN on table public.evidence_registry to authenticated;

grant REFERENCES on table public.evidence_registry to authenticated;

grant SELECT on table public.evidence_registry to authenticated;

grant TRIGGER on table public.evidence_registry to authenticated;

grant TRUNCATE on table public.evidence_registry to authenticated;

grant UPDATE on table public.evidence_registry to authenticated;

grant DELETE on table public.evidence_registry to service_role;

grant INSERT on table public.evidence_registry to service_role;

grant MAINTAIN on table public.evidence_registry to service_role;

grant REFERENCES on table public.evidence_registry to service_role;

grant SELECT on table public.evidence_registry to service_role;

grant TRIGGER on table public.evidence_registry to service_role;

grant TRUNCATE on table public.evidence_registry to service_role;

grant UPDATE on table public.evidence_registry to service_role;

grant DELETE on table public.fragment_translations to anon;

grant INSERT on table public.fragment_translations to anon;

grant MAINTAIN on table public.fragment_translations to anon;

grant REFERENCES on table public.fragment_translations to anon;

grant SELECT on table public.fragment_translations to anon;

grant TRIGGER on table public.fragment_translations to anon;

grant TRUNCATE on table public.fragment_translations to anon;

grant UPDATE on table public.fragment_translations to anon;

grant DELETE on table public.fragment_translations to authenticated;

grant INSERT on table public.fragment_translations to authenticated;

grant MAINTAIN on table public.fragment_translations to authenticated;

grant REFERENCES on table public.fragment_translations to authenticated;

grant SELECT on table public.fragment_translations to authenticated;

grant TRIGGER on table public.fragment_translations to authenticated;

grant TRUNCATE on table public.fragment_translations to authenticated;

grant UPDATE on table public.fragment_translations to authenticated;

grant DELETE on table public.fragment_translations to service_role;

grant INSERT on table public.fragment_translations to service_role;

grant MAINTAIN on table public.fragment_translations to service_role;

grant REFERENCES on table public.fragment_translations to service_role;

grant SELECT on table public.fragment_translations to service_role;

grant TRIGGER on table public.fragment_translations to service_role;

grant TRUNCATE on table public.fragment_translations to service_role;

grant UPDATE on table public.fragment_translations to service_role;

grant DELETE on table public.generated_documents to anon;

grant INSERT on table public.generated_documents to anon;

grant MAINTAIN on table public.generated_documents to anon;

grant REFERENCES on table public.generated_documents to anon;

grant SELECT on table public.generated_documents to anon;

grant TRIGGER on table public.generated_documents to anon;

grant TRUNCATE on table public.generated_documents to anon;

grant UPDATE on table public.generated_documents to anon;

grant DELETE on table public.generated_documents to authenticated;

grant INSERT on table public.generated_documents to authenticated;

grant MAINTAIN on table public.generated_documents to authenticated;

grant REFERENCES on table public.generated_documents to authenticated;

grant SELECT on table public.generated_documents to authenticated;

grant TRIGGER on table public.generated_documents to authenticated;

grant TRUNCATE on table public.generated_documents to authenticated;

grant UPDATE on table public.generated_documents to authenticated;

grant DELETE on table public.generated_documents to service_role;

grant INSERT on table public.generated_documents to service_role;

grant MAINTAIN on table public.generated_documents to service_role;

grant REFERENCES on table public.generated_documents to service_role;

grant SELECT on table public.generated_documents to service_role;

grant TRIGGER on table public.generated_documents to service_role;

grant TRUNCATE on table public.generated_documents to service_role;

grant UPDATE on table public.generated_documents to service_role;

grant DELETE on table public.judges to anon;

grant INSERT on table public.judges to anon;

grant MAINTAIN on table public.judges to anon;

grant REFERENCES on table public.judges to anon;

grant SELECT on table public.judges to anon;

grant TRIGGER on table public.judges to anon;

grant TRUNCATE on table public.judges to anon;

grant UPDATE on table public.judges to anon;

grant DELETE on table public.judges to authenticated;

grant INSERT on table public.judges to authenticated;

grant MAINTAIN on table public.judges to authenticated;

grant REFERENCES on table public.judges to authenticated;

grant SELECT on table public.judges to authenticated;

grant TRIGGER on table public.judges to authenticated;

grant TRUNCATE on table public.judges to authenticated;

grant UPDATE on table public.judges to authenticated;

grant DELETE on table public.judges to service_role;

grant INSERT on table public.judges to service_role;

grant MAINTAIN on table public.judges to service_role;

grant REFERENCES on table public.judges to service_role;

grant SELECT on table public.judges to service_role;

grant TRIGGER on table public.judges to service_role;

grant TRUNCATE on table public.judges to service_role;

grant UPDATE on table public.judges to service_role;

grant DELETE on table public.jurisdictions to anon;

grant INSERT on table public.jurisdictions to anon;

grant MAINTAIN on table public.jurisdictions to anon;

grant REFERENCES on table public.jurisdictions to anon;

grant SELECT on table public.jurisdictions to anon;

grant TRIGGER on table public.jurisdictions to anon;

grant TRUNCATE on table public.jurisdictions to anon;

grant UPDATE on table public.jurisdictions to anon;

grant DELETE on table public.jurisdictions to authenticated;

grant INSERT on table public.jurisdictions to authenticated;

grant MAINTAIN on table public.jurisdictions to authenticated;

grant REFERENCES on table public.jurisdictions to authenticated;

grant SELECT on table public.jurisdictions to authenticated;

grant TRIGGER on table public.jurisdictions to authenticated;

grant TRUNCATE on table public.jurisdictions to authenticated;

grant UPDATE on table public.jurisdictions to authenticated;

grant DELETE on table public.jurisdictions to service_role;

grant INSERT on table public.jurisdictions to service_role;

grant MAINTAIN on table public.jurisdictions to service_role;

grant REFERENCES on table public.jurisdictions to service_role;

grant SELECT on table public.jurisdictions to service_role;

grant TRIGGER on table public.jurisdictions to service_role;

grant TRUNCATE on table public.jurisdictions to service_role;

grant UPDATE on table public.jurisdictions to service_role;

grant DELETE on table public.kb_versions to anon;

grant INSERT on table public.kb_versions to anon;

grant MAINTAIN on table public.kb_versions to anon;

grant REFERENCES on table public.kb_versions to anon;

grant SELECT on table public.kb_versions to anon;

grant TRIGGER on table public.kb_versions to anon;

grant TRUNCATE on table public.kb_versions to anon;

grant UPDATE on table public.kb_versions to anon;

grant DELETE on table public.kb_versions to authenticated;

grant INSERT on table public.kb_versions to authenticated;

grant MAINTAIN on table public.kb_versions to authenticated;

grant REFERENCES on table public.kb_versions to authenticated;

grant SELECT on table public.kb_versions to authenticated;

grant TRIGGER on table public.kb_versions to authenticated;

grant TRUNCATE on table public.kb_versions to authenticated;

grant UPDATE on table public.kb_versions to authenticated;

grant DELETE on table public.kb_versions to service_role;

grant INSERT on table public.kb_versions to service_role;

grant MAINTAIN on table public.kb_versions to service_role;

grant REFERENCES on table public.kb_versions to service_role;

grant SELECT on table public.kb_versions to service_role;

grant TRIGGER on table public.kb_versions to service_role;

grant TRUNCATE on table public.kb_versions to service_role;

grant UPDATE on table public.kb_versions to service_role;

grant DELETE on table public.knowledge_base to anon;

grant INSERT on table public.knowledge_base to anon;

grant MAINTAIN on table public.knowledge_base to anon;

grant REFERENCES on table public.knowledge_base to anon;

grant SELECT on table public.knowledge_base to anon;

grant TRIGGER on table public.knowledge_base to anon;

grant TRUNCATE on table public.knowledge_base to anon;

grant UPDATE on table public.knowledge_base to anon;

grant DELETE on table public.knowledge_base to authenticated;

grant INSERT on table public.knowledge_base to authenticated;

grant MAINTAIN on table public.knowledge_base to authenticated;

grant REFERENCES on table public.knowledge_base to authenticated;

grant SELECT on table public.knowledge_base to authenticated;

grant TRIGGER on table public.knowledge_base to authenticated;

grant TRUNCATE on table public.knowledge_base to authenticated;

grant UPDATE on table public.knowledge_base to authenticated;

grant DELETE on table public.knowledge_base to service_role;

grant INSERT on table public.knowledge_base to service_role;

grant MAINTAIN on table public.knowledge_base to service_role;

grant REFERENCES on table public.knowledge_base to service_role;

grant SELECT on table public.knowledge_base to service_role;

grant TRIGGER on table public.knowledge_base to service_role;

grant TRUNCATE on table public.knowledge_base to service_role;

grant UPDATE on table public.knowledge_base to service_role;

grant DELETE on table public.knowledge_document_profiles to anon;

grant INSERT on table public.knowledge_document_profiles to anon;

grant MAINTAIN on table public.knowledge_document_profiles to anon;

grant REFERENCES on table public.knowledge_document_profiles to anon;

grant SELECT on table public.knowledge_document_profiles to anon;

grant TRIGGER on table public.knowledge_document_profiles to anon;

grant TRUNCATE on table public.knowledge_document_profiles to anon;

grant UPDATE on table public.knowledge_document_profiles to anon;

grant DELETE on table public.knowledge_document_profiles to authenticated;

grant INSERT on table public.knowledge_document_profiles to authenticated;

grant MAINTAIN on table public.knowledge_document_profiles to authenticated;

grant REFERENCES on table public.knowledge_document_profiles to authenticated;

grant SELECT on table public.knowledge_document_profiles to authenticated;

grant TRIGGER on table public.knowledge_document_profiles to authenticated;

grant TRUNCATE on table public.knowledge_document_profiles to authenticated;

grant UPDATE on table public.knowledge_document_profiles to authenticated;

grant DELETE on table public.knowledge_document_profiles to service_role;

grant INSERT on table public.knowledge_document_profiles to service_role;

grant MAINTAIN on table public.knowledge_document_profiles to service_role;

grant REFERENCES on table public.knowledge_document_profiles to service_role;

grant SELECT on table public.knowledge_document_profiles to service_role;

grant TRIGGER on table public.knowledge_document_profiles to service_role;

grant TRUNCATE on table public.knowledge_document_profiles to service_role;

grant UPDATE on table public.knowledge_document_profiles to service_role;

grant DELETE on table public.legal_documents to anon;

grant INSERT on table public.legal_documents to anon;

grant MAINTAIN on table public.legal_documents to anon;

grant REFERENCES on table public.legal_documents to anon;

grant SELECT on table public.legal_documents to anon;

grant TRIGGER on table public.legal_documents to anon;

grant TRUNCATE on table public.legal_documents to anon;

grant UPDATE on table public.legal_documents to anon;

grant DELETE on table public.legal_documents to authenticated;

grant INSERT on table public.legal_documents to authenticated;

grant MAINTAIN on table public.legal_documents to authenticated;

grant REFERENCES on table public.legal_documents to authenticated;

grant SELECT on table public.legal_documents to authenticated;

grant TRIGGER on table public.legal_documents to authenticated;

grant TRUNCATE on table public.legal_documents to authenticated;

grant UPDATE on table public.legal_documents to authenticated;

grant DELETE on table public.legal_documents to service_role;

grant INSERT on table public.legal_documents to service_role;

grant MAINTAIN on table public.legal_documents to service_role;

grant REFERENCES on table public.legal_documents to service_role;

grant SELECT on table public.legal_documents to service_role;

grant TRIGGER on table public.legal_documents to service_role;

grant TRUNCATE on table public.legal_documents to service_role;

grant UPDATE on table public.legal_documents to service_role;

grant DELETE on table public.legal_edges to anon;

grant INSERT on table public.legal_edges to anon;

grant MAINTAIN on table public.legal_edges to anon;

grant REFERENCES on table public.legal_edges to anon;

grant SELECT on table public.legal_edges to anon;

grant TRIGGER on table public.legal_edges to anon;

grant TRUNCATE on table public.legal_edges to anon;

grant UPDATE on table public.legal_edges to anon;

grant DELETE on table public.legal_edges to authenticated;

grant INSERT on table public.legal_edges to authenticated;

grant MAINTAIN on table public.legal_edges to authenticated;

grant REFERENCES on table public.legal_edges to authenticated;

grant SELECT on table public.legal_edges to authenticated;

grant TRIGGER on table public.legal_edges to authenticated;

grant TRUNCATE on table public.legal_edges to authenticated;

grant UPDATE on table public.legal_edges to authenticated;

grant DELETE on table public.legal_edges to service_role;

grant INSERT on table public.legal_edges to service_role;

grant MAINTAIN on table public.legal_edges to service_role;

grant REFERENCES on table public.legal_edges to service_role;

grant SELECT on table public.legal_edges to service_role;

grant TRIGGER on table public.legal_edges to service_role;

grant TRUNCATE on table public.legal_edges to service_role;

grant UPDATE on table public.legal_edges to service_role;

grant DELETE on table public.legal_units to anon;

grant INSERT on table public.legal_units to anon;

grant MAINTAIN on table public.legal_units to anon;

grant REFERENCES on table public.legal_units to anon;

grant SELECT on table public.legal_units to anon;

grant TRIGGER on table public.legal_units to anon;

grant TRUNCATE on table public.legal_units to anon;

grant UPDATE on table public.legal_units to anon;

grant DELETE on table public.legal_units to authenticated;

grant INSERT on table public.legal_units to authenticated;

grant MAINTAIN on table public.legal_units to authenticated;

grant REFERENCES on table public.legal_units to authenticated;

grant SELECT on table public.legal_units to authenticated;

grant TRIGGER on table public.legal_units to authenticated;

grant TRUNCATE on table public.legal_units to authenticated;

grant UPDATE on table public.legal_units to authenticated;

grant DELETE on table public.legal_units to service_role;

grant INSERT on table public.legal_units to service_role;

grant MAINTAIN on table public.legal_units to service_role;

grant REFERENCES on table public.legal_units to service_role;

grant SELECT on table public.legal_units to service_role;

grant TRIGGER on table public.legal_units to service_role;

grant TRUNCATE on table public.legal_units to service_role;

grant UPDATE on table public.legal_units to service_role;

grant DELETE on table public.notifications to anon;

grant INSERT on table public.notifications to anon;

grant MAINTAIN on table public.notifications to anon;

grant REFERENCES on table public.notifications to anon;

grant SELECT on table public.notifications to anon;

grant TRIGGER on table public.notifications to anon;

grant TRUNCATE on table public.notifications to anon;

grant UPDATE on table public.notifications to anon;

grant DELETE on table public.notifications to authenticated;

grant INSERT on table public.notifications to authenticated;

grant MAINTAIN on table public.notifications to authenticated;

grant REFERENCES on table public.notifications to authenticated;

grant SELECT on table public.notifications to authenticated;

grant TRIGGER on table public.notifications to authenticated;

grant TRUNCATE on table public.notifications to authenticated;

grant UPDATE on table public.notifications to authenticated;

grant DELETE on table public.notifications to service_role;

grant INSERT on table public.notifications to service_role;

grant MAINTAIN on table public.notifications to service_role;

grant REFERENCES on table public.notifications to service_role;

grant SELECT on table public.notifications to service_role;

grant TRIGGER on table public.notifications to service_role;

grant TRUNCATE on table public.notifications to service_role;

grant UPDATE on table public.notifications to service_role;

grant DELETE on table public.ocr_results to anon;

grant INSERT on table public.ocr_results to anon;

grant MAINTAIN on table public.ocr_results to anon;

grant REFERENCES on table public.ocr_results to anon;

grant SELECT on table public.ocr_results to anon;

grant TRIGGER on table public.ocr_results to anon;

grant TRUNCATE on table public.ocr_results to anon;

grant UPDATE on table public.ocr_results to anon;

grant DELETE on table public.ocr_results to authenticated;

grant INSERT on table public.ocr_results to authenticated;

grant MAINTAIN on table public.ocr_results to authenticated;

grant REFERENCES on table public.ocr_results to authenticated;

grant SELECT on table public.ocr_results to authenticated;

grant TRIGGER on table public.ocr_results to authenticated;

grant TRUNCATE on table public.ocr_results to authenticated;

grant UPDATE on table public.ocr_results to authenticated;

grant DELETE on table public.ocr_results to service_role;

grant INSERT on table public.ocr_results to service_role;

grant MAINTAIN on table public.ocr_results to service_role;

grant REFERENCES on table public.ocr_results to service_role;

grant SELECT on table public.ocr_results to service_role;

grant TRIGGER on table public.ocr_results to service_role;

grant TRUNCATE on table public.ocr_results to service_role;

grant UPDATE on table public.ocr_results to service_role;

grant DELETE on table public.parties to anon;

grant INSERT on table public.parties to anon;

grant MAINTAIN on table public.parties to anon;

grant REFERENCES on table public.parties to anon;

grant SELECT on table public.parties to anon;

grant TRIGGER on table public.parties to anon;

grant TRUNCATE on table public.parties to anon;

grant UPDATE on table public.parties to anon;

grant DELETE on table public.parties to authenticated;

grant INSERT on table public.parties to authenticated;

grant MAINTAIN on table public.parties to authenticated;

grant REFERENCES on table public.parties to authenticated;

grant SELECT on table public.parties to authenticated;

grant TRIGGER on table public.parties to authenticated;

grant TRUNCATE on table public.parties to authenticated;

grant UPDATE on table public.parties to authenticated;

grant DELETE on table public.parties to service_role;

grant INSERT on table public.parties to service_role;

grant MAINTAIN on table public.parties to service_role;

grant REFERENCES on table public.parties to service_role;

grant SELECT on table public.parties to service_role;

grant TRIGGER on table public.parties to service_role;

grant TRUNCATE on table public.parties to service_role;

grant UPDATE on table public.parties to service_role;

grant DELETE on table public.practice_document_profiles to anon;

grant INSERT on table public.practice_document_profiles to anon;

grant MAINTAIN on table public.practice_document_profiles to anon;

grant REFERENCES on table public.practice_document_profiles to anon;

grant SELECT on table public.practice_document_profiles to anon;

grant TRIGGER on table public.practice_document_profiles to anon;

grant TRUNCATE on table public.practice_document_profiles to anon;

grant UPDATE on table public.practice_document_profiles to anon;

grant DELETE on table public.practice_document_profiles to authenticated;

grant INSERT on table public.practice_document_profiles to authenticated;

grant MAINTAIN on table public.practice_document_profiles to authenticated;

grant REFERENCES on table public.practice_document_profiles to authenticated;

grant SELECT on table public.practice_document_profiles to authenticated;

grant TRIGGER on table public.practice_document_profiles to authenticated;

grant TRUNCATE on table public.practice_document_profiles to authenticated;

grant UPDATE on table public.practice_document_profiles to authenticated;

grant DELETE on table public.practice_document_profiles to service_role;

grant INSERT on table public.practice_document_profiles to service_role;

grant MAINTAIN on table public.practice_document_profiles to service_role;

grant REFERENCES on table public.practice_document_profiles to service_role;

grant SELECT on table public.practice_document_profiles to service_role;

grant TRIGGER on table public.practice_document_profiles to service_role;

grant TRUNCATE on table public.practice_document_profiles to service_role;

grant UPDATE on table public.practice_document_profiles to service_role;

grant DELETE on table public.practice_to_knowledge_references to anon;

grant INSERT on table public.practice_to_knowledge_references to anon;

grant MAINTAIN on table public.practice_to_knowledge_references to anon;

grant REFERENCES on table public.practice_to_knowledge_references to anon;

grant SELECT on table public.practice_to_knowledge_references to anon;

grant TRIGGER on table public.practice_to_knowledge_references to anon;

grant TRUNCATE on table public.practice_to_knowledge_references to anon;

grant UPDATE on table public.practice_to_knowledge_references to anon;

grant DELETE on table public.practice_to_knowledge_references to authenticated;

grant INSERT on table public.practice_to_knowledge_references to authenticated;

grant MAINTAIN on table public.practice_to_knowledge_references to authenticated;

grant REFERENCES on table public.practice_to_knowledge_references to authenticated;

grant SELECT on table public.practice_to_knowledge_references to authenticated;

grant TRIGGER on table public.practice_to_knowledge_references to authenticated;

grant TRUNCATE on table public.practice_to_knowledge_references to authenticated;

grant UPDATE on table public.practice_to_knowledge_references to authenticated;

grant DELETE on table public.practice_to_knowledge_references to service_role;

grant INSERT on table public.practice_to_knowledge_references to service_role;

grant MAINTAIN on table public.practice_to_knowledge_references to service_role;

grant REFERENCES on table public.practice_to_knowledge_references to service_role;

grant SELECT on table public.practice_to_knowledge_references to service_role;

grant TRIGGER on table public.practice_to_knowledge_references to service_role;

grant TRUNCATE on table public.practice_to_knowledge_references to service_role;

grant UPDATE on table public.practice_to_knowledge_references to service_role;

grant DELETE on table public.profile_compat_settings to anon;

grant INSERT on table public.profile_compat_settings to anon;

grant MAINTAIN on table public.profile_compat_settings to anon;

grant REFERENCES on table public.profile_compat_settings to anon;

grant SELECT on table public.profile_compat_settings to anon;

grant TRIGGER on table public.profile_compat_settings to anon;

grant TRUNCATE on table public.profile_compat_settings to anon;

grant UPDATE on table public.profile_compat_settings to anon;

grant DELETE on table public.profile_compat_settings to authenticated;

grant INSERT on table public.profile_compat_settings to authenticated;

grant MAINTAIN on table public.profile_compat_settings to authenticated;

grant REFERENCES on table public.profile_compat_settings to authenticated;

grant SELECT on table public.profile_compat_settings to authenticated;

grant TRIGGER on table public.profile_compat_settings to authenticated;

grant TRUNCATE on table public.profile_compat_settings to authenticated;

grant UPDATE on table public.profile_compat_settings to authenticated;

grant DELETE on table public.profile_compat_settings to service_role;

grant INSERT on table public.profile_compat_settings to service_role;

grant MAINTAIN on table public.profile_compat_settings to service_role;

grant REFERENCES on table public.profile_compat_settings to service_role;

grant SELECT on table public.profile_compat_settings to service_role;

grant TRIGGER on table public.profile_compat_settings to service_role;

grant TRUNCATE on table public.profile_compat_settings to service_role;

grant UPDATE on table public.profile_compat_settings to service_role;

grant DELETE on table public.profiles to anon;

grant INSERT on table public.profiles to anon;

grant MAINTAIN on table public.profiles to anon;

grant REFERENCES on table public.profiles to anon;

grant SELECT on table public.profiles to anon;

grant TRIGGER on table public.profiles to anon;

grant TRUNCATE on table public.profiles to anon;

grant UPDATE on table public.profiles to anon;

grant DELETE on table public.profiles to authenticated;

grant INSERT on table public.profiles to authenticated;

grant MAINTAIN on table public.profiles to authenticated;

grant REFERENCES on table public.profiles to authenticated;

grant SELECT on table public.profiles to authenticated;

grant TRIGGER on table public.profiles to authenticated;

grant TRUNCATE on table public.profiles to authenticated;

grant UPDATE on table public.profiles to authenticated;

grant DELETE on table public.profiles to service_role;

grant INSERT on table public.profiles to service_role;

grant MAINTAIN on table public.profiles to service_role;

grant REFERENCES on table public.profiles to service_role;

grant SELECT on table public.profiles to service_role;

grant TRIGGER on table public.profiles to service_role;

grant TRUNCATE on table public.profiles to service_role;

grant UPDATE on table public.profiles to service_role;

grant DELETE on table public.publication_sources to anon;

grant INSERT on table public.publication_sources to anon;

grant MAINTAIN on table public.publication_sources to anon;

grant REFERENCES on table public.publication_sources to anon;

grant SELECT on table public.publication_sources to anon;

grant TRIGGER on table public.publication_sources to anon;

grant TRUNCATE on table public.publication_sources to anon;

grant UPDATE on table public.publication_sources to anon;

grant DELETE on table public.publication_sources to authenticated;

grant INSERT on table public.publication_sources to authenticated;

grant MAINTAIN on table public.publication_sources to authenticated;

grant REFERENCES on table public.publication_sources to authenticated;

grant SELECT on table public.publication_sources to authenticated;

grant TRIGGER on table public.publication_sources to authenticated;

grant TRUNCATE on table public.publication_sources to authenticated;

grant UPDATE on table public.publication_sources to authenticated;

grant DELETE on table public.publication_sources to service_role;

grant INSERT on table public.publication_sources to service_role;

grant MAINTAIN on table public.publication_sources to service_role;

grant REFERENCES on table public.publication_sources to service_role;

grant SELECT on table public.publication_sources to service_role;

grant TRIGGER on table public.publication_sources to service_role;

grant TRUNCATE on table public.publication_sources to service_role;

grant UPDATE on table public.publication_sources to service_role;

grant DELETE on table public.reminders to anon;

grant INSERT on table public.reminders to anon;

grant MAINTAIN on table public.reminders to anon;

grant REFERENCES on table public.reminders to anon;

grant SELECT on table public.reminders to anon;

grant TRIGGER on table public.reminders to anon;

grant TRUNCATE on table public.reminders to anon;

grant UPDATE on table public.reminders to anon;

grant DELETE on table public.reminders to authenticated;

grant INSERT on table public.reminders to authenticated;

grant MAINTAIN on table public.reminders to authenticated;

grant REFERENCES on table public.reminders to authenticated;

grant SELECT on table public.reminders to authenticated;

grant TRIGGER on table public.reminders to authenticated;

grant TRUNCATE on table public.reminders to authenticated;

grant UPDATE on table public.reminders to authenticated;

grant DELETE on table public.reminders to service_role;

grant INSERT on table public.reminders to service_role;

grant MAINTAIN on table public.reminders to service_role;

grant REFERENCES on table public.reminders to service_role;

grant SELECT on table public.reminders to service_role;

grant TRIGGER on table public.reminders to service_role;

grant TRUNCATE on table public.reminders to service_role;

grant UPDATE on table public.reminders to service_role;

grant DELETE on table public.search_chunks to anon;

grant INSERT on table public.search_chunks to anon;

grant MAINTAIN on table public.search_chunks to anon;

grant REFERENCES on table public.search_chunks to anon;

grant SELECT on table public.search_chunks to anon;

grant TRIGGER on table public.search_chunks to anon;

grant TRUNCATE on table public.search_chunks to anon;

grant UPDATE on table public.search_chunks to anon;

grant DELETE on table public.search_chunks to authenticated;

grant INSERT on table public.search_chunks to authenticated;

grant MAINTAIN on table public.search_chunks to authenticated;

grant REFERENCES on table public.search_chunks to authenticated;

grant SELECT on table public.search_chunks to authenticated;

grant TRIGGER on table public.search_chunks to authenticated;

grant TRUNCATE on table public.search_chunks to authenticated;

grant UPDATE on table public.search_chunks to authenticated;

grant DELETE on table public.search_chunks to service_role;

grant INSERT on table public.search_chunks to service_role;

grant MAINTAIN on table public.search_chunks to service_role;

grant REFERENCES on table public.search_chunks to service_role;

grant SELECT on table public.search_chunks to service_role;

grant TRIGGER on table public.search_chunks to service_role;

grant TRUNCATE on table public.search_chunks to service_role;

grant UPDATE on table public.search_chunks to service_role;

grant DELETE on table public.search_chunks_legal_unit to anon;

grant INSERT on table public.search_chunks_legal_unit to anon;

grant MAINTAIN on table public.search_chunks_legal_unit to anon;

grant REFERENCES on table public.search_chunks_legal_unit to anon;

grant SELECT on table public.search_chunks_legal_unit to anon;

grant TRIGGER on table public.search_chunks_legal_unit to anon;

grant TRUNCATE on table public.search_chunks_legal_unit to anon;

grant UPDATE on table public.search_chunks_legal_unit to anon;

grant DELETE on table public.search_chunks_legal_unit to authenticated;

grant INSERT on table public.search_chunks_legal_unit to authenticated;

grant MAINTAIN on table public.search_chunks_legal_unit to authenticated;

grant REFERENCES on table public.search_chunks_legal_unit to authenticated;

grant SELECT on table public.search_chunks_legal_unit to authenticated;

grant TRIGGER on table public.search_chunks_legal_unit to authenticated;

grant TRUNCATE on table public.search_chunks_legal_unit to authenticated;

grant UPDATE on table public.search_chunks_legal_unit to authenticated;

grant DELETE on table public.search_chunks_legal_unit to service_role;

grant INSERT on table public.search_chunks_legal_unit to service_role;

grant MAINTAIN on table public.search_chunks_legal_unit to service_role;

grant REFERENCES on table public.search_chunks_legal_unit to service_role;

grant SELECT on table public.search_chunks_legal_unit to service_role;

grant TRIGGER on table public.search_chunks_legal_unit to service_role;

grant TRUNCATE on table public.search_chunks_legal_unit to service_role;

grant UPDATE on table public.search_chunks_legal_unit to service_role;

grant DELETE on table public.search_chunks_legal_unit_embeddings to anon;

grant INSERT on table public.search_chunks_legal_unit_embeddings to anon;

grant MAINTAIN on table public.search_chunks_legal_unit_embeddings to anon;

grant REFERENCES on table public.search_chunks_legal_unit_embeddings to anon;

grant SELECT on table public.search_chunks_legal_unit_embeddings to anon;

grant TRIGGER on table public.search_chunks_legal_unit_embeddings to anon;

grant TRUNCATE on table public.search_chunks_legal_unit_embeddings to anon;

grant UPDATE on table public.search_chunks_legal_unit_embeddings to anon;

grant DELETE on table public.search_chunks_legal_unit_embeddings to authenticated;

grant INSERT on table public.search_chunks_legal_unit_embeddings to authenticated;

grant MAINTAIN on table public.search_chunks_legal_unit_embeddings to authenticated;

grant REFERENCES on table public.search_chunks_legal_unit_embeddings to authenticated;

grant SELECT on table public.search_chunks_legal_unit_embeddings to authenticated;

grant TRIGGER on table public.search_chunks_legal_unit_embeddings to authenticated;

grant TRUNCATE on table public.search_chunks_legal_unit_embeddings to authenticated;

grant UPDATE on table public.search_chunks_legal_unit_embeddings to authenticated;

grant DELETE on table public.search_chunks_legal_unit_embeddings to service_role;

grant INSERT on table public.search_chunks_legal_unit_embeddings to service_role;

grant MAINTAIN on table public.search_chunks_legal_unit_embeddings to service_role;

grant REFERENCES on table public.search_chunks_legal_unit_embeddings to service_role;

grant SELECT on table public.search_chunks_legal_unit_embeddings to service_role;

grant TRIGGER on table public.search_chunks_legal_unit_embeddings to service_role;

grant TRUNCATE on table public.search_chunks_legal_unit_embeddings to service_role;

grant UPDATE on table public.search_chunks_legal_unit_embeddings to service_role;

grant DELETE on table public.team_members to anon;

grant INSERT on table public.team_members to anon;

grant MAINTAIN on table public.team_members to anon;

grant REFERENCES on table public.team_members to anon;

grant SELECT on table public.team_members to anon;

grant TRIGGER on table public.team_members to anon;

grant TRUNCATE on table public.team_members to anon;

grant UPDATE on table public.team_members to anon;

grant DELETE on table public.team_members to authenticated;

grant INSERT on table public.team_members to authenticated;

grant MAINTAIN on table public.team_members to authenticated;

grant REFERENCES on table public.team_members to authenticated;

grant SELECT on table public.team_members to authenticated;

grant TRIGGER on table public.team_members to authenticated;

grant TRUNCATE on table public.team_members to authenticated;

grant UPDATE on table public.team_members to authenticated;

grant DELETE on table public.team_members to service_role;

grant INSERT on table public.team_members to service_role;

grant MAINTAIN on table public.team_members to service_role;

grant REFERENCES on table public.team_members to service_role;

grant SELECT on table public.team_members to service_role;

grant TRIGGER on table public.team_members to service_role;

grant TRUNCATE on table public.team_members to service_role;

grant UPDATE on table public.team_members to service_role;

grant DELETE on table public.teams to anon;

grant INSERT on table public.teams to anon;

grant MAINTAIN on table public.teams to anon;

grant REFERENCES on table public.teams to anon;

grant SELECT on table public.teams to anon;

grant TRIGGER on table public.teams to anon;

grant TRUNCATE on table public.teams to anon;

grant UPDATE on table public.teams to anon;

grant DELETE on table public.teams to authenticated;

grant INSERT on table public.teams to authenticated;

grant MAINTAIN on table public.teams to authenticated;

grant REFERENCES on table public.teams to authenticated;

grant SELECT on table public.teams to authenticated;

grant TRIGGER on table public.teams to authenticated;

grant TRUNCATE on table public.teams to authenticated;

grant UPDATE on table public.teams to authenticated;

grant DELETE on table public.teams to service_role;

grant INSERT on table public.teams to service_role;

grant MAINTAIN on table public.teams to service_role;

grant REFERENCES on table public.teams to service_role;

grant SELECT on table public.teams to service_role;

grant TRIGGER on table public.teams to service_role;

grant TRUNCATE on table public.teams to service_role;

grant UPDATE on table public.teams to service_role;

grant DELETE on table public.telegram_uploads to anon;

grant INSERT on table public.telegram_uploads to anon;

grant MAINTAIN on table public.telegram_uploads to anon;

grant REFERENCES on table public.telegram_uploads to anon;

grant SELECT on table public.telegram_uploads to anon;

grant TRIGGER on table public.telegram_uploads to anon;

grant TRUNCATE on table public.telegram_uploads to anon;

grant UPDATE on table public.telegram_uploads to anon;

grant DELETE on table public.telegram_uploads to authenticated;

grant INSERT on table public.telegram_uploads to authenticated;

grant MAINTAIN on table public.telegram_uploads to authenticated;

grant REFERENCES on table public.telegram_uploads to authenticated;

grant SELECT on table public.telegram_uploads to authenticated;

grant TRIGGER on table public.telegram_uploads to authenticated;

grant TRUNCATE on table public.telegram_uploads to authenticated;

grant UPDATE on table public.telegram_uploads to authenticated;

grant DELETE on table public.telegram_uploads to service_role;

grant INSERT on table public.telegram_uploads to service_role;

grant MAINTAIN on table public.telegram_uploads to service_role;

grant REFERENCES on table public.telegram_uploads to service_role;

grant SELECT on table public.telegram_uploads to service_role;

grant TRIGGER on table public.telegram_uploads to service_role;

grant TRUNCATE on table public.telegram_uploads to service_role;

grant UPDATE on table public.telegram_uploads to service_role;

grant DELETE on table public.telegram_verification_codes to anon;

grant INSERT on table public.telegram_verification_codes to anon;

grant MAINTAIN on table public.telegram_verification_codes to anon;

grant REFERENCES on table public.telegram_verification_codes to anon;

grant SELECT on table public.telegram_verification_codes to anon;

grant TRIGGER on table public.telegram_verification_codes to anon;

grant TRUNCATE on table public.telegram_verification_codes to anon;

grant UPDATE on table public.telegram_verification_codes to anon;

grant DELETE on table public.telegram_verification_codes to authenticated;

grant INSERT on table public.telegram_verification_codes to authenticated;

grant MAINTAIN on table public.telegram_verification_codes to authenticated;

grant REFERENCES on table public.telegram_verification_codes to authenticated;

grant SELECT on table public.telegram_verification_codes to authenticated;

grant TRIGGER on table public.telegram_verification_codes to authenticated;

grant TRUNCATE on table public.telegram_verification_codes to authenticated;

grant UPDATE on table public.telegram_verification_codes to authenticated;

grant DELETE on table public.telegram_verification_codes to service_role;

grant INSERT on table public.telegram_verification_codes to service_role;

grant MAINTAIN on table public.telegram_verification_codes to service_role;

grant REFERENCES on table public.telegram_verification_codes to service_role;

grant SELECT on table public.telegram_verification_codes to service_role;

grant TRIGGER on table public.telegram_verification_codes to service_role;

grant TRUNCATE on table public.telegram_verification_codes to service_role;

grant UPDATE on table public.telegram_verification_codes to service_role;

grant DELETE on table public.topics to anon;

grant INSERT on table public.topics to anon;

grant MAINTAIN on table public.topics to anon;

grant REFERENCES on table public.topics to anon;

grant SELECT on table public.topics to anon;

grant TRIGGER on table public.topics to anon;

grant TRUNCATE on table public.topics to anon;

grant UPDATE on table public.topics to anon;

grant DELETE on table public.topics to authenticated;

grant INSERT on table public.topics to authenticated;

grant MAINTAIN on table public.topics to authenticated;

grant REFERENCES on table public.topics to authenticated;

grant SELECT on table public.topics to authenticated;

grant TRIGGER on table public.topics to authenticated;

grant TRUNCATE on table public.topics to authenticated;

grant UPDATE on table public.topics to authenticated;

grant DELETE on table public.topics to service_role;

grant INSERT on table public.topics to service_role;

grant MAINTAIN on table public.topics to service_role;

grant REFERENCES on table public.topics to service_role;

grant SELECT on table public.topics to service_role;

grant TRIGGER on table public.topics to service_role;

grant TRUNCATE on table public.topics to service_role;

grant UPDATE on table public.topics to service_role;

grant DELETE on table public.user_feedback to anon;

grant INSERT on table public.user_feedback to anon;

grant MAINTAIN on table public.user_feedback to anon;

grant REFERENCES on table public.user_feedback to anon;

grant SELECT on table public.user_feedback to anon;

grant TRIGGER on table public.user_feedback to anon;

grant TRUNCATE on table public.user_feedback to anon;

grant UPDATE on table public.user_feedback to anon;

grant DELETE on table public.user_feedback to authenticated;

grant INSERT on table public.user_feedback to authenticated;

grant MAINTAIN on table public.user_feedback to authenticated;

grant REFERENCES on table public.user_feedback to authenticated;

grant SELECT on table public.user_feedback to authenticated;

grant TRIGGER on table public.user_feedback to authenticated;

grant TRUNCATE on table public.user_feedback to authenticated;

grant UPDATE on table public.user_feedback to authenticated;

grant DELETE on table public.user_feedback to service_role;

grant INSERT on table public.user_feedback to service_role;

grant MAINTAIN on table public.user_feedback to service_role;

grant REFERENCES on table public.user_feedback to service_role;

grant SELECT on table public.user_feedback to service_role;

grant TRIGGER on table public.user_feedback to service_role;

grant TRUNCATE on table public.user_feedback to service_role;

grant UPDATE on table public.user_feedback to service_role;

grant DELETE on table public.user_notes to anon;

grant INSERT on table public.user_notes to anon;

grant MAINTAIN on table public.user_notes to anon;

grant REFERENCES on table public.user_notes to anon;

grant SELECT on table public.user_notes to anon;

grant TRIGGER on table public.user_notes to anon;

grant TRUNCATE on table public.user_notes to anon;

grant UPDATE on table public.user_notes to anon;

grant DELETE on table public.user_notes to authenticated;

grant INSERT on table public.user_notes to authenticated;

grant MAINTAIN on table public.user_notes to authenticated;

grant REFERENCES on table public.user_notes to authenticated;

grant SELECT on table public.user_notes to authenticated;

grant TRIGGER on table public.user_notes to authenticated;

grant TRUNCATE on table public.user_notes to authenticated;

grant UPDATE on table public.user_notes to authenticated;

grant DELETE on table public.user_notes to service_role;

grant INSERT on table public.user_notes to service_role;

grant MAINTAIN on table public.user_notes to service_role;

grant REFERENCES on table public.user_notes to service_role;

grant SELECT on table public.user_notes to service_role;

grant TRIGGER on table public.user_notes to service_role;

grant TRUNCATE on table public.user_notes to service_role;

grant UPDATE on table public.user_notes to service_role;

grant DELETE on table public.user_roles to anon;

grant INSERT on table public.user_roles to anon;

grant MAINTAIN on table public.user_roles to anon;

grant REFERENCES on table public.user_roles to anon;

grant SELECT on table public.user_roles to anon;

grant TRIGGER on table public.user_roles to anon;

grant TRUNCATE on table public.user_roles to anon;

grant UPDATE on table public.user_roles to anon;

grant DELETE on table public.user_roles to authenticated;

grant INSERT on table public.user_roles to authenticated;

grant MAINTAIN on table public.user_roles to authenticated;

grant REFERENCES on table public.user_roles to authenticated;

grant SELECT on table public.user_roles to authenticated;

grant TRIGGER on table public.user_roles to authenticated;

grant TRUNCATE on table public.user_roles to authenticated;

grant UPDATE on table public.user_roles to authenticated;

grant DELETE on table public.user_roles to service_role;

grant INSERT on table public.user_roles to service_role;

grant MAINTAIN on table public.user_roles to service_role;

grant REFERENCES on table public.user_roles to service_role;

grant SELECT on table public.user_roles to service_role;

grant TRIGGER on table public.user_roles to service_role;

grant TRUNCATE on table public.user_roles to service_role;

grant UPDATE on table public.user_roles to service_role;

grant DELETE on table public.version_authorities to anon;

grant INSERT on table public.version_authorities to anon;

grant MAINTAIN on table public.version_authorities to anon;

grant REFERENCES on table public.version_authorities to anon;

grant SELECT on table public.version_authorities to anon;

grant TRIGGER on table public.version_authorities to anon;

grant TRUNCATE on table public.version_authorities to anon;

grant UPDATE on table public.version_authorities to anon;

grant DELETE on table public.version_authorities to authenticated;

grant INSERT on table public.version_authorities to authenticated;

grant MAINTAIN on table public.version_authorities to authenticated;

grant REFERENCES on table public.version_authorities to authenticated;

grant SELECT on table public.version_authorities to authenticated;

grant TRIGGER on table public.version_authorities to authenticated;

grant TRUNCATE on table public.version_authorities to authenticated;

grant UPDATE on table public.version_authorities to authenticated;

grant DELETE on table public.version_authorities to service_role;

grant INSERT on table public.version_authorities to service_role;

grant MAINTAIN on table public.version_authorities to service_role;

grant REFERENCES on table public.version_authorities to service_role;

grant SELECT on table public.version_authorities to service_role;

grant TRIGGER on table public.version_authorities to service_role;

grant TRUNCATE on table public.version_authorities to service_role;

grant UPDATE on table public.version_authorities to service_role;
grant UPDATE (is_latest) on table app.legal_decisions to service_role;

grant UPDATE (supersedes_decision_id) on table app.legal_decisions to service_role;
grant EXECUTE on function app.can_manage_case(p_case_id uuid) to public;

grant EXECUTE on function app.can_manage_case(p_case_id uuid) to authenticated;

grant EXECUTE on function app.can_manage_case(p_case_id uuid) to service_role;

grant EXECUTE on function app.can_read_case(p_case_id uuid) to public;

grant EXECUTE on function app.can_read_case(p_case_id uuid) to authenticated;

grant EXECUTE on function app.can_read_case(p_case_id uuid) to service_role;

grant EXECUTE on function app.check_case_upload_access(_case_id uuid) to public;

grant EXECUTE on function app.get_my_role() to public;

grant EXECUTE on function app.get_my_role() to authenticated;

grant EXECUTE on function app.get_my_role() to service_role;

grant EXECUTE on function app.is_case_lawyer(p_case_id uuid) to public;

grant EXECUTE on function app.is_case_lawyer(p_case_id uuid) to authenticated;

grant EXECUTE on function app.is_case_lawyer(p_case_id uuid) to service_role;

grant EXECUTE on function app.is_case_member(p_case_id uuid) to public;

grant EXECUTE on function app.is_case_member(p_case_id uuid) to authenticated;

grant EXECUTE on function app.is_case_member(p_case_id uuid) to service_role;

grant EXECUTE on function app.prevent_legal_decision_data_update() to public;

grant EXECUTE on function app.save_legal_decision_atomic(p_case_id uuid, p_version_hash text, p_decision_status text, p_decision_data jsonb, p_source_pipeline_version text, p_created_by uuid) to public;

grant EXECUTE on function app.save_legal_decision_atomic(p_case_id uuid, p_version_hash text, p_decision_status text, p_decision_data jsonb, p_source_pipeline_version text, p_created_by uuid) to service_role;

grant EXECUTE on function public.admin_set_user_role(p_user_id uuid, p_role app.app_role) to public;

grant EXECUTE on function public.admin_set_user_role(p_user_id uuid, p_role app.app_role) to anon;

grant EXECUTE on function public.admin_set_user_role(p_user_id uuid, p_role app.app_role) to authenticated;

grant EXECUTE on function public.admin_set_user_role(p_user_id uuid, p_role app.app_role) to service_role;

grant EXECUTE on function public.ai_analysis_view_insert() to public;

grant EXECUTE on function public.ai_analysis_view_insert() to anon;

grant EXECUTE on function public.ai_analysis_view_insert() to authenticated;

grant EXECUTE on function public.ai_analysis_view_insert() to service_role;

grant EXECUTE on function public.case_files_compat_delete() to public;

grant EXECUTE on function public.case_files_compat_delete() to anon;

grant EXECUTE on function public.case_files_compat_delete() to authenticated;

grant EXECUTE on function public.case_files_compat_delete() to service_role;

grant EXECUTE on function public.case_files_compat_insert() to public;

grant EXECUTE on function public.case_files_compat_insert() to anon;

grant EXECUTE on function public.case_files_compat_insert() to authenticated;

grant EXECUTE on function public.case_files_compat_insert() to service_role;

grant EXECUTE on function public.case_files_object_case_id(object_name text) to public;

grant EXECUTE on function public.case_files_object_case_id(object_name text) to anon;

grant EXECUTE on function public.case_files_object_case_id(object_name text) to authenticated;

grant EXECUTE on function public.case_files_object_case_id(object_name text) to service_role;

grant EXECUTE on function public.case_members_compat_delete() to public;

grant EXECUTE on function public.case_members_compat_delete() to anon;

grant EXECUTE on function public.case_members_compat_delete() to authenticated;

grant EXECUTE on function public.case_members_compat_delete() to service_role;

grant EXECUTE on function public.case_members_compat_insert() to public;

grant EXECUTE on function public.case_members_compat_insert() to anon;

grant EXECUTE on function public.case_members_compat_insert() to authenticated;

grant EXECUTE on function public.case_members_compat_insert() to service_role;

grant EXECUTE on function public.cases_compat_delete() to public;

grant EXECUTE on function public.cases_compat_delete() to anon;

grant EXECUTE on function public.cases_compat_delete() to authenticated;

grant EXECUTE on function public.cases_compat_delete() to service_role;

grant EXECUTE on function public.cases_compat_insert() to public;

grant EXECUTE on function public.cases_compat_insert() to anon;

grant EXECUTE on function public.cases_compat_insert() to authenticated;

grant EXECUTE on function public.cases_compat_insert() to service_role;

grant EXECUTE on function public.cases_compat_update() to public;

grant EXECUTE on function public.cases_compat_update() to anon;

grant EXECUTE on function public.cases_compat_update() to authenticated;

grant EXECUTE on function public.cases_compat_update() to service_role;

grant EXECUTE on function public.generated_documents_compat_delete() to public;

grant EXECUTE on function public.generated_documents_compat_delete() to anon;

grant EXECUTE on function public.generated_documents_compat_delete() to authenticated;

grant EXECUTE on function public.generated_documents_compat_delete() to service_role;

grant EXECUTE on function public.generated_documents_compat_insert() to public;

grant EXECUTE on function public.generated_documents_compat_insert() to anon;

grant EXECUTE on function public.generated_documents_compat_insert() to authenticated;

grant EXECUTE on function public.generated_documents_compat_insert() to service_role;

grant EXECUTE on function public.generated_documents_compat_update() to public;

grant EXECUTE on function public.generated_documents_compat_update() to anon;

grant EXECUTE on function public.generated_documents_compat_update() to authenticated;

grant EXECUTE on function public.generated_documents_compat_update() to service_role;

grant EXECUTE on function public.generated_documents_view_insert() to public;

grant EXECUTE on function public.generated_documents_view_insert() to anon;

grant EXECUTE on function public.generated_documents_view_insert() to authenticated;

grant EXECUTE on function public.generated_documents_view_insert() to service_role;

grant EXECUTE on function public.get_ai_metrics_summary(p_days integer) to authenticated;

grant EXECUTE on function public.get_ai_metrics_summary(p_days integer) to service_role;

grant EXECUTE on function public.get_embedding_metrics(p_model text) to public;

grant EXECUTE on function public.get_embedding_metrics(p_model text) to anon;

grant EXECUTE on function public.get_embedding_metrics(p_model text) to authenticated;

grant EXECUTE on function public.get_embedding_metrics(p_model text) to service_role;

grant EXECUTE on function public.get_my_role() to public;

grant EXECUTE on function public.get_my_role() to anon;

grant EXECUTE on function public.get_my_role() to authenticated;

grant EXECUTE on function public.get_my_role() to service_role;

grant EXECUTE on function public.handle_new_user() to public;

grant EXECUTE on function public.handle_new_user() to anon;

grant EXECUTE on function public.handle_new_user() to authenticated;

grant EXECUTE on function public.handle_new_user() to service_role;

grant EXECUTE on function public.lookup_by_article(p_document_ref text, p_article_number text, p_limit integer) to public;

grant EXECUTE on function public.lookup_by_article(p_document_ref text, p_article_number text, p_limit integer) to anon;

grant EXECUTE on function public.lookup_by_article(p_document_ref text, p_article_number text, p_limit integer) to authenticated;

grant EXECUTE on function public.lookup_by_article(p_document_ref text, p_article_number text, p_limit integer) to service_role;

grant EXECUTE on function public.lookup_by_citation(p_citation text, p_limit integer) to public;

grant EXECUTE on function public.lookup_by_citation(p_citation text, p_limit integer) to anon;

grant EXECUTE on function public.lookup_by_citation(p_citation text, p_limit integer) to authenticated;

grant EXECUTE on function public.lookup_by_citation(p_citation text, p_limit integer) to service_role;

grant EXECUTE on function public.lookup_table_rows(p_document_ref text, p_table_ref text, p_limit integer) to public;

grant EXECUTE on function public.lookup_table_rows(p_document_ref text, p_table_ref text, p_limit integer) to anon;

grant EXECUTE on function public.lookup_table_rows(p_document_ref text, p_table_ref text, p_limit integer) to authenticated;

grant EXECUTE on function public.lookup_table_rows(p_document_ref text, p_table_ref text, p_limit integer) to service_role;

grant EXECUTE on function public.profiles_compat_update() to public;

grant EXECUTE on function public.profiles_compat_update() to anon;

grant EXECUTE on function public.profiles_compat_update() to authenticated;

grant EXECUTE on function public.profiles_compat_update() to service_role;

grant EXECUTE on function public.profiles_view_delete() to public;

grant EXECUTE on function public.profiles_view_delete() to anon;

grant EXECUTE on function public.profiles_view_delete() to authenticated;

grant EXECUTE on function public.profiles_view_delete() to service_role;

grant EXECUTE on function public.profiles_view_insert() to public;

grant EXECUTE on function public.profiles_view_insert() to anon;

grant EXECUTE on function public.profiles_view_insert() to authenticated;

grant EXECUTE on function public.profiles_view_insert() to service_role;

grant EXECUTE on function public.profiles_view_update() to public;

grant EXECUTE on function public.profiles_view_update() to anon;

grant EXECUTE on function public.profiles_view_update() to authenticated;

grant EXECUTE on function public.profiles_view_update() to service_role;

grant EXECUTE on function public.record_ai_analysis_run(p_case_id uuid, p_result jsonb, p_query text, p_model text) to service_role;

grant EXECUTE on function public.record_ai_metric(p_fn_name text, p_model text, p_input_tokens integer, p_output_tokens integer, p_cost_usd numeric, p_latency_ms integer, p_status text, p_error_message text, p_case_id uuid, p_user_id uuid) to public;

grant EXECUTE on function public.record_ai_metric(p_fn_name text, p_model text, p_input_tokens integer, p_output_tokens integer, p_cost_usd numeric, p_latency_ms integer, p_status text, p_error_message text, p_case_id uuid, p_user_id uuid) to anon;

grant EXECUTE on function public.record_ai_metric(p_fn_name text, p_model text, p_input_tokens integer, p_output_tokens integer, p_cost_usd numeric, p_latency_ms integer, p_status text, p_error_message text, p_case_id uuid, p_user_id uuid) to authenticated;

grant EXECUTE on function public.record_ai_metric(p_fn_name text, p_model text, p_input_tokens integer, p_output_tokens integer, p_cost_usd numeric, p_latency_ms integer, p_status text, p_error_message text, p_case_id uuid, p_user_id uuid) to service_role;

grant EXECUTE on function public.search_legal_corpus(p_query_text text, p_query_embedding vector, p_content_domain content_domain, p_norm_status normalized_status, p_effective_at date, p_language_code text, p_limit integer, p_offset integer) to public;

grant EXECUTE on function public.search_legal_corpus(p_query_text text, p_query_embedding vector, p_content_domain content_domain, p_norm_status normalized_status, p_effective_at date, p_language_code text, p_limit integer, p_offset integer) to anon;

grant EXECUTE on function public.search_legal_corpus(p_query_text text, p_query_embedding vector, p_content_domain content_domain, p_norm_status normalized_status, p_effective_at date, p_language_code text, p_limit integer, p_offset integer) to authenticated;

grant EXECUTE on function public.search_legal_corpus(p_query_text text, p_query_embedding vector, p_content_domain content_domain, p_norm_status normalized_status, p_effective_at date, p_language_code text, p_limit integer, p_offset integer) to service_role;

grant EXECUTE on function public.search_legal_corpus_dual(p_query_text text, p_metric_embedding vector, p_qwen_embedding vector, p_content_domain content_domain, p_norm_status normalized_status, p_limit integer, p_metric_limit integer, p_qwen_limit integer, p_bm25_limit integer, p_effective_at date) to public;

grant EXECUTE on function public.search_legal_corpus_dual(p_query_text text, p_metric_embedding vector, p_qwen_embedding vector, p_content_domain content_domain, p_norm_status normalized_status, p_limit integer, p_metric_limit integer, p_qwen_limit integer, p_bm25_limit integer, p_effective_at date) to anon;

grant EXECUTE on function public.search_legal_corpus_dual(p_query_text text, p_metric_embedding vector, p_qwen_embedding vector, p_content_domain content_domain, p_norm_status normalized_status, p_limit integer, p_metric_limit integer, p_qwen_limit integer, p_bm25_limit integer, p_effective_at date) to authenticated;

grant EXECUTE on function public.search_legal_corpus_dual(p_query_text text, p_metric_embedding vector, p_qwen_embedding vector, p_content_domain content_domain, p_norm_status normalized_status, p_limit integer, p_metric_limit integer, p_qwen_limit integer, p_bm25_limit integer, p_effective_at date) to service_role;

grant EXECUTE on function public.search_legal_unit_chunks_preview(p_query_text text, p_limit integer, p_content_domain content_domain, p_language text, p_effective_at date) to public;

grant EXECUTE on function public.search_legal_unit_chunks_preview(p_query_text text, p_limit integer, p_content_domain content_domain, p_language text, p_effective_at date) to anon;

grant EXECUTE on function public.search_legal_unit_chunks_preview(p_query_text text, p_limit integer, p_content_domain content_domain, p_language text, p_effective_at date) to authenticated;

grant EXECUTE on function public.search_legal_unit_chunks_preview(p_query_text text, p_limit integer, p_content_domain content_domain, p_language text, p_effective_at date) to service_role;

grant EXECUTE on function public.set_updated_at() to public;

grant EXECUTE on function public.set_updated_at() to anon;

grant EXECUTE on function public.set_updated_at() to authenticated;

grant EXECUTE on function public.set_updated_at() to service_role;

grant EXECUTE on function public.user_roles_guard() to public;

grant EXECUTE on function public.user_roles_guard() to anon;

grant EXECUTE on function public.user_roles_guard() to authenticated;

grant EXECUTE on function public.user_roles_guard() to service_role;

grant EXECUTE on function public.user_roles_view_delete() to public;

grant EXECUTE on function public.user_roles_view_delete() to anon;

grant EXECUTE on function public.user_roles_view_delete() to authenticated;

grant EXECUTE on function public.user_roles_view_delete() to service_role;

grant EXECUTE on function public.user_roles_view_insert() to public;

grant EXECUTE on function public.user_roles_view_insert() to anon;

grant EXECUTE on function public.user_roles_view_insert() to authenticated;

grant EXECUTE on function public.user_roles_view_insert() to service_role;

grant EXECUTE on function public.user_roles_view_update() to public;

grant EXECUTE on function public.user_roles_view_update() to anon;

grant EXECUTE on function public.user_roles_view_update() to authenticated;

grant EXECUTE on function public.user_roles_view_update() to service_role;
grant USAGE on type app.app_role to public;

grant USAGE on type app.multi_agent_run_status to public;

grant USAGE on type public.content_domain to public;

grant USAGE on type public.kb_category to public;

grant USAGE on type public.normalized_status to public;

set check_function_bodies = true;
