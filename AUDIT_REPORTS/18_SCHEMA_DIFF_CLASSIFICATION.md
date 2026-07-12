# 18 — PRODUCTION VS REPLAY DIFF CLASSIFICATION

Prompt 14/20 — Structured Schema Diff Analyst
Date: 2026-07-12
Inputs: report 16 (production baseline), report 17 (local forensics), `src/integrations/supabase/types.ts`, frontend/edge object inventory (Wave 2 audits 07–12), authorization & storage migrations.

## EXIT DECISION: `SCHEMA_DIFF_CLASSIFIED`

---

## Classification table

Each row answers the six required decisions: **(1)** keep production behavior? **(2)** must exist on clean replay? **(3)** used by the application? **(4)** needs data backfill? **(5)** fixable by forward-only migration? **(6)** needs baseline/squash?

| # | Drift | Classification | (1) | (2) | (3) | (4) | (5) | (6) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| D1 | `app.*` core (8 of 9 tables: `cases`, `user_profiles`, `client_documents`, `case_members`, `case_messages`, `ai_analysis_runs`, `generated_documents`, `multi_agent_analysis_runs`) + `app.get_my_role`/`can_read_case`/`is_case_member`… helper fns — **exist only in production, zero migration coverage** | **REQUIRED_RUNTIME_OBJECT** + **MISSING_REPRODUCIBLE_MIGRATION** | YES | YES | YES (via views + edge fns) | NO (schema only) | NO — a forward migration can't retro-create the base the *existing* forward migrations already assume | **YES → baseline** |
| D2 | 7 `public` compat views (+ INSTEAD OF triggers) — initial creation unledgered; later refinements ledger-matched | **REQUIRED_RUNTIME_OBJECT** + **MISSING_REPRODUCIBLE_MIGRATION** (initial) / MATCHED (refinements) | YES | YES | **YES — primary frontend contract** (`types.ts` builds on these shapes) | NO | Partially (refinements exist as migrations) | **YES → baseline captures current definitions** |
| D3 | `public.user_roles` = view derived from single `app_role` column vs local E1 multi-role **table** | **COMPATIBILITY_OBJECT** (prod) / local E1 variant → **DEPRECATED_CANDIDATE** | YES (single-role is the live model) | YES (as view) | YES (`useAuth` reads it) | NO | n/a | baseline |
| D4 | Legacy E1 architecture from ~185 local-only files (`public.profiles/cases/case_files/user_roles` **as tables**, enums `case_status/priority`, `has_role()`, `encrypted_pii`+hardcoded-default-key fns, `api_usage`, seed users, recursion-window policies) — **absent in production** | **DEPRECATED_CANDIDATE** (as replay source) — *not* production objects, so no deletion question arises | n/a (nothing to keep — not in prod) | **NO** — replaying them builds a wrong parallel architecture | NO | NO | NO | **YES → archive out of the active ledger** |
| D5 | July repair-loop set: 9 name-matched/version-drifted + 2 bundled local mirrors vs ~14 remote entries | **REQUIRED_RUNTIME_OBJECT**, ledger-identity drift | YES | YES | YES (`reminders`, `notifications`, `ai_prompts`, `teams`, `case_comments`, `generated_documents` insert-path, storage policies, …) | NO | YES — content already correct; only ledger mapping needs repair | ledger-repair, not squash |
| D6 | Remote-only data seeds (`seed_ai_prompts_batch_00…08`, `seed_document_templates`) — no local mirrors | **MISSING_REPRODUCIBLE_MIGRATION** (data tier) | YES | YES (app behavior depends on prompt/template rows) | YES (`generate-document` reads `ai_prompts`) | **YES — this *is* data**: clean replay needs the seed content | YES (export as data-seed migrations) | baseline data section |
| D7 | `audio_transcriptions.file_id`: **no unique index** (prod-confirmed); FK → `app.client_documents` (vs E1's FK → `public.case_files`) | **SECURITY_FIX_PENDING** (integrity, PB-003) | YES (keep FK to `client_documents`) | YES | YES | Pre-fix dedup needed if duplicates exist | **YES — forward migration** (`CREATE UNIQUE INDEX … (file_id)` after dedup check) | no |
| D8 | Storage: draft hardening `supabase/storage-policies/…draft.sql` not applied; current 9 policies live | **SECURITY_FIX_PENDING** (planned, verified-in-draft only) | YES | YES | YES | NO | **YES — forward migration** after disposable-env behavioral test | no |
| D9 | `telegram-uploads` **bucket absent** in production while `telegram-webhook` edge fn writes to it and `public.telegram_uploads` table exists | **UNKNOWN** → most likely **REQUIRED_RUNTIME_OBJECT missing** (feature currently broken at upload step) or intentionally dormant | YES (table) | YES *if* Telegram uploads are a live feature | Edge fn only | NO | **YES — forward migration** creating the private bucket + policies | no |
| D10 | `public.profile_compat_settings`, `media-uploads` bucket — in prod, unledgered, no local file | **LEGACY_PRODUCTION_OBJECT** (compat/telegram prefs; joined by `profiles` view → **do not delete**) | YES | YES (`profiles` view joins it) | Indirect | NO | NO | **baseline** |
| D11 | `20260630123000_atomic_decision_supersession` — function live in prod, entry absent from remote ledger | **MISSING_REPRODUCIBLE_MIGRATION** (ledger gap only) | YES | YES | Edge (decision pipeline) | NO | ledger-repair (`migration repair --status applied`) | no |
| D12 | E1 objects that later E3 migrations *assume* (e.g. `kb_versions`, `knowledge_base`, `document_templates` exist in prod with drifted columns via `kb_category_*`/drift entries) | **STRUCTURAL_DRIFT** reconciled by July entries | YES | YES | YES | NO | already fixed forward | baseline captures net shape |

Per the pack rule, **no production object is proposed for deletion merely for lacking a local migration** — D1/D2/D10 are explicitly keep-and-capture.

## Notes for the strategy gate (Prompt 15)

1. The **only** viable route to "clean environment buildable from the repo" runs through a **captured baseline** of D1/D2/D10 (+ net shapes of D12) — no ordering of existing files can synthesize objects no file creates.
2. Forward-only migrations remain the correct vehicle for D7, D8, D9 (small, testable, disposable-env-verifiable).
3. D5/D11 are pure **ledger bookkeeping** (`supabase migration repair`), not SQL work.
4. D4/E1 must leave the replay path (archive), or every fresh environment rebuilds a wrong architecture *before* drifting into the recursion window documented in report 17.

## EXIT: `SCHEMA_DIFF_CLASSIFIED`
