# BASELINE MANIFEST

1. **Baseline version:** `2026-07-12` (Strategy B — versioned baseline + forward migrations).
2. **Source audit reports:** `AUDIT_REPORTS/16` (production baseline), `17` (ledger forensics), `18` (drift classification), `19` (strategy).
3. **Included schemas:** `app`, `public` (application tables + compat views), `storage` (buckets + policies).
4. **Excluded schemas:** `auth`, `realtime`, `vault`, `supabase_migrations`, `pgbouncer`, `graphql*`, `extensions` (Supabase-managed).
5. **Included application objects:**
   - `app.app_role` enum; `app.*` base tables (`user_profiles`, `cases`, `client_documents`, `case_members`, `case_messages`, `ai_analysis_runs`, `generated_documents`, `multi_agent_analysis_runs`) with RLS + policies.
   - `app` authorization functions (`get_my_role`, `can_read_case`, `can_manage_case`, `is_case_lawyer`, `is_case_member`, `check_case_upload_access`) — **exact bodies captured in `00_app_authorization_core.reference.sql`**.
   - 7 `public` compat views (`cases`, `profiles`, `user_roles`, `case_files`, `ai_analysis`, `case_members`, `generated_documents`) with `security_invoker=on` + INSTEAD OF triggers.
   - `public.handle_new_user` (production body) + `on_auth_user_created` trigger.
   - `public.profile_compat_settings` (joined by the `profiles` view).
   - `storage` buckets `case-files` (private, 50 MB), `media-uploads` (private) + the 9 live `storage.objects` policies.
6. **Excluded managed objects:** Auth users, Storage objects (data), credentials, dashboard config, `internal.*` runtime state, GraphQL introspection.
7. **Compatibility objects:** the 7 compat views + `profile_compat_settings` — the frontend's `types.ts` contract; kept as-is.
8. **Forward migrations** (in `supabase/migrations/`, fresh 2026-07-12 timestamps):
   - `20260712120000_audio_transcriptions_file_id_unique.sql` (D7/PB-003) — dedup-guarded unique index.
   - `20260712120100_telegram_uploads_bucket.sql` (D9) — private bucket + owner policies (**gated on product decision**).
   - D8 storage hardening: draft in `supabase/storage-policies/`; **deferred** (production already carries the user-scoped subset; promote only after disposable-env behavioral test, to avoid duplicate-policy conflicts).
9. **Backfill requirements:** none embedded in the schema baseline. Reference-data seeds (document templates, ai_prompts) belong in `supabase/seed/` (D6) — to be exported from production via `db dump --data-only --table …`, kept out of DDL. A one-off `audio_transcriptions` dedup data-migration is prerequisite to D7 **only if** duplicates exist.
10. **Production application prohibition:** the baseline is **fresh-environment only**. It must NEVER be applied to the existing production database (which already contains these objects). Production receives, at most, the small gated forward migrations — never the baseline.
11. **Replay procedure:** on a fresh disposable DB → `supabase/baseline/00_schema_baseline.sql` (operator-generated, see `GENERATE_BASELINE.md`) → `supabase/migrations/*` in order → `supabase/seed/*`. Verified in Prompt 17.
12. **Verification procedure:** `AUDIT_REPORTS/21` (Prompt 17) — structural assertions vs `AUDIT_REPORTS/16`, auth-bootstrap test, RLS + storage behavioral matrices, on a disposable branch.
13. **Rollback limitations:** the baseline is not "rolled back" (fresh-env only); each forward migration ships an inline rollback comment. Ledger repair (mapping the 11 July mirrors + `atomic_decision_supersession` to their remote identities via `supabase migration repair --status applied`) is a separate, operator-gated step — no timestamps reused, nothing falsely marked applied.
14. **Known unknowns:** the authoritative full-schema `00_schema_baseline.sql` is **not yet generated** — it requires an operator-run `supabase db dump` (production DB connection string, which this agent must not handle). Until it exists, the clean-replay path is incomplete and Prompt 17 cannot run. The `app` authorization core is captured exactly in the reference file; the remaining table DDL is documented in `AUDIT_REPORTS/16` but not hand-transcribed (db dump is the exact, low-risk source).
