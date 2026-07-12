# 20 — MIGRATION REPAIR IMPLEMENTATION

Prompt 16/20 — Principal Migration Implementer (Fable)
Phase: P6 — Migration Baseline Implementation
Date: 2026-07-12

## DECISION: `BLOCKED_PRODUCTION_ORIGIN_EVIDENCE` (scoped) — repository scaffolding complete; authoritative full baseline needs an operator-run `supabase db dump`

Everything implementable without a production DB credential is done, static-verified, and committed. The one remaining artifact for a replay-complete baseline — a faithful schema-only dump of all 64 production tables — requires `supabase db dump` with a production connection string, which this agent must not handle. **Prompt 17 (clean replay) cannot start until that artifact exists**, so the exit criteria for advancing are not met; this is a documented handoff, not a silent skip.

## 1. Metadata
- Strategy: `B_BASELINE_PLUS_FORWARD_MIGRATIONS` (from `AUDIT_REPORTS/19`).
- Branch: `claude/case-upload-function-fix-lbn2sp` (restarted from merged `main` `d9cdc97`).
- Inputs: reports 16–19, current migrations, `types.ts`, repo usage inventory.

## 2. Repository Baseline
- PR #7 merged; `db_passwords.cjs` confirmed absent from `main`.
- Supabase CLI present: `2.109.1`. `supabase/config.toml` present.
- Pre-existing layout: `supabase/{config.toml, functions, migrations, storage-policies}`. No `baseline/` or `migrations_legacy/` existed — created per this prompt.
- Active migration path before: 232 files. After: **48** (46 keep-set + 2 new forward). Legacy: **186** archived.

## 3. Fable Task Ledger Summary
See `AUDIT_REPORTS/FABLE_MIGRATION_TASK_LEDGER.md`. 10 tasks `FIXED_VERIFIED`, 2 `DEFERRED` (D8 storage promotion, ledger repair — operator-gated), 2 `BLOCKED` (T11 authoritative dump, T13 Prompt 17 — both gated on the credential-bound dump and/or a paid disposable branch).

## 4. Legacy Archive
- `supabase/migrations_legacy/` — **186** files (`20260124`–`20260322`), moved verbatim via `git mv` (names + timestamps preserved, contents unchanged).
- `LEGACY_MIGRATION_MANIFEST.md` — per-file table: all `local-only` / not-remote-applied / `ARCHIVE_HISTORICAL`, with objects, reason, and replacement.
- **Excluded from active replay**: the CLI only reads `supabase/migrations/`; `migrations_legacy/` is inert historical evidence.

## 5. Baseline Architecture
Strategy B: a versioned baseline (fresh-env only) + the ledger-tracked keep-set + forward migrations.
- `supabase/baseline/00_app_authorization_core.reference.sql` — the security-critical `app` authorization core captured **exactly** (6 SECURITY DEFINER helpers + `handle_new_user` production body), for diff-review and as the base the forward migrations assume.
- `supabase/baseline/GENERATE_BASELINE.md` — the exact operator step to produce the authoritative `00_schema_baseline.sql` via `supabase db dump --schema app,public,storage`, with redaction/exclusion/ordering/cross-check instructions.
- `supabase/baseline/BASELINE_MANIFEST.md` — 14 required sections.

## 6. Included Objects (each with source classification)
| Object group | Source class |
| --- | --- |
| `app.app_role`, 8 `app.*` tables + RLS/policies | `PRODUCTION_RUNTIME_REQUIRED` |
| `app` authz functions, `handle_new_user`, `on_auth_user_created` | `SECURITY_BASELINE_REQUIRED` |
| 7 `public` compat views + INSTEAD OF triggers | `APPLICATION_CONTRACT_REQUIRED` |
| `public.profile_compat_settings` | `COMPATIBILITY_REQUIRED` |
| `storage` buckets + 9 policies | `SECURITY_BASELINE_REQUIRED` |

## 7. Excluded Objects
Production data rows, Auth users, Storage objects, credentials, `internal.*` runtime state, dashboard-only config, Supabase-managed schemas (`auth`/`realtime`/`vault`/`supabase_migrations`/`pgbouncer`/`graphql*`).

## 8. Forward Migrations
| File | Drift | Status | Rollback |
| --- | --- | --- | --- |
| `20260712120000_audio_transcriptions_file_id_unique.sql` | D7 / PB-003 | ready (dedup-guarded) | `drop index` (inline) |
| `20260712120100_telegram_uploads_bucket.sql` | D9 | ready, **gated on product decision** | drop policies + bucket (inline) |
| storage hardening (draft) | D8 | **deferred** — draft in `storage-policies/`; not emitted to avoid duplicate-policy conflict with the already-applied user-scoped subset | — |
No old timestamps reused; no remote-applied identifiers altered.

## 9. Backfill Separation
No backfills embedded in the schema baseline (DDL only). Reference-data seeds (document templates, ai_prompts) → `supabase/seed/` (export via `db dump --data-only --table`), idempotent `ON CONFLICT DO NOTHING`, never auto-run against production. D7's optional dedup is a separate reviewed data-migration, prerequisite to the unique index only if duplicates exist.

## 10. Repair Cycles
No static failures encountered in the implemented scope (single pass). The one confirmed structural failure from prior forensics — `create_legal_decisions` → missing `app.cases` — is resolved *by design* (the baseline creates `app.*` before the keep-set runs); this will be empirically confirmed in Prompt 17 once the authoritative baseline exists.

## 11. Static Verification
| Gate | Result |
| --- | --- |
| Forward-migration SQL balance (`$$`, parens) | PASS |
| Secret scan (new files) | PASS (no secrets; only the local `127.0.0.1` dev default remains elsewhere) |
| Active path excludes legacy | PASS (CLI reads `migrations/` only; `migrations_legacy/` inert) |
| Active/legacy counts | 48 active / 186 legacy |
| Git status | 6 additions, 186 renames (no deletions, no history rewrite) |

## 12. Known Gaps
- **T11 (blocking replay):** authoritative `00_schema_baseline.sql` not generated — needs operator `supabase db dump` (prod DB connection string). The `app` authz core is captured exactly; remaining table DDL is documented in report 16, intentionally not hand-transcribed (db dump is exact and low-risk vs. error-prone manual reconstruction).
- **Ledger repair (T12):** mapping the July mirrors + `atomic_decision_supersession` to remote identities via `supabase migration repair` — operator-gated.
- **D8 storage hardening:** deferred pending disposable-env behavioral test.

## 13. Disposable Replay Handoff
```text
BASELINE_VERSION      = 2026-07-12 (partial: app-authz-core reference committed; full dump pending T11)
ACTIVE_MIGRATION_PATH = supabase/migrations/ (48 files)
LEGACY_ARCHIVE_PATH   = supabase/migrations_legacy/ (186 files, inert)
FORWARD_MIGRATIONS    = 20260712120000_audio_transcriptions_file_id_unique.sql; 20260712120100_telegram_uploads_bucket.sql (gated)
DATA_BACKFILLS        = supabase/seed/ (to be exported); optional audio dedup pre-D7
KNOWN_BLOCKERS        = T11 authoritative db dump (operator credential); paid disposable branch for replay
REPLAY_COMMAND_SOURCE = supabase/baseline/GENERATE_BASELINE.md + BASELINE_MANIFEST.md §11
NEXT_PROMPT           = 17 (blocked until T11 done + branch-cost confirmation)
```

## 14. Decision
`BLOCKED_PRODUCTION_ORIGIN_EVIDENCE` — reframed precisely: not blocked on *knowing* production's origin (report 16 captured it read-only), but blocked on **producing the authoritative baseline artifact**, which is credential-gated (`supabase db dump`). All non-credential-gated implementation is complete and static-verified. No production writes, no production migration applies, no ledger changes, no history rewrite, no secrets output.
