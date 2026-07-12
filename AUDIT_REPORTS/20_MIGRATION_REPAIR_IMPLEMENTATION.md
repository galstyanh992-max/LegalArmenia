# 20 — Migration Repair Implementation

## 1. Metadata

- Date: 2026-07-12
- Strategy: `B_BASELINE_PLUS_FORWARD_MIGRATIONS`
- Phase: `P6 — Migration Baseline Implementation`
- Production writes/migrations/ledger changes: zero
- Decision: `MIGRATION_IMPLEMENTATION_READY_FOR_REPLAY`

## 2. Repository Baseline

- Branch: `main`
- HEAD: `09023b0c3d120e53753924e7181d4da9cc665824`
- PR #7: `OPEN`, not merged; head `cfeafb7ec20c3057446405db9f62ba64206a5918`
- Input reports 16–19: read from PR #7 head because absent from current `main`
- Supabase CLI: `2.102.0` (`2.109.1` available)
- Active migration path before implementation: `supabase/migrations/`
- `supabase/config.toml`: present
- `supabase/seed.sql`: absent
- Initial worktree: dirty with pre-existing staged, unstaged and untracked user changes; none reset, cleaned, restored or stashed
- Implementation paths were not staged

Repository map after implementation:

```text
supabase/
├── migrations/               # active baseline + forward replay path
├── migrations_legacy/        # verbatim historical evidence + manifest
├── baseline/                 # manifest + guarded non-active backfill
├── functions/
└── config.toml

AUDIT_REPORTS/
docs/
scripts/
```

## 3. Fable Task Ledger Summary

Prompt 16 checkpoints `16.0`–`16.V`: `FIXED_VERIFIED`. Prompt 17 precondition: `BLOCKED`. Full detail: `AUDIT_REPORTS/FABLE_MIGRATION_TASK_LEDGER.md`.

## 4. Legacy Archive

- Archive: `supabase/migrations_legacy/`
- SQL files: 237
- Current HEAD migrations verified verbatim: 221/221 hashes match
- PR-only migrations verified verbatim: 11/11 hashes match `cfeafb7`
- Pre-existing worktree-only migrations moved without content edits: 5
- Active replay excludes the archive by directory boundary
- Remote exact, version-drift, bundled, local-only, duplicated, superseded and unknown-origin dispositions are recorded in `LEGACY_MIGRATION_MANIFEST.md`
- Remote ledger was read only; no applied status/version was changed

## 5. Baseline Architecture

Active order:

1. `20260712120002_versioned_baseline_20260712.sql`
2. `20260712120004_harden_case_document_authorization.sql`
3. `20260712120006_harden_profile_role_authorization.sql`
4. `20260712120008_enforce_case_files_bucket_constraints.sql`
5. `20260712120010_enforce_audio_transcription_idempotency.sql`

Baseline source is a read-only production catalog capture. Extension-owned/platform-owned objects are excluded. Application schemas/types/tables are created before functions, constraints, indexes, views, triggers, policies, bucket definitions and explicit grants.

## 6. Included Objects

- Schemas: `app`, `public`, `internal`
- Extensions: `pgcrypto`, `uuid-ossp`, `pg_trgm`, `vector`
- Enums: 5
- Application tables: 68 (`app`: 9, `public`: 55, `internal`: 4)
- Compatibility views: 7, including `security_invoker` options
- Functions: 43
- Constraints: 219
- Non-constraint indexes: 142
- Application triggers: 67, including `auth.users.on_auth_user_created`
- RLS policies: 192, including 9 `storage.objects` policies
- Private buckets: `case-files`, `media-uploads`; no Storage object rows
- Table/column/function/type/schema grants for application roles

Object groups are tagged `PRODUCTION_RUNTIME_REQUIRED`, `APPLICATION_CONTRACT_REQUIRED`, `SECURITY_BASELINE_REQUIRED`, or `COMPATIBILITY_REQUIRED` in the baseline and manifest.

## 7. Excluded Objects

- Production customer data
- Auth users/identities/sessions
- Storage objects
- Credentials, Vault values and secret values
- Supabase-managed schema/table definitions and platform ledger
- Dashboard-only configuration
- Unknown `telegram-uploads` bucket until product intent is confirmed

## 8. Forward Migrations

- Case read/upload authorization and `client_documents` insert policy hardening
- Profile/role mutation hardening and audited admin RPCs
- Storage path isolation plus deterministic case-files MIME/size constraints
- Fail-closed uniqueness for non-null `audio_transcriptions.file_id`

No old timestamp was reused. No remote-applied identifier was modified.

## 9. Backfill Separation

- Active migrations contain no customer-data backfill.
- `supabase/baseline/backfills/20260712_audio_transcriptions_file_id_deduplicate.sql` is outside replay.
- Guard: transaction setting must equal `synthetic_disposable_only`.
- Partial failure: transaction rollback.
- Verification: duplicate-group query must return zero rows.
- Compensation before commit: `ROLLBACK`.
- Production execution: prohibited without a separate approval/data-compensation plan.

## 10. Repair Cycles

| Cycle | Confirmed failure | Minimal fix | Targeted verification | Result |
| --- | --- | --- | --- | --- |
| 1 | Metadata enum query used invalid `enum_range(text)` (`42883`) | Removed only invalid dead branch | Re-ran enums/extensions query | PASS |
| 2 | `pg_get_functiondef` output lacked statement terminators | Added `;` to 43 closing function delimiters | 43 terminated, 0 unterminated | PASS |
| 3 | Static command used unavailable `pwsh` | Switched command source to Windows PowerShell | Static verifier re-run | PASS |
| 4 | Baseline manifest omitted exact baseline filename | Added exact active filename | Same completeness verifier re-run | PASS |

## 11. Static Verification

- `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-migration-baseline.ps1`: PASS
- Active migrations: 5
- Legacy SQL: 237
- Duplicate active versions: 0
- Secret-value indicators in active migrations: 0
- Baseline counts: 68 tables, 5 types, 7 views, 192 policies
- Section/dependency ordering: PASS
- Manifest active-file completeness: PASS
- Archive exclusion from active path: PASS
- Git micro-audit: implementation paths unstaged; unrelated user changes preserved

No production SQL, migration, deploy, ledger repair or write was performed.

## 12. Known Gaps

- Actual SQL execution is pending a fresh disposable environment.
- Docker/local Supabase runtime is unavailable on this workstation.
- Deterministic `ai_prompts` and `document_templates` production reference rows were not read/copied; seed parity remains open.
- `telegram-uploads` bucket intent is unresolved and deferred.
- `DEEP-001` credential rotation/revocation remains open.
- PR #7 remains unmerged.

## 13. Disposable Replay Handoff

```text
BASELINE_VERSION = 20260712120002
ACTIVE_MIGRATION_PATH = supabase/migrations
LEGACY_ARCHIVE_PATH = supabase/migrations_legacy
FORWARD_MIGRATIONS = 20260712120004, 20260712120006, 20260712120008, 20260712120010
DATA_BACKFILLS = supabase/baseline/backfills/20260712_audio_transcriptions_file_id_deduplicate.sql (synthetic disposable only; non-active)
KNOWN_BLOCKERS = no local Docker; paid Supabase branch requires confirmation; seed parity; telegram bucket intent; DEEP-001
REPLAY_COMMAND_SOURCE = supabase/baseline/BASELINE_MANIFEST.md and scripts/verify-migration-baseline.ps1
NEXT_PROMPT = 17
```

## 14. Decision

`MIGRATION_IMPLEMENTATION_READY_FOR_REPLAY`

Prompt 16 exit criteria are satisfied for repository/static implementation. Runtime claims are intentionally deferred to Prompt 17.
