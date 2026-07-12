# 17 — LOCAL MIGRATION LEDGER FORENSICS

Prompt 13/20 — Migration Ledger Analyst
Date: 2026-07-12
Method: static analysis only (regex/index over `supabase/migrations/`); **no migration applied, no migration edited**. Live-replay evidence is cross-referenced from report 13 where it already exists.

## EXIT DECISION: `LEDGER_FORENSICS_COMPLETE`

---

## 1. Corpus

**232 local `.sql` files** (the pack's premise said 225 — actual count is 232), spanning `20260124125739` → `20260711080700`. Remote ledger: ~40 entries, earliest `20260530010000`.

Eras (by construction target):

| Era | Range | Files (≈) | Architecture built |
| --- | --- | ---: | --- |
| E1 "Lovable-era" | `20260124` – `20260322` | ~185 | `public.profiles/user_roles/cases/case_files/...` as **real tables**, enums, `has_role()`, legacy functions, seed users |
| E2 RAG/KB | `20260328` – `20260630` | ~30 | corpus tables, embeddings, RPCs, `app.legal_decisions` |
| E3 Repair-loop compat | `20260707` – `20260711` | ~17 | fixes + writable **views** over the `app.*` architecture |

## 2. Remote-ledger intersection (computed, not assumed)

| Relationship | Count | Members |
| --- | --- | --- |
| **Version+name exact match** | **11** | `20260530010000 ai_legal_core` … `20260630122000 create_legal_decisions` (the full E2 ledger head) |
| **Name match, version drift** | **9** | `fix_case_files_user_scoped_uploads` (local `…170000` vs remote `…164831`), `fix_ai_analysis_db_persistence`, `ai_analysis_runs_member_insert`, `fix_security_definer_views`, `create_reminders_notifications`, `create_ai_prompts_tables`, `create_comments_notes_feedback`, `create_teams_document_templates`, `generated_documents_view_insert` |
| **Remote-only names** | ~19 | `user_management_profiles_user_roles_writable`, `profiles_view_insert_default_role`, `profiles_view_delete_trigger`, `audio_transcriptions_file_fk`, `client_documents_not_null_file_fields`, `schema_drift_columns_kb_audio_errorlogs`, `kb_category_*` (2), `document_templates_unique_category_subcategory`, `seed_document_templates`, `ai_prompts_unique_function_module`, `seed_ai_prompts_batch_00…08` (9) |
| **Local-only** | ~210 | the entire E1 era + E2 resets + post-hoc fixes (recursion fixes, test-support, RPC hardening, …) |

**Root cause of the version drift (provenance, from this session's own history):** the July repair-loop migrations were applied to production **via the management API** (`apply_migration`), which stamps its own execution timestamp as the ledger version; the repo then received *mirror files* with hand-rounded timestamps (`…080000`-style) and, in several cases, **bundled names** — e.g. local `20260711080200_user_management_writable_views.sql` corresponds to **three** remote entries (`user_management_profiles_user_roles_writable` + `profiles_view_insert_default_role` + `profiles_view_delete_trigger`), and local `20260711080600_audio_files_error_logs_kb_drift.sql` corresponds to ≥3 remote entries (`audio_transcriptions_file_fk` + `client_documents_not_null_file_fields` + `schema_drift_columns_kb_audio_errorlogs`, plus the `kb_category_*` pair). The `seed_ai_prompts_batch_00…08` remote entries have **no local mirrors at all** (their SQL lived in session scratchpads).

## 3. `app.user_profiles` — step-by-step evolution

1. **Creation: not in any local migration and not in the remote ledger** (`grep 'app\.user_profiles'` hits only E3 files; only `app.legal_decisions` is ever `CREATE TABLE`-d under `app` locally; ledger starts 2026-05-30 with RAG work). ⇒ bootstrapped out-of-band (SQL editor / assistant DDL), **UNKNOWN_ORIGIN**, before 2026-07-07.
2. First local *references* (read-only assumptions): `20260707130000_f7_2_test_support.sql`, `20260708000000/1` (metrics hardening) — they *presume* the table exists.
3. E3 compat layer formalizes the contract: `20260711080200_user_management_writable_views.sql` recreates `public.profiles`/`public.user_roles` **views** over it with INSTEAD OF triggers; `20260711080000_fix_security_definer_views.sql` flips views to `security_invoker`.
4. Production's `handle_new_user` (captured in report 16) writes to it with `'client'::app.app_role` — a body that exists **nowhere** in the repo.

## 4. First migration to fail on a clean base — static proof

**`20260630122000_create_legal_decisions.sql` (position: first E2 file after `20260628*`; nothing earlier touches `app.*`).**

Static root cause, line 7:
```sql
case_id uuid not null references app.cases(case_id) on delete cascade,
```
- The file itself only does `create schema if not exists app;` — it never creates `app.cases`.
- **No local migration creates `app.cases`** (exhaustive scan: the only `CREATE TABLE app.*` in the corpus is `app.legal_decisions` in this same file).
- Everything chronologically earlier is E1/E2 `public.*`/RAG DDL. The apparent earlier "app." hit (`20260124130149`) is `current_setting('app.encryption_key')` — a GUC name, not a schema reference (false positive, excluded).
- Therefore on a clean database the FK resolution fails: `relation "app.cases" does not exist`.

**Empirical cross-confirmation (already produced in report 13):** Supabase's own branch replay of the *remote* ledger failed at exactly this entry (`MIGRATIONS_FAILED` after 10 applied, `app` schema absent) — same root cause, independently reproduced.

Secondary (runtime, not apply-time) defect in a full local replay: the E1 recursive-RLS pair (PB-001, `20260126161647` → fixed `20260311094000/95000`) makes the intermediate states unusable for queries even though they *apply* cleanly — proven live in report 13.

## 5. Duplicates / superseded / destructive index

| Pattern | Files | Replay note |
| --- | --- | --- |
| `handle_new_user` redefinitions | `20260124125739`, `20260124125754`, `20260125032401` (+ production's 4th, out-of-repo variant) | last-writer-wins; all three build the *wrong* (public.*) body relative to prod |
| `case_type` enum double-create | `20260126172600` (bare), `20260126230813` (guarded `DO … duplicate_object`) | order-sensitive: bare one must run first (it does, chronologically) |
| `profiles.auditor_id` added 4× | `20260126161532` (bare), then IF-NOT-EXISTS variants | bare-first ordering holds; reordering would break |
| Destructive ops | 12 files (seed-user DELETEs ×3-row batches, `TRUNCATE` in `20260322151926`, `20260328120000_reset_kb_practice…`) | safe on clean base; **data-destructive if pointed at a live DB** — must never be replayed against production |
| Superseded chains | E1 storage policies (`20260124125807`) → July hardened set; E1 `handle_new_user` chain; recursion pair → `202603110*` fixes | archive candidates |

## 6. Disposition table (grouped; per-file listing available from the index on request)

| Migration (group) | Dependency | Production Relationship | Replay Risk | Recommended Disposition |
| --- | --- | --- | --- | --- |
| E2 exact-match 11 (`20260530*`–`20260630122000`) | RAG corpus self-contained **except** `create_legal_decisions` → `app.cases` | Ledger-matched, live | `create_legal_decisions` fails without prior `app.*` baseline | **KEEP** (with baseline ordered before it) |
| `20260630123000_atomic_decision_supersession` | `app.legal_decisions` | In prod (function present) but **not in ledger** | fails without baseline | **KEEP** + `NEEDS_EVIDENCE` (ledger-repair entry) |
| E3 name-drift 9 + bundled 2 | `app.*` + prior views | Content applied; ledger identity differs | duplicate-apply risk if replayed onto prod ledger | **REORDER_CANDIDATE** → align names/versions during ledger repair |
| Remote-only seeds (`seed_ai_prompts_batch_00…08`, `seed_document_templates`, `ai_prompts_unique…`) | `ai_prompts`/`document_templates` tables | Applied in prod, no local mirror | clean-replay omits seeded data | **REPLACE_WITH_BASELINE** (export mirrors as data-seed files) |
| E1 era (~185 files) | self-contained `public.*` tables | **Non-convergent** — builds objects prod replaced with views/`app.*` (incl. `encrypted_pii` with a hardcoded default key, absent in prod) | high: creates a *parallel wrong* architecture; recursion window `20260126`→`20260311`; destructive seed ops | **ARCHIVE_HISTORICAL** |
| E2 resets (`20260328120000` truncate, `20260321120000` seed reset) | E1/E2 data | not ledger-tracked | data-destructive | **ARCHIVE_HISTORICAL** |
| `app.*` core (8 tables), compat-view *initial* creation, `profile_compat_settings`, `media-uploads` bucket, prod `handle_new_user` body | — | **exist only in production** | cannot be replayed from repo at all | **NEEDS_EVIDENCE** → capture into versioned baseline (Prompt 15) |

## EXIT: `LEDGER_FORENSICS_COMPLETE`
