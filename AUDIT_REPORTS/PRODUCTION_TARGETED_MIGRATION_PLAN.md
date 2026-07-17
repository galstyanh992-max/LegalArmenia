# PRODUCTION TARGETED MIGRATION PLAN ? PB-002 (additive, two-file)

Production project ref: `avmgtsonawtzebvazgcr` (AilegalFinalVersion). NOT staging `vavjajwiqsdhlweggalw`.
Base main: `c30abb78e85139135c8a11488ce2f3ada0eab761` (post PR #12 merge).
Date: 2026-07-16.

## Status: BLOCKED_NO_BACKUP + BLOCKED_NO_WRITE_ACCESS (operator-gated)

This plan is **prepared, not executed**. No production write has run. Production migrations require (1) a confirmed Supabase backup and (2) a Supabase management access token (or DB connection) ? neither is available in this agent session (`supabase secrets list` / `db execute` / `functions deploy` fail with "Access token not provided"). The operator must execute the steps below.

## Files (SHA256, no BOM)

| Migration | SHA256 | Size | BOM |
|---|---|---|---|
| `supabase/migrations/20260716000100_additive_legal_metadata_schema.sql` | `CCBFD93744F43F592BC8D444CF5C72D14B57F66495322C39A333E3C47CB82290` | 9839 B | none |
| `supabase/migrations/20260716000200_metric_rpc_v3.sql` | `4997ACC3313F70FECDF0BB51B6475684884806486C509AA31A4B3AA12B2420FC` | 19937 B | none |

## Production read-only preflight (already performed)

- `search_legal_corpus_metric_v3` does NOT exist on production (additive, no collision).
- The 8 additive metadata tables do NOT exist on production (no collision): `legal_source_files`, `legal_document_metadata`, `legal_document_versions`, `legal_provisions`, `legal_source_page_mappings`, `legal_metadata_reconstruction_runs`, `legal_metadata_failures`, `legal_metadata_review_actions`.
- `content_domain` enum EXISTS on production (V3 dependency satisfied).
- Existing RPCs preserved: `search_legal_corpus_dual` (prosecdef=true), `search_legal_corpus_metric` (prosecdef=false), `search_legal_corpus_metric_v2` (prosecdef=false).
- Production grants (read-only): `search_legal_corpus_dual` PUBLIC/anon/authenticated/postgres/service_role EXECUTE; `search_legal_corpus_metric` postgres/service_role EXECUTE (anon/authenticated NO); `search_legal_corpus_metric_v2` postgres/service_role EXECUTE.
- Both migrations fully idempotent: `create table if not exists`, `create index if not exists`, `create or replace function`. No `drop` of existing objects, no FK `references` in 00100. V3 migration explicitly does NOT modify dual/metric/V2.

## PB002_RECOMMENDED_STRATEGY: B (targeted execution + ledger reconciliation)

**WHY:** Production's ledger diverges (40 remote-only migrations; repo's 8 baseline/hardening migrations are local-only). A full `supabase db push` is unsafe and the CLI refuses it. The two new migrations are purely additive, idempotent, dependency-satisfied, collision-free ? apply in isolation. Strategy A (derive a production baseline matching the 40 remote migrations) is larger, riskier, unnecessary to ship these two additive objects.

**RISKS:** Applying outside the ledger leaves the two versions un-tracked until reconciliation. Mitigation: register both as applied after execution. V3 is SECURITY INVOKER + service_role EXECUTE ? safe; verify grants post-apply. No data backfill (additive schema only).

**ROLLBACK:** feature-flag first (no schema change): keep `LEGAL_SEARCH_V3_*` OFF. If a confirmed incident: `rollback/20260716000100_..._rollback.sql` (drops 8 tables `if exists`), `rollback/20260716000200_..._rollback.sql` (drops V3 `if exists`). Do NOT rollback unless incident confirmed.

**EXACT_OBJECTS:**
- 00100 -> 8 tables (RLS enabled), 13 indexes. No FKs.
- 00200 -> 1 function `search_legal_corpus_metric_v3(text, vector, public.content_domain, text, date, integer, integer, integer, text)` SECURITY INVOKER, `set search_path = public, extensions, pg_temp`; `revoke all from public, anon, authenticated`; `grant execute to service_role`.

## Execution method (operator, with backup confirmed + access token)

```
# 1. Confirm production backup first (dashboard / management API). STOP if no backup.
supabase link --project-ref avmgtsonawtzebvazgcr
# 2. Apply 00100
supabase db execute --file supabase/migrations/20260716000100_additive_legal_metadata_schema.sql
# 3. Validate 00100 (read-only): 8 tables exist + RLS enabled
# 4. Apply 00200
supabase db execute --file supabase/migrations/20260716000200_metric_rpc_v3.sql
# 5. Validate 00200 (read-only): V3 exists + grants
# 6. Ledger reconciliation for the two versions only:
supabase migration repair --status applied 20260716000100 20260716000200
```
Apply ONE at a time; validate before the next. On any error: STOP, do not apply the next, capture exact failure, rollback only the applied part if incident confirmed.

## Validation queries (read-only)

After 00100:
```
select count(*) from information_schema.tables where table_schema='public' and table_name in ('legal_source_files','legal_document_metadata','legal_document_versions','legal_provisions','legal_source_page_mappings','legal_metadata_reconstruction_runs','legal_metadata_failures','legal_metadata_review_actions');  -- expect 8
select relname, relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and relname like 'legal_%' and relkind='r';  -- relrowsecurity = true
```
After 00200:
```
select proname, prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and proname='search_legal_corpus_metric_v3';  -- prosecdef = false
select grantee, privilege_type from information_schema.role_routine_grants where routine_schema='public' and routine_name='search_legal_corpus_metric_v3' order by grantee;  -- expect postgres + service_role EXECUTE; NO anon/authenticated/PUBLIC
select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and proname in ('search_legal_corpus_dual','search_legal_corpus_metric','search_legal_corpus_metric_v2');  -- expect 3 rows (unchanged)
```

## Post-apply runtime guarantee

Production runtime continues to use `search_legal_corpus_metric`. V3 is invoked only when `LEGAL_SEARCH_V3_SHADOW=true` (OFF / not set). No user-visible behavior changes from these migrations.

## Failure checkpoints

- 00100 fails: do NOT run 00200. Rollback 00100 only if incident confirmed.
- 00200 fails: rollback 00200 only if confirmed; 00100 may stay (additive, no runtime impact).
- Feature-flag rollback always available, no migration: `LEGAL_SEARCH_*=false/0`.

## Addendum 2026-07-17 — grant hardening (corrective migration 20260716000300)

**Finding.** Immediately after `20260716000100` executed on production, the 8 new
metadata tables carried full table-level privileges for `anon`, `authenticated`
and `service_role` (SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES,
TRIGGER, MAINTAIN).

**Root cause.** Project-wide `ALTER DEFAULT PRIVILEGES` (owners `postgres` and
`supabase_admin`, evidence in `pg_default_acl`) grant ALL on newly created
public tables to anon/authenticated/service_role. This is identical on every
existing table (`documents`, `search_chunks`, `embeddings`, `document_versions`,
…). The migration text itself grants only `service_role`.

**Exposure.** None at the row level: RLS is enabled on all 8 tables with **zero
policies**, so anon/authenticated receive no rows and no writes. However, the
broad table-level ACLs still **violated least privilege** and were corrected.

**Remediation applied (production).** A targeted REVOKE was executed against
`avmgtsonawtzebvazgcr` for exactly the 8 tables:
- `PUBLIC`, `anon`, `authenticated` privileges = NONE
- `service_role` normalized to exactly SELECT, INSERT, UPDATE
- RLS unchanged (enabled, 0 policies); default privileges unchanged.

**Codification.** Corrective migration **`20260716000300_harden_legal_metadata_table_grants.sql`**
makes this reproducible and auditable. Idempotent; no sequences (none owned by
these tables); does not alter default privileges, RLS, policies, or other tables.

**Delta vs 00100 (explicit, not silent):** `service_role` UPDATE is now granted
on `legal_metadata_failures` and `legal_metadata_review_actions` (00100 granted
INSERT-only). This matches the current production state (default privileges had
already added UPDATE) and the hardening target of uniform SELECT/INSERT/UPDATE.
Extra default-privilege grants (DELETE/TRUNCATE/REFERENCES/TRIGGER/MAINTAIN) are
removed from `service_role`.

**Ledger math.** Three additive versions now await reconciliation
(`20260716000100`, `20260716000200`, `20260716000300`). Expected ledger count
after reconciliation is **47** (was 44), not 46. Reconciliation remains a
separate, gated step and has NOT been performed.

**Residual risk.** The project-wide default-privilege behavior is unchanged and
affects all future tables. Tracked separately as
`DEFAULT_PRIVILEGES_LEAST_PRIVILEGE_DEBT` — only the 8 current tables are
remediated. Do not classify the global issue as resolved.