# 142 — MIGRATION AND ROLLBACK AUDIT

## Migrations Audited

1. `20260716000100_additive_legal_metadata_schema.sql`
2. `20260716000200_metric_rpc_v3.sql`

## Migration 1: Additive Legal Metadata Schema

| Check | Result |
|-------|--------|
| Additive only (no existing table modified) | PASS — 8 new tables only |
| No destructive DDL | PASS — no DROP, TRUNCATE, or ALTER on existing objects |
| No corpus DML | PASS — no INSERT/UPDATE/DELETE on existing tables |
| No status rewrite | PASS |
| No embedding changes | PASS |
| No ECHR/Venice/Qwen mutation | PASS |
| Fixed search_path | N/A — DDL, no function with search_path |
| RLS enabled | PASS — all 8 tables have `enable row level security` |
| Grants | PASS — service_role only (select + insert/update) |
| Revoke from public/anon/authenticated | N/A for tables (RLS handles) |
| Idempotent | PARTIAL — uses `create table if not exists` but no `drop function if exists` for conflicting constraints |
| Primary keys | PASS — each table has PK |
| Unique constraints | PASS — dedup constraints on (source_file_id, parser_version) and (chunk_id, parser_version) |

## Migration 2: Metric RPC V3

| Check | Result |
|-------|--------|
| Additive only | PASS — `create or replace function` for V3 only |
| No destructive DDL | PASS — no DROP of existing functions |
| No corpus DML | PASS |
| Fixed search_path | PASS — `set search_path = public, extensions, pg_temp` |
| Security invoker | PASS — `security invoker` |
| Statement timeout | PASS — `set statement_timeout = '15s'` |
| Plan cache mode | PASS — `set plan_cache_mode = 'force_custom_plan'` |
| Revoke from public/anon/authenticated | PASS |
| Grant to service_role | PASS |
| V1 untouched | PASS — no reference to search_legal_corpus_metric (V1) |
| V2 untouched | PASS — no reference to search_legal_corpus_metric_v2 |
| Dual RPC untouched | PASS — no reference to search_legal_corpus_dual |
| Comment | PASS |
| Input validation | PASS — query required, length, scope, limit, ANN limit, FTS limit, vector dimension, non-finite, zero |

## Rollback Symmetry

| Forward | Rollback | Symmetric? |
|---------|----------|------------|
| 20260716000100 (8 tables) | 20260716000100_rollback (8 drops) | PASS |
| 20260716000200 (V3 function) | 20260716000200_rollback (drop function) | PASS |

## Migration Replay

| Check | Result |
|-------|--------|
| Local replay executed | **NO** — no local Supabase instance available |
| Rollback replay executed | **NO** |
| SQL syntax validated | NOT EXECUTED — no psql available |
| Function signature safe for PostgREST | NOT VERIFIED — requires database execution |

**Migration replay was NOT executed.** The migrations exist as SQL text only. They have not been applied to any database, local or staging.

## Join Bug in V3

The `legal_document_metadata` join in V3's `enriched` CTE:
```sql
left join public.legal_document_metadata ldm 
  on ldm.source_file_id = sc.source_document_id::text
```

`source_document_id` is UUID, `source_file_id` is text (`sf_` prefix). Cast produces UUID string, not `sf_` format. **Join will never match.** This must be fixed before deployment — either by:
1. Changing the join to use a different key, or
2. Storing UUIDs in `legal_document_metadata.source_file_id`, or
3. Adding a `document_id` UUID column to `legal_document_metadata` and joining on that.

## Verdict
Migrations are additive and well-structured. Rollback files are symmetric. However, migration replay was NOT executed, SQL was NOT validated against a database, and V3 has a join type mismatch bug that must be fixed.
