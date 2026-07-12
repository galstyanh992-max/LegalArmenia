# 16 — READ-ONLY PRODUCTION SCHEMA BASELINE

Prompt 12/20 — Database Forensics Architect
Date: 2026-07-12
Target: `avmgtsonawtzebvazgcr` (production). **Catalog/metadata queries only — zero user-table rows read, zero writes, zero secrets output.**

## EXIT DECISION: `PRODUCTION_BASELINE_READY`

---

## 1. Topology

| Schema | Tables | Views | Notes |
| --- | ---: | ---: | --- |
| `app` | 9 | 0 | Core case-management base tables, **all RLS-enabled** |
| `public` | 55 | 7 | 7 compat views (all `security_invoker=on`) + 55 real tables (RAG corpus, agents, KB, admin, telegram, …) |
| `internal` | 4 | 0 | `ai_metrics`, `extraction_runs`, `ingestion_jobs`, `source_files` |
| `auth` / `storage` / platform | 23 / 8 / — | — | Supabase-managed |

### app.* base tables (with policy counts)
`ai_analysis_runs`(4), `case_members`(4), `case_messages`(4), `cases`(4), `client_documents`(4), `generated_documents`(4), `legal_decisions`(4), `multi_agent_analysis_runs`(2), `user_profiles`(4) — RLS enabled on all 9.

### public compat views (all `security_invoker=on`) → base mapping
| View | Base | Shape notes (from `pg_get_viewdef`) |
| --- | --- | --- |
| `cases` | `app.cases` | `case_id→id`, `court_name` doubled as `court`; exposes 21 columns |
| `profiles` | `app.user_profiles` ⨝ `public.profile_compat_settings` | `user_id→id`, `app_role::text→role`, computed `has_migrated`, telegram prefs from compat table |
| `user_roles` | `app.user_profiles` | **derived**: one row per user from the single `app_role` column (single-role model) |
| `case_files` | `app.client_documents` | `doc_id→id`, `file_name→filename/original_filename`, `file_url→storage_path`, computed `version=1`, `file_type=NULL` |
| `ai_analysis` | `app.ai_analysis_runs` | jsonb extraction (`result_jsonb->>…→response_text`), `query_text→prompt_used`, `triggered_by→created_by` |
| `case_members` | `app.case_members` | direct |
| `generated_documents` | `app.generated_documents` | `generated_id→id`, `template→title/document_type`, computed status/recipient columns |

## 2. Focus objects

### `app.user_profiles`
`user_id:uuid! (PK)`, `full_name`, `email`, **`app_role:app.app_role!`** (single role, NOT NULL), `is_active:bool!`, `created_at!`, `updated_at!`, `username`, `auditor_id`.
Policies: `up_select`/`up_update` = `user_id = auth.uid() OR app.get_my_role() = 'admin'`; `up_insert_service`; `up_delete` (admin). No recursion pattern anywhere (clean helper-function design).

### `app.user_roles` / `app.profiles`
**Do not exist.** Roles are the `app_role` column of `app.user_profiles`; `public.user_roles` and `public.profiles` are derived views. Any consumer or migration assuming multi-role `user_roles` *tables* targets an architecture production does not have.

### `app.cases`
`case_id:uuid!`, `title!`, `description`, `status:text!`, **`created_by:uuid!`**, `lawyer_id:uuid!`, timestamps!, `case_number`, `case_type:text`, `facts`, `legal_question`, `current_stage`, `court_name`, `client_id`, `priority:text!`, `court_date`, `party_role`, `appeal_party_role`, `notes`, `deleted_at`. (Note: `status/priority/case_type` are plain `text` here — the local legacy migrations used enums.)

### `app.client_documents`
`doc_id:uuid!`, `case_id:uuid!`, `uploaded_by`, `file_name!`, `file_url!`, `file_size:int8`, timestamps!.

### Auth bootstrap
Single non-internal trigger on `auth.users`: **`on_auth_user_created`** → `public.handle_new_user()`, whose production body (captured) is:
```
INSERT INTO app.user_profiles (user_id, full_name, email, app_role, is_active)
VALUES (NEW.id, COALESCE(meta->>'full_name','User'), NEW.email, 'client'::app.app_role, true)
ON CONFLICT (user_id) DO NOTHING;
```
— fixed `client` role, idempotent, **entirely different body from every version in the local migrations** (which insert into `public.profiles` + `public.user_roles` tables).

### app functions
`can_manage_case[SD]`, `can_read_case[SD]`, `check_case_upload_access[SD]`, `get_my_role[SD]`, `is_case_lawyer[SD]`, `is_case_member[SD]`, `prevent_legal_decision_data_update`, `save_legal_decision_atomic` ([SD] = SECURITY DEFINER).

### Legacy public functions check
Of the legacy local-migration function set, only `handle_new_user` exists (with the app-architecture body above). **Absent in production**: `has_role`, `get_my_auditor_id`, `encrypt_sensitive_data`/`decrypt_sensitive_data` (incl. the hardcoded-default-key pair — good), `search_knowledge_base`, `track_kb_version`.

### Storage
Buckets: `case-files` (private, 50 MB limit), `media-uploads` (private). **`telegram-uploads` bucket does NOT exist** — yet `supabase/functions/telegram-webhook` uploads to it and `public.telegram_uploads` table exists → flagged for report 18.
`storage.objects` policies (9): case-scoped set (`case_files_read/insert/delete`, "Case members can upload to case-files bucket") + user-folder set ("Users can upload/view/delete their user folder files") + `media_uploads_insert/select` — consistent with the applied `fix_case_files_user_scoped_uploads` ledger entry.

### Integrity spot-check
`public.audio_transcriptions`: PK only; **FK `file_id → app.client_documents(doc_id)`** (not `public.case_files` as local legacy migrations define); **no unique index on `file_id`** — PB-003 confirmed in production.

### Remote migration ledger
Captured earlier this session via `list_migrations`: ~40 entries, earliest `20260530010000 ai_legal_core` — i.e. the ledger **begins 2026-05-30**; nothing before that date (the entire `app.*`/compat-view bootstrap and the legacy `public.*` era) is ledger-tracked.

## 3. Object status table (grouped)

| Object (family) | Production Shape | Application Usage | Local Migration Coverage | Status |
| --- | --- | --- | --- | --- |
| `app.cases`, `app.user_profiles`, `app.client_documents`, `app.case_members`, `app.case_messages`, `app.ai_analysis_runs`, `app.generated_documents`, `app.multi_agent_analysis_runs` | Base tables, RLS-on, helper-fn policies | Indirect via public views (frontend) + direct via edge functions | **None** — no local migration creates any of them (verified: only `app.legal_decisions` is created locally) | **UNKNOWN_ORIGIN** (production-only bootstrap) |
| `app.legal_decisions` | Base table, immutability trigger | `save_legal_decision_atomic` path | `20260630122000` (exact ledger match) | **MATCHED** |
| 7 public compat views | `security_invoker=on`, writable via INSTEAD OF triggers | **Primary frontend contract** (`types.ts`) | Partially: recreated/refined by the `202607*` repair-loop set (name-matched in ledger) — but **initial creation is unledgered** | **STRUCTURAL_DRIFT** (definitions live in prod + partial local mirrors) |
| RAG/KB corpus (`documents`, `embeddings`, `legal_units`, `search_chunks*`, `authorities`, …) + `internal.*` | Tables per ledger | Edge functions (vector search, ingestion) | 11 exact-match migrations (`20260530*`–`20260630*`) | **MATCHED** |
| Admin/product tables (`ai_prompts*`, `reminders`, `notifications`, `case_comments`, `user_notes`, `user_feedback`, `teams*`, `document_templates`, `error_logs`, `app_settings`, `audit_logs`, `evidence_registry`, `agent_*`, `audio_transcriptions`, `ocr_results`, `kb_*`, `generated_documents` view-insert, …) | Tables + policies per the July repair-loop entries | Frontend + edge | Name-matched ledger entries with **version drift** (repo files carry different timestamps), several bundled N-remote→1-local | **STRUCTURAL_DRIFT** (content matched, ledger identity drifted) |
| Legacy `public.*` architecture from local migrations (`public.profiles`/`user_roles`/`cases`/`case_files` **as tables**, `encrypted_pii`, `api_usage`, enum types `case_status`/`case_priority`, legacy fn set) | **Absent** (or replaced by views/text columns) | Not used (frontend consumes the view shapes) | ~210 local-only files construct it | **LOCAL_ONLY** (non-convergent with production) |
| `telegram-uploads` bucket | **Absent** | `telegram-webhook` edge fn writes to it | None | **LOCAL_ONLY expectation / runtime gap** |
| `case-files`, `media-uploads` buckets + 9 storage policies | Present, private | Uploads/signed URLs | Bucket creation: legacy local file (matched by accident of same name); policies: ledger-matched July entry | **MATCHED** (policies) / **UNKNOWN_ORIGIN** (media-uploads bucket) |
| `public.profile_compat_settings` | Table (joined by `profiles` view) | Telegram prefs via profiles view | None found | **UNKNOWN_ORIGIN** |

## RULES compliance
Catalog queries only (`pg_namespace`, `pg_class`, `pg_views`, `pg_policies`, `pg_proc`, `pg_trigger`, `pg_constraint`, `pg_indexes`, `information_schema.columns`, `storage.buckets` metadata). No user-table rows returned; no secrets printed; no full dump produced.

## EXIT: `PRODUCTION_BASELINE_READY`
