# FINDING — DEFAULT_PRIVILEGES_LEAST_PRIVILEGE_DEBT

Status: **OPEN** (partially mitigated — only the 8 Phase-11 metadata tables remediated)
Severity: Medium (defense-in-depth / least-privilege; **no active row exposure** due to RLS)
Project: `avmgtsonawtzebvazgcr` (AilegalFinalVersion)
Opened: 2026-07-17

## Summary
Project-wide `ALTER DEFAULT PRIVILEGES` automatically grants **all** table-level
privileges (SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER,
MAINTAIN) to `anon`, `authenticated`, and `service_role` on **every** newly
created table in schema `public`.

## Evidence
`pg_default_acl` (objtype `r`, schema `public`):
- grantor `postgres`   → `anon`, `authenticated`, `service_role` = `arwdDxtm`
- grantor `supabase_admin` → `anon`, `authenticated`, `service_role` = `arwdDxtm`

Confirmed present on existing tables: `documents`, `search_chunks`,
`embeddings`, `document_versions` (anon/authenticated full CRUD), and it was the
source of the unexpected grants on the 8 new `legal_*` metadata tables.

## Why it is not an active breach
RLS is enabled on the sensitive tables. For tables with RLS enabled and no
permissive policy, `anon`/`authenticated` receive zero rows and cannot write,
regardless of table-level grants. `service_role` bypasses RLS by design.

## Why it is still debt
Table-level grants to `anon`/`authenticated` violate least privilege and create
risk if any table is ever created (or altered) without RLS, or with a permissive
policy. The safety currently rests entirely on RLS discipline per table.

## Remediated so far
The 8 Phase-11 additive tables were hardened (migration
`20260716000300_harden_legal_metadata_table_grants.sql`):
`anon`/`authenticated`/`PUBLIC` = NONE; `service_role` = SELECT/INSERT/UPDATE.

## NOT remediated (open scope)
- The project-wide `ALTER DEFAULT PRIVILEGES` themselves are unchanged.
- All pre-existing public tables still carry broad anon/authenticated grants.
- Any future table will again inherit broad grants unless explicitly hardened.

## Recommended follow-up (separate change, out of Stage A scope)
1. Decide target posture (Supabase default RLS-gated model vs. strict grant model).
2. If strict: `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;` (for roles `postgres` and `supabase_admin`) and audit/remediate existing tables — high blast radius, requires full regression + RLS review.
3. Add CI check asserting new public tables have RLS enabled and no anon/authenticated table grants.

Do NOT mark this finding resolved until the global behavior and existing tables are addressed.
