-- =============================================================================
-- Prompt 19.7 Phase 11: Additive Legal Metadata Schema
-- Additive, reversible, no changes to existing tables or migrations.
-- =============================================================================

-- 1. legal_source_files — inventory of source PDFs and other source files
create table if not exists public.legal_source_files (
  source_file_id text not null,
  absolute_path text not null,
  relative_path text not null,
  filename text not null,
  extension text not null,
  size_bytes bigint not null,
  sha256 text not null,
  modified_at timestamptz,
  language_guess text[] default '{}',
  source_family text default 'arlis_general',
  pdf_type text,
  page_count integer,
  text_layer boolean,
  bookmarks boolean,
  toc_detected boolean,
  articles_detected boolean,
  tables_detected boolean,
  ocr_required boolean,
  readable boolean default true,
  encrypted boolean default false,
  corrupted boolean default false,
  empty boolean default false,
  text_available boolean default false,
  metadata_available boolean default false,
  inventory_run_id text,
  created_at timestamptz default now() not null,
  primary key (source_file_id)
);
alter table public.legal_source_files enable row level security;
create index if not exists idx_legal_source_files_sha256 on public.legal_source_files(sha256);
create index if not exists idx_legal_source_files_family on public.legal_source_files(source_family);
create index if not exists idx_legal_source_files_ext on public.legal_source_files(extension);

-- 2. legal_document_metadata — recovered metadata per source file
create table if not exists public.legal_document_metadata (
  metadata_id uuid default gen_random_uuid() not null,
  source_file_id text not null,
  document_id uuid,
  document_version_id uuid,
  canonical_title text,
  document_number text,
  document_type text,
  authority text,
  authority_type text,
  jurisdiction text,
  adoption_date date,
  publication_date date,
  effective_from date,
  effective_to date,
  source_url text,
  parser_version text not null,
  confidence text not null default 'low',
  evidence jsonb default '[]'::jsonb not null,
  requires_review boolean default false not null,
  review_status text default 'pending',
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  primary key (metadata_id),
  unique (source_file_id, parser_version)
);
alter table public.legal_document_metadata enable row level security;
create index if not exists idx_legal_doc_meta_source on public.legal_document_metadata(source_file_id);
create index if not exists idx_legal_doc_meta_doc on public.legal_document_metadata(document_id);
create index if not exists idx_legal_doc_meta_confidence on public.legal_document_metadata(confidence);
create index if not exists idx_legal_doc_meta_review on public.legal_document_metadata(review_status);

-- 3. legal_document_versions — version lineage
create table if not exists public.legal_document_versions (
  version_recon_id uuid default gen_random_uuid() not null,
  source_file_id text not null,
  document_id uuid,
  document_version_id uuid,
  document_version_key text,
  version_sequence integer,
  supersedes_version_id uuid,
  is_current boolean,
  effective_from date,
  effective_to date,
  version_confidence text default 'low',
  evidence jsonb default '[]'::jsonb not null,
  parser_version text not null,
  requires_review boolean default false not null,
  review_status text default 'pending',
  created_at timestamptz default now() not null,
  primary key (version_recon_id),
  unique (source_file_id, parser_version)
);
alter table public.legal_document_versions enable row level security;
create index if not exists idx_legal_doc_ver_doc on public.legal_document_versions(document_id);

-- 4. legal_provisions — reconstructed provision metadata per chunk
create table if not exists public.legal_provisions (
  provision_id uuid default gen_random_uuid() not null,
  source_file_id text not null,
  document_id uuid,
  chunk_id uuid,
  page_from_physical integer,
  page_to_physical integer,
  printed_page_from text,
  printed_page_to text,
  article text,
  part text,
  point text,
  subpoint text,
  chapter text,
  section text,
  provision_key text,
  canonical_citation text,
  confidence text not null default 'low',
  parser_version text not null,
  evidence jsonb default '[]'::jsonb not null,
  requires_review boolean default false not null,
  review_status text default 'pending',
  created_at timestamptz default now() not null,
  primary key (provision_id),
  unique (chunk_id, parser_version)
);
alter table public.legal_provisions enable row level security;
create index if not exists idx_legal_prov_chunk on public.legal_provisions(chunk_id);
create index if not exists idx_legal_prov_doc on public.legal_provisions(document_id);
create index if not exists idx_legal_prov_key on public.legal_provisions(provision_key);
create index if not exists idx_legal_prov_article on public.legal_provisions(article);

-- 5. legal_provision_chunks — page mapping per chunk
create table if not exists public.legal_source_page_mappings (
  page_mapping_id uuid default gen_random_uuid() not null,
  chunk_id uuid not null,
  source_file_id text not null,
  page_from_physical integer,
  page_to_physical integer,
  printed_page_from text,
  printed_page_to text,
  match_confidence real not null default 0.0,
  match_method text not null,
  matched_character_ratio real,
  evidence jsonb default '[]'::jsonb not null,
  created_at timestamptz default now() not null,
  primary key (page_mapping_id),
  unique (chunk_id, source_file_id)
);
alter table public.legal_source_page_mappings enable row level security;
create index if not exists idx_legal_page_map_chunk on public.legal_source_page_mappings(chunk_id);
create index if not exists idx_legal_page_map_source on public.legal_source_page_mappings(source_file_id);

-- 6. legal_metadata_reconstruction_runs — audit trail for backfill runs
create table if not exists public.legal_metadata_reconstruction_runs (
  run_id text not null,
  phase text not null,
  started_at timestamptz default now() not null,
  completed_at timestamptz,
  rows_examined integer default 0,
  rows_matched integer default 0,
  high_confidence integer default 0,
  medium_confidence integer default 0,
  low_confidence integer default 0,
  skipped integer default 0,
  conflicts integer default 0,
  failures integer default 0,
  page_mappings integer default 0,
  provision_mappings integer default 0,
  version_mappings integer default 0,
  authority_mappings integer default 0,
  source_url_recoveries integer default 0,
  dry_run boolean default true not null,
  status text default 'running',
  created_at timestamptz default now() not null,
  primary key (run_id)
);
alter table public.legal_metadata_reconstruction_runs enable row level security;

-- 7. legal_metadata_failures — failure ledger
create table if not exists public.legal_metadata_failures (
  failure_id uuid default gen_random_uuid() not null,
  run_id text not null,
  source_file_id text,
  chunk_id uuid,
  failure_type text not null,
  error_message text,
  details jsonb default '{}'::jsonb not null,
  created_at timestamptz default now() not null,
  primary key (failure_id)
);
alter table public.legal_metadata_failures enable row level security;
create index if not exists idx_legal_meta_fail_run on public.legal_metadata_failures(run_id);

-- 8. legal_metadata_review_actions — append-only review log
create table if not exists public.legal_metadata_review_actions (
  action_id uuid default gen_random_uuid() not null,
  table_name text not null,
  record_id text not null,
  action text not null check (action in ('APPROVE','CORRECT','REJECT','DEFER')),
  reviewer text not null,
  original_values jsonb,
  corrected_values jsonb,
  reason text,
  created_at timestamptz default now() not null,
  primary key (action_id)
);
alter table public.legal_metadata_review_actions enable row level security;
create index if not exists idx_legal_review_record on public.legal_metadata_review_actions(record_id);

-- Grants
grant select on public.legal_source_files to service_role;
grant select on public.legal_document_metadata to service_role;
grant select on public.legal_document_versions to service_role;
grant select on public.legal_provisions to service_role;
grant select on public.legal_source_page_mappings to service_role;
grant select on public.legal_metadata_reconstruction_runs to service_role;
grant select on public.legal_metadata_failures to service_role;
grant select on public.legal_metadata_review_actions to service_role;

grant insert, update on public.legal_source_files to service_role;
grant insert, update on public.legal_document_metadata to service_role;
grant insert, update on public.legal_document_versions to service_role;
grant insert, update on public.legal_provisions to service_role;
grant insert, update on public.legal_source_page_mappings to service_role;
grant insert, update on public.legal_metadata_reconstruction_runs to service_role;
grant insert on public.legal_metadata_failures to service_role;
grant insert on public.legal_metadata_review_actions to service_role;

-- =============================================================================
-- Rollback: drop all additive tables (safe, no existing data affected)
-- =============================================================================
