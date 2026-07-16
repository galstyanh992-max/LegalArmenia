-- Rollback for 20260716000100_additive_legal_metadata_schema
-- Safe: drops only additive tables created by the forward migration.

drop table if exists public.legal_metadata_review_actions;
drop table if exists public.legal_metadata_failures;
drop table if exists public.legal_metadata_reconstruction_runs;
drop table if exists public.legal_source_page_mappings;
drop table if exists public.legal_provisions;
drop table if exists public.legal_document_versions;
drop table if exists public.legal_document_metadata;
drop table if exists public.legal_source_files;
