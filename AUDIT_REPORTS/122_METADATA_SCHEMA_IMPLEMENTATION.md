# 122 — METADATA SCHEMA IMPLEMENTATION

## Migration
`supabase/migrations/20260716000100_additive_legal_metadata_schema.sql`

## Tables Created (Additive)

| Table | Purpose |
|-------|---------|
| legal_source_files | Source PDF inventory with SHA-256, classification |
| legal_document_metadata | Recovered metadata per source file |
| legal_document_versions | Version lineage reconstruction |
| legal_provisions | Provision metadata (article/part/point/chapter) per chunk |
| legal_source_page_mappings | Chunk-to-PDF page mapping |
| legal_metadata_reconstruction_runs | Backfill run audit trail |
| legal_metadata_failures | Failure ledger |
| legal_metadata_review_actions | Append-only review log |

## Properties
- Additive: no existing tables modified
- Reversible: rollback migration drops all new tables
- RLS enabled on all tables
- Grants to service_role only
- Idempotent upsert via unique constraints
- Conflict quarantine via review_status field
- Tenant boundary preserved

## Rollback
`supabase/rollback/20260716000100_additive_legal_metadata_schema_rollback.sql`
Drops all 8 additive tables. No existing data affected.
