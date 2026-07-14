# Baseline Manifest

## 1. Baseline version

`20260712120002_versioned_baseline_20260712.sql` — `VERSIONED_BASELINE_PLUS_FORWARD_MIGRATIONS`.

Fresh environments only. Applying this baseline to the existing production project `avmgtsonawtzebvazgcr` is prohibited.

## 2. Source audit reports

- `AUDIT_REPORTS/16_PRODUCTION_SCHEMA_BASELINE.md`
- `AUDIT_REPORTS/17_LOCAL_MIGRATION_FORENSICS.md`
- `AUDIT_REPORTS/18_SCHEMA_DIFF_CLASSIFICATION.md`
- `AUDIT_REPORTS/19_MIGRATION_REPAIR_STRATEGY.md`
- Source commit: `cfeafb7ec20c3057446405db9f62ba64206a5918` (PR #7 provenance; now integrated into `main`).
- Read-only production catalog capture: 2026-07-12.

## 3. Included schemas

- `app`: 9 tables, enums, constraints, indexes, functions, triggers, grants, RLS, policies.
- `public`: 55 application tables, 7 compatibility views, enums, constraints, indexes, functions, triggers, grants, RLS, policies.
- `internal`: 4 application tables plus related functions, constraints, indexes, grants, RLS, policies.
- `storage.objects`: application policy definitions only.
- `auth.users`: application bootstrap trigger only.

## 4. Excluded schemas

- Supabase-managed `auth`, `storage`, `realtime`, `supabase_migrations`, `extensions`, `graphql`, `graphql_public`, and platform internals.
- Extension-owned objects created by `pgcrypto`, `uuid-ossp`, `pg_trgm`, and `vector`.

## 5. Included application objects

Source classifications are embedded by baseline section:

- `PRODUCTION_RUNTIME_REQUIRED`: schemas, tables, constraints, RLS state, application functions and triggers.
- `APPLICATION_CONTRACT_REQUIRED`: extensions, indexes, storage bucket definitions, API-visible relations/functions.
- `SECURITY_BASELINE_REQUIRED`: RLS policies, grants, Auth bootstrap and Storage policies.
- `COMPATIBILITY_REQUIRED`: `public.cases`, `profiles`, `user_roles`, `case_files`, `ai_analysis`, `case_members`, `generated_documents` views.

The baseline contains no production customer rows, Auth users, Storage objects, credentials, or migration-ledger writes.

## 6. Excluded managed objects

Managed table definitions, platform roles, platform migrations, dashboard settings, Auth identities, Storage object rows, realtime state, Vault values and credentials are excluded.

## 7. Compatibility objects

Seven `security_invoker` public views and their application triggers are included. `public.profile_compat_settings` and the production `public.handle_new_user()` contract are included.

## 8. Forward migrations

1. `20260712120004_harden_case_document_authorization.sql`
2. `20260712120006_harden_profile_role_authorization.sql`
3. `20260712120008_enforce_case_files_bucket_constraints.sql`
4. `20260712120010_enforce_audio_transcription_idempotency.sql`
5. `20260713221836_restore_cases_insert_trigger.sql`
6. `20260713222445_isolate_legacy_media_reads.sql`
7. `20260713222818_align_audio_transcription_read_access.sql`

Telegram uploads bucket creation is `DEFERRED`: report 18 classifies feature intent as unknown. No active migration is created without product confirmation.

## 9. Backfill requirements

The active replay path contains no automatic data backfill. The guarded script `backfills/20260712_audio_transcriptions_file_id_deduplicate.sql` is limited to synthetic disposable fixtures, is transaction-safe on partial failure, supports pre-commit `ROLLBACK`, and includes its verification query. Production use requires a new approval and compensating-data plan.

Reference prompt/template rows were not copied from production because production-row reads are outside this implementation authorization. Seed parity remains a known gap.

## 10. Production application prohibition

Do not run `supabase db push`, `supabase migration up`, `supabase db reset --linked`, or the baseline SQL against production. Remote ledger repair, timestamp substitution and applied-version changes are not authorized.

## 11. Replay procedure

Command source: official Supabase CLI `db reset` behavior and `scripts/verify-migration-baseline.ps1`.

```powershell
powershell -NoProfile -File scripts/verify-migration-baseline.ps1
supabase start
supabase db reset --local
```

The target must be the local disposable stack or another independently proven empty non-production project. Never add `--linked` or a production `--db-url`.

## 12. Verification procedure

1. Static gate: `powershell -NoProfile -File scripts/verify-migration-baseline.ps1`.
2. Clean replay: `supabase db reset --local` from a fresh local stack.
3. Confirm 5 active ledger entries and zero legacy archive entries.
4. Compare schemas, tables/views, columns, constraints, indexes, functions, triggers, grants, RLS and policies to this manifest.
5. Run Auth, authorization and Storage behavioral matrices with synthetic identities only.
6. Generate TypeScript types from the verified disposable environment.

## 13. Rollback limitations

The baseline has no safe down migration and must be discarded with the disposable environment. Forward DDL compensation is documented in each migration or report; no rollback is authorized on production. The dedup script can be rolled back only before its transaction is committed.

## 14. Known unknowns

- Deterministic `ai_prompts` and `document_templates` reference-row parity is not captured.
- `telegram-uploads` feature/bucket intent is unresolved.
- `DEEP-001` is CLOSED; rotation, dependent-secret updates, previous-credential invalidation and approved production smoke tests passed without recording secret values.
- PR #7 is merged; source commit `cfeafb7` remains recorded for provenance.
- Disposable clean replay and behavioral verification are complete; production smoke verification passed after `DEEP-001` closure.

Main integration retained `00_app_authorization_core.reference.sql` and `GENERATE_BASELINE.md` as historical/source-review artifacts. They are not additional active replay inputs and do not change the eight-file active migration path.
