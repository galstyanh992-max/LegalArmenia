# FABLE MIGRATION TASK LEDGER

Strategy: `B_BASELINE_PLUS_FORWARD_MIGRATIONS`. Updated 2026-07-12.

| ID | Задача | Вход | Разрешённые пути | Статус | Verification | Blocker | Handoff |
| -- | ------ | ---- | ---------------- | ------ | ------------ | ------- | ------- |
| T1 | Restart branch from merged main | PR #7 merged | git | `FIXED_VERIFIED` | HEAD=d9cdc97; db_passwords.cjs absent | — | — |
| T2 | Legacy archive (186 E1 files) | reports 17/18 | `supabase/migrations_legacy/` | `FIXED_VERIFIED` | 186 moved via git mv, names/timestamps preserved | — | — |
| T3 | Legacy manifest | archive | `migrations_legacy/LEGACY_MIGRATION_MANIFEST.md` | `FIXED_VERIFIED` | 186-row table, disposition+reason+replacement | — | — |
| T4 | App authz core reference (exact DDL) | report 16 + read-only capture | `supabase/baseline/00_app_authorization_core.reference.sql` | `FIXED_VERIFIED` | 6 fns + handle_new_user bodies captured exactly | — | — |
| T5 | Baseline generation step | strategy 19 | `supabase/baseline/GENERATE_BASELINE.md` | `FIXED_VERIFIED` | exact `supabase db dump` command + redaction/order steps | — | operator runs db dump |
| T6 | Forward migration D7 (audio unique) | report 18 | `migrations/20260712120000_*.sql` | `FIXED_VERIFIED` | dedup-guarded unique index; syntax balanced; rollback noted | — | — |
| T7 | Forward migration D9 (telegram bucket) | report 16 | `migrations/20260712120100_*.sql` | `FIXED_VERIFIED` | private bucket + owner policies; gated on product decision | product decision | — |
| T8 | Forward D8 (storage hardening) | draft policy | `storage-policies/` | `DEFERRED` | draft exists; not emitted as migration to avoid duplicate-policy conflict | disposable-env behavioral test | — |
| T9 | Baseline manifest | all above | `supabase/baseline/BASELINE_MANIFEST.md` | `FIXED_VERIFIED` | 14 required sections present | — | — |
| T10 | Static verification | new files | — | `FIXED_VERIFIED` | SQL balance OK; secret scan clean; active/legacy split correct | — | — |
| T11 | Authoritative full schema baseline | production | `supabase/baseline/00_schema_baseline.sql` | `BLOCKED` | — | needs operator `supabase db dump` (prod DB connection string — agent must not handle) | operator |
| T12 | Ledger repair mapping | reports 17/19 | remote ledger | `DEFERRED` | plan documented (report 19 §rollout) | operator-gated; `migration repair --status applied` | operator |
| T13 | Prompt 17 clean replay | T11 output | disposable branch | `BLOCKED` | — | needs T11 complete + a paid disposable branch (cost confirmation) | user/operator |
