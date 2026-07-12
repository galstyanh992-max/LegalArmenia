# 19 — MIGRATION REPAIR STRATEGY GATE

Prompt 15/20 — Principal Database Migration Architect
Date: 2026-07-12
Inputs: reports 16 (production baseline), 17 (ledger forensics), 18 (drift classification).

## VERDICT: `MIGRATION_STRATEGY_READY`

## Selected strategy: **B — Versioned baseline + forward migrations** (with a scoped dose of A for the three pending fixes, and explicit ledger repair)

### Why not the alternatives
- **A alone (forward-only reconciliation):** cannot work — reports 17/18 prove the required base objects (`app.*` core, initial compat views, `profile_compat_settings`) are created by **no file at all**; "forward" has nothing correct to stand on, and the ~185-file E1 era actively builds a *wrong* architecture before any forward step runs.
- **C (controlled squash):** prohibited by its own precondition — external consumers of the old ledger cannot be ruled out (the production ledger is live and its provenance is exactly what's unclear), and squashing would tempt timestamp reuse, which the criteria forbid.
- **D (blocked):** unnecessary — origins are now sufficiently evidenced (report 16 captured live shapes read-only; unknown *provenance* doesn't block capturing the *current state* as the authoritative baseline).

### Fit against the decision criteria
| Criterion | How B satisfies it |
| --- | --- |
| Existing production is never recreated | Baseline is *captured from* production, applied only to **fresh** environments; production receives nothing but small forward migrations |
| Clean environment buildable from zero | `baseline → forward migrations → seeds` replay path |
| Data backfills separated from DDL | Seeds live in a dedicated `seed/` tier (D6), never inside DDL files |
| Authorization/Storage fixes stay verifiable | D7/D8/D9 are individual forward migrations, testable on a disposable branch |
| Rollback & idempotency defined | Each forward migration ships a documented down-path; baseline is idempotent-by-construction (`create … if not exists` is *not* used to mask drift — fresh-env-only application) |
| No ledger forgery | Ledger reconciliation uses the official `supabase migration repair --status applied` mechanism, with each repaired version documented |
| No old-timestamp reuse | All new files take fresh `2026-07-12+` timestamps |
| Production history untouched without a gate | The only production-ledger operation (repair) is listed as a **separate gated rollout step** requiring explicit operator approval |

---

## Exact file plan

```text
supabase/
  baselines/
    20260712T00_baseline_app_core.sql          # D1: app schema, 8 tables, helper fns (SECDEF), RLS+policies, app.app_role enum
    20260712T01_baseline_public_compat.sql     # D2/D3/D10: 7 views (security_invoker=on) + INSTEAD OF triggers,
                                               #   profile_compat_settings, handle_new_user (production body) + on_auth_user_created
    20260712T02_baseline_public_product.sql    # net current shape of the 55 public tables NOT covered by kept migrations
                                               #   (agent_*, evidence_registry, audio_transcriptions w/ FK→client_documents, ocr_results, …)
    20260712T03_baseline_storage.sql           # buckets case-files (50MB, private), media-uploads (private) + the 9 live storage.objects policies
    README.md                                  # provenance note: captured read-only from avmgtsonawtzebvazgcr on 2026-07-12; fresh-env-only
  migrations/                                  # ACTIVE ledger: KEEP set only
    (11 exact-match E2 files, 20260630123000_atomic_decision_supersession,
     the 11 July mirrors — renamed/split during ledger repair to match remote identities)
    20260712xxxxxx_audio_transcriptions_file_id_unique.sql   # D7 forward fix (post-dedup)
    20260712xxxxxx_storage_private_access_hardening.sql      # D8 (promoted from draft after disposable-env behavioral pass)
    20260712xxxxxx_create_telegram_uploads_bucket.sql        # D9 (private bucket + scoped policies) — gated on product decision
  migrations_archive/                          # E1 era (~185 files) + resets: moved verbatim, README explaining why
  seed/
    20260712_seed_document_templates.sql       # D6 mirrors exported from production data (templates + ai_prompts batches)
    20260712_seed_ai_prompts.sql
```

### Baseline object list (capture source: report 16, re-dumped via catalog queries or `pg_dump --schema-only --schema=app --schema=public` at execution time)
- `app`: `app_role` enum; tables `user_profiles`, `cases`, `client_documents`, `case_members`, `case_messages`, `ai_analysis_runs`, `generated_documents`, `multi_agent_analysis_runs` (+ `legal_decisions` stays covered by its kept migration — baseline must **not** duplicate it); functions `get_my_role`, `can_read_case`, `can_manage_case`, `is_case_lawyer`, `is_case_member`, `check_case_upload_access` (+ RLS policies, 4/table as inventoried).
- `public`: 7 compat views + their INSTEAD OF triggers; `handle_new_user` (production body) + `on_auth_user_created`; `profile_compat_settings`; net shapes of unledgered product tables.
- `storage`: buckets + 9 policies.
- `internal`: `ai_metrics`, `extraction_runs`, `ingestion_jobs`, `source_files` (shapes from ledger-matched migrations where covered; baseline only fills gaps).

### Forward migrations (each: purpose / rollback / idempotency)
| File | Purpose | Rollback | Notes |
| --- | --- | --- | --- |
| `…_audio_transcriptions_file_id_unique.sql` | `CREATE UNIQUE INDEX CONCURRENTLY audio_transcriptions_file_id_key ON public.audio_transcriptions(file_id)` **preceded by** a dedup check (abort if duplicates found; dedup script is a separate, reviewed data migration) | `DROP INDEX` | closes PB-003 defense-in-depth |
| `…_storage_private_access_hardening.sql` | promote `supabase/storage-policies/20260711_…draft.sql` | `DROP POLICY` per name | apply to disposable env first; behavioral matrix from report 09 §6 |
| `…_create_telegram_uploads_bucket.sql` | private bucket + service-role-scoped write, owner-scoped read | delete bucket (if empty) | **gated on product decision** (D9 — feature may be dormant by intent) |

### Data migration plan
- Seeds (D6) exported from production as `INSERT … ON CONFLICT DO NOTHING` files under `seed/` — replayable, idempotent, no DDL inside.
- The D7 dedup (if duplicates exist) is a one-off reviewed data migration that keeps the newest row per `file_id` — executed **only** after explicit approval, never bundled with the index DDL.

### Disposable replay matrix (acceptance test for the strategy)
| Step | Expected |
| --- | --- |
| Fresh branch/db → apply `baselines/*` in order | clean |
| → apply active `migrations/*` | clean (incl. `create_legal_decisions` — its `app.cases` FK now resolves) |
| → apply `seed/*` | clean, idempotent on re-run |
| → run report 13's RLS matrix + `handle_new_user` test | all PASS |
| → `supabase db diff` against production | empty (or explainable-only) diff |

### Production rollout prerequisites (gated, in order)
1. **DEEP-001 rotation first** (unchanged blocker — no schema work on a credential-compromised database).
2. Operator approval for `supabase migration repair --status applied <versions>` mapping the 11 July mirrors + `20260630123000` to their remote identities (documented one-by-one; no timestamps reused, nothing marked applied that isn't).
3. Disposable replay matrix green (above).
4. Only then: the three forward migrations to production, one at a time, each with its own verification.

## VERDICT: `MIGRATION_STRATEGY_READY`
(Execution of the plan — baseline capture, file moves, ledger repair — is deliberately **not performed** in this prompt: it is a strategy gate. Each execution step above carries its own approval gate.)
