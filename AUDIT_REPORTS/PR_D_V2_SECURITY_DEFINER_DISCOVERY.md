# PR-D V2 Security Definer Discovery (Production-First) — Corrected

> **Correction note (this revision).** This document previously (a) labelled every
> routine `SERVICE_ROLE_ONLY` regardless of its real ACL and body guard,
> (b) contradicted itself on `search_path` (Section 2 said `RISKY_MUTABLE_PATH`
> while Section 5 said `SAFE_TRUSTED_FIXED_PATH` for the *same* functions),
> (c) reported the *hotfix-target* ACL/`search_path`/exposure for
> `admin_set_user_role` and `record_ai_metric` as if it were the live production
> state, (d) reduced all dependency/caller evidence to two lumped `0` fields,
> (e) carried a single, in one case uncorroborated, hash per closed target, and
> (f) concluded `NO_PR_D_REQUIRED`. Each of these is corrected below against the
> committed PR-A/PR-B/PR-C evidence files and the baseline migration source.
> Production and staging were not touched to produce this correction; only this
> report changed.

## 0. Evidence provenance and classification methodology

**Production truth sources (committed, in-repo):**
- `AUDIT_REPORTS/PR_A_RECORD_AI_METRIC_EVIDENCE.md` — production `record_ai_metric`
  hashes/ACL; PR-A is on **HOLD / DO NOT MERGE**; production still on the
  vulnerable baseline.
- `AUDIT_REPORTS/PR_B_GET_EMBEDDING_METRICS_EVIDENCE.md` — production
  `get_embedding_metrics` **already safe/live out-of-band** (genuinely closed).
- `AUDIT_REPORTS/PR_C_TRIGGER_FUNCTION_GRANTS_EVIDENCE.md` — production ACLs for
  `cases_compat_insert` / `handle_new_user`; PR-C is on **HOLD**, production
  unchanged (direct API-role EXECUTE still granted).
- `supabase/migrations/20260717141940_hotfix_admin_set_user_role.sql` — documents
  the vulnerable production state A of `admin_set_user_role`; hotfix on **HOLD**.
- `supabase/migrations/20260712120002_versioned_baseline_20260712.sql` — function
  bodies, RLS policies, trigger definitions.

**Authorization taxonomy (replaces the blanket `SERVICE_ROLE_ONLY`).** Derived
from the *effective ACL* plus the *actual body guard*:
- `OPEN_PUBLIC_READ` — broad EXECUTE, no body guard, read-only over public
  reference corpus (no tenant rows).
- `CALLER_IDENTITY_SELF` — resolves `auth.uid()` and returns only the caller's own
  row / evaluates the caller's own membership; safe under any grant.
- `CALLER_ROLE_GATED_ADMIN` — body gate `app.get_my_role() = 'admin'`
  (returns empty / raises for non-admins) and NULL-safe.
- `SERVICE_ROLE_ONLY_ACL` — EXECUTE granted only to `postgres`/`service_role`.
- `SERVICE_ROLE_BODY_GUARD` — body enforces
  `auth.jwt()->>'role' = 'service_role'` (fail-closed) *and* service-role-only ACL.
- `TRIGGER_INTERNAL` — reached only through a registered trigger.
- `UNGUARDED_BROAD_EXECUTE` — broad EXECUTE with no effective guard → finding.
- `FAIL_OPEN_ADMIN_GUARD` — broad EXECUTE with a NULL-unsafe
  `app.get_my_role() <> 'admin'` guard that is skipped when the role is NULL →
  finding.

**`search_path` taxonomy (replaces `RISKY_MUTABLE_PATH`).** Every one of the 17
routines pins `search_path` with a function-level `SET`, so none is
caller-mutable. Two consistent, exhaustive classes are used and applied
identically in Section 2 and Section 5:
- `SAFE_EXPLICIT_EMPTY_PATH` — `SET search_path = ''`; all objects must be (and
  are) schema-qualified.
- `SAFE_PINNED_TRUSTED_PATH` — `SET search_path` to a fixed list of trusted
  schemas (`app`, `public`, `auth`, `internal`, `extensions`, `pg_temp`,
  `pg_catalog`), none of which is writable by `anon`/`authenticated` after
  `20260719000001_harden_postgres_default_privileges`.
There are **0** unset/inherited (`RISKY_MUTABLE`) `search_path` findings.

**Caller/dependency provenance (replaces the two lumped `0` fields).** Counts are
reported across seven independent dimensions and sourced as noted:
- `catalog_dependents` — dependent DB objects (triggers + RLS policies + views
  that create `pg_depend` edges), enumerated from the baseline migration.
- `trigger_refs` — registered triggers executing the function (production value;
  repo/staging value noted where it differs).
- `policy_refs` — distinct RLS policies referencing the function (baseline).
- `view_refs` — `INSTEAD OF` view functions the routine backs.
- `function_body_refs` — other in-scope SECURITY DEFINER routines calling it.
- `repo_callers` — non-test `src/` (frontend) `.rpc()` call sites.
- `edge_callers` — non-test `supabase/functions/` `.rpc()` call sites.

## 1. Inventory Reconciliation
- ALL_DATABASE_NON_SYSTEM_ROUTINE_COUNT = 191
- PROJECT_OWNED_SCOPED_ROUTINE_COUNT = 50

### Scoped Catalog Breakdown
- app: 8 (expected 8)
- auth: 4 (expected 4)
- public: 38 (expected 38)


## 2. All 17 SECURITY DEFINER Routines
### app.can_manage_case(p_case_id uuid)
- **Return Type**: boolean
- **Trigger/Non-Trigger**: non-trigger
- **proconfig**: search_path=app, public, auth
- **Raw ACL**: {=X/postgres,postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
- **PUBLIC execute**: true
- **anon execute**: true
- **authenticated execute**: true
- **service_role execute**: true
- **PostgREST exposure**: NOT_EXPOSED_SCHEMA
- **Authorization**: CALLER_IDENTITY_SELF (body: `app.get_my_role()='admin' OR app.is_case_lawyer(p_case_id)`, both resolve `auth.uid()`)
- **Search_path**: SAFE_PINNED_TRUSTED_PATH
- **Caller/dependency counts**: catalog_dependents=7; trigger_refs=0; policy_refs=7; view_refs=0; function_body_refs=0; repo_callers=0; edge_callers=0
- **Security classification**: NO_PR_D_REQUIRED (INFO — not API-reachable; caller-scoped)
### app.can_read_case(p_case_id uuid)
- **Return Type**: boolean
- **Trigger/Non-Trigger**: non-trigger
- **proconfig**: search_path=app, public, auth
- **Raw ACL**: {=X/postgres,postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
- **PUBLIC execute**: true
- **anon execute**: true
- **authenticated execute**: true
- **service_role execute**: true
- **PostgREST exposure**: NOT_EXPOSED_SCHEMA
- **Authorization**: CALLER_IDENTITY_SELF (body scopes every branch to `auth.uid()`)
- **Search_path**: SAFE_PINNED_TRUSTED_PATH
- **Caller/dependency counts**: catalog_dependents=29; trigger_refs=0; policy_refs=29; view_refs=0; function_body_refs=0; repo_callers=0; edge_callers=0
- **Security classification**: NO_PR_D_REQUIRED (INFO — not API-reachable; caller-scoped)
### app.check_case_upload_access(_case_id uuid)
- **Return Type**: boolean
- **Trigger/Non-Trigger**: non-trigger
- **proconfig**: search_path=""
- **Raw ACL**: none
- **PUBLIC execute**: true
- **anon execute**: true
- **authenticated execute**: true
- **service_role execute**: true
- **PostgREST exposure**: NOT_EXPOSED_SCHEMA
- **Authorization**: CALLER_IDENTITY_SELF (body scopes to `auth.uid()` via app.cases / app.case_members)
- **Search_path**: SAFE_EXPLICIT_EMPTY_PATH
- **Caller/dependency counts**: catalog_dependents=2; trigger_refs=0; policy_refs=2; view_refs=0; function_body_refs=0; repo_callers=0; edge_callers=0
- **Security classification**: NO_PR_D_REQUIRED (INFO — not API-reachable; caller-scoped)
### app.get_my_role()
- **Return Type**: app.app_role
- **Trigger/Non-Trigger**: non-trigger
- **proconfig**: search_path=app, public, auth
- **Raw ACL**: {=X/postgres,postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
- **PUBLIC execute**: true
- **anon execute**: true
- **authenticated execute**: true
- **service_role execute**: true
- **PostgREST exposure**: NOT_EXPOSED_SCHEMA
- **Authorization**: CALLER_IDENTITY_SELF (body: `select up.app_role from app.user_profiles up where up.user_id = auth.uid()`)
- **Search_path**: SAFE_PINNED_TRUSTED_PATH
- **Caller/dependency counts**: catalog_dependents=38; trigger_refs=0; policy_refs=38; view_refs=0; function_body_refs=3 (can_manage_case, can_read_case, get_ai_metrics_summary); repo_callers=0; edge_callers=0
- **Security classification**: NO_PR_D_REQUIRED (INFO — not API-reachable; caller-scoped)
### app.is_case_lawyer(p_case_id uuid)
- **Return Type**: boolean
- **Trigger/Non-Trigger**: non-trigger
- **proconfig**: search_path=app, public, auth
- **Raw ACL**: {=X/postgres,postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
- **PUBLIC execute**: true
- **anon execute**: true
- **authenticated execute**: true
- **service_role execute**: true
- **PostgREST exposure**: NOT_EXPOSED_SCHEMA
- **Authorization**: CALLER_IDENTITY_SELF (body: `c.lawyer_id = auth.uid()`)
- **Search_path**: SAFE_PINNED_TRUSTED_PATH
- **Caller/dependency counts**: catalog_dependents=3; trigger_refs=0; policy_refs=3; view_refs=0; function_body_refs=2 (can_manage_case, can_read_case); repo_callers=0; edge_callers=0
- **Security classification**: NO_PR_D_REQUIRED (INFO — not API-reachable; caller-scoped)
### app.is_case_member(p_case_id uuid)
- **Return Type**: boolean
- **Trigger/Non-Trigger**: non-trigger
- **proconfig**: search_path=app, public, auth
- **Raw ACL**: {=X/postgres,postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
- **PUBLIC execute**: true
- **anon execute**: true
- **authenticated execute**: true
- **service_role execute**: true
- **PostgREST exposure**: NOT_EXPOSED_SCHEMA
- **Authorization**: CALLER_IDENTITY_SELF (body: `cm.user_id = auth.uid()`)
- **Search_path**: SAFE_PINNED_TRUSTED_PATH
- **Caller/dependency counts**: catalog_dependents=0; trigger_refs=0; policy_refs=0; view_refs=0; function_body_refs=1 (can_read_case); repo_callers=0; edge_callers=0
- **Security classification**: NO_PR_D_REQUIRED (INFO — not API-reachable; caller-scoped)
### public.admin_set_user_role(p_user_id uuid, p_role app.app_role)
- **Return Type**: void
- **Trigger/Non-Trigger**: non-trigger
- **proconfig (PRODUCTION state A)**: search_path=public, app, auth, pg_temp
- **Raw ACL (PRODUCTION state A)**: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
- **PUBLIC execute**: true
- **anon execute**: true
- **authenticated execute**: true
- **service_role execute**: true
- **PostgREST exposure**: EXPOSED_AND_EXECUTABLE
- **Authorization**: FAIL_OPEN_ADMIN_GUARD (production body guard `app.get_my_role() <> 'admin'` is NULL-unsafe; skipped when role is NULL → arbitrary role assignment)
- **Search_path**: SAFE_PINNED_TRUSTED_PATH (path is pinned; the finding is the guard/ACL, not the path)
- **Caller/dependency counts**: catalog_dependents=0; trigger_refs=0; policy_refs=0; view_refs=0; function_body_refs=0; repo_callers=0; edge_callers=0 (3 references exist, all in test harnesses)
- **Security classification**: **P0 — privilege escalation.** Remediation designed in `20260717141940_hotfix_admin_set_user_role.sql` (service-role-only, `search_path=''`); hotfix is on HOLD and NOT applied to production. See Section 7.
### public.cases_compat_insert()
- **Return Type**: trigger
- **Trigger/Non-Trigger**: trigger
- **proconfig**: search_path=app, public, auth, pg_temp
- **Raw ACL (PRODUCTION baseline)**: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
- **PUBLIC execute**: true
- **anon execute**: true
- **authenticated execute**: true
- **service_role execute**: true
- **PostgREST exposure**: TRIGGER_ONLY
- **Authorization**: TRIGGER_INTERNAL (excess direct API-role EXECUTE still present in production)
- **Search_path**: SAFE_PINNED_TRUSTED_PATH
- **Caller/dependency counts**: catalog_dependents (prod)=0 / (staging+repo)=1; trigger_refs (prod)=0 / (staging+repo)=1 (cases_insert_tg); policy_refs=0; view_refs=1 (public.cases INSTEAD OF INSERT); function_body_refs=0; repo_callers=0; edge_callers=0
- **Security classification**: **P3 — defense-in-depth** (unnecessary direct EXECUTE). Owned by PR-C (HOLD). Also a trigger-drift candidate (Section 6).
### public.get_ai_metrics_summary(p_days integer)
- **Return Type**: TABLE(day date, fn_name text, model text, calls bigint, total_tokens bigint, cost_usd numeric, avg_latency_ms numeric, failures bigint)
- **Trigger/Non-Trigger**: non-trigger
- **proconfig**: search_path=internal, public, auth, pg_temp
- **Raw ACL**: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
- **PUBLIC execute**: false
- **anon execute**: false
- **authenticated execute**: true
- **service_role execute**: true
- **PostgREST exposure**: EXPOSED_AND_EXECUTABLE
- **Authorization**: CALLER_ROLE_GATED_ADMIN (body: `if app.get_my_role() is distinct from 'admin' then return; end if;` — NULL-safe `is distinct from`; non-admins receive an empty set)
- **Search_path**: SAFE_PINNED_TRUSTED_PATH
- **Caller/dependency counts**: catalog_dependents=0; trigger_refs=0; policy_refs=0; view_refs=0; function_body_refs=0; repo_callers=1 (src/components/UsageMonitor.tsx:146); edge_callers=0
- **Security classification**: NO_PR_D_REQUIRED (admin-gated, read-only, NULL-safe)
### public.get_embedding_metrics(p_model text)
- **Return Type**: TABLE(model text, total_chunks bigint, embedded bigint, pending bigint, failed bigint, est_total_tokens bigint, est_total_cost_usd numeric, est_remaining_cost_usd numeric)
- **Trigger/Non-Trigger**: non-trigger
- **proconfig**: search_path=""
- **Raw ACL**: {postgres=X/postgres,service_role=X/postgres}
- **PUBLIC execute**: false
- **anon execute**: false
- **authenticated execute**: false
- **service_role execute**: true
- **PostgREST exposure**: EXPOSED_BUT_NO_EXECUTE
- **Authorization**: SERVICE_ROLE_BODY_GUARD (service-role-only ACL + fail-closed JWT guard; safe function live in production per PR-B)
- **Search_path**: SAFE_EXPLICIT_EMPTY_PATH
- **Caller/dependency counts**: catalog_dependents=0; trigger_refs=0; policy_refs=0; view_refs=0; function_body_refs=0; repo_callers=0; edge_callers=0
- **Security classification**: CLOSED — genuinely remediated in production (PR-B). See Section 7.
### public.get_my_role()
- **Return Type**: text
- **Trigger/Non-Trigger**: non-trigger
- **proconfig**: search_path=public
- **Raw ACL**: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
- **PUBLIC execute**: true
- **anon execute**: true
- **authenticated execute**: true
- **service_role execute**: true
- **PostgREST exposure**: EXPOSED_AND_EXECUTABLE
- **Authorization**: CALLER_IDENTITY_SELF (body: `select role from public.users where id = auth.uid()` — returns only the caller's own role)
- **Search_path**: SAFE_PINNED_TRUSTED_PATH
- **Caller/dependency counts**: catalog_dependents=0; trigger_refs=0; policy_refs=0; view_refs=0; function_body_refs=0; repo_callers=0; edge_callers=0 (legacy/unused; distinct from app.get_my_role)
- **Security classification**: NO_PR_D_REQUIRED (caller-self read). INFO: no caller anywhere in repo — legacy-hygiene candidate, not a vulnerability.
### public.handle_new_user()
- **Return Type**: trigger
- **Trigger/Non-Trigger**: trigger
- **proconfig**: search_path=public, app
- **Raw ACL (PRODUCTION baseline)**: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
- **PUBLIC execute**: true
- **anon execute**: true
- **authenticated execute**: true
- **service_role execute**: true
- **PostgREST exposure**: TRIGGER_ONLY
- **Authorization**: TRIGGER_INTERNAL (active trigger; excess direct API-role EXECUTE still present in production)
- **Search_path**: SAFE_PINNED_TRUSTED_PATH
- **Caller/dependency counts**: catalog_dependents=1; trigger_refs=1 (on_auth_user_created, enabled, prod+staging); policy_refs=0; view_refs=0; function_body_refs=0; repo_callers=0; edge_callers=0
- **Security classification**: **P3 — defense-in-depth** (unnecessary direct EXECUTE; the trigger itself is required). Owned by PR-C (HOLD).
### public.record_ai_analysis_run(p_case_id uuid, p_result jsonb, p_query text, p_model text)
- **Return Type**: TABLE(run_id uuid, case_id uuid)
- **Trigger/Non-Trigger**: non-trigger
- **proconfig**: search_path=pg_catalog, app, public
- **Raw ACL**: {postgres=X/postgres,service_role=X/postgres}
- **PUBLIC execute**: false
- **anon execute**: false
- **authenticated execute**: false
- **service_role execute**: true
- **PostgREST exposure**: EXPOSED_BUT_NO_EXECUTE
- **Authorization**: SERVICE_ROLE_ONLY_ACL (EXECUTE granted only to service_role; body falls back to `auth.uid()` for attribution)
- **Search_path**: SAFE_PINNED_TRUSTED_PATH
- **Caller/dependency counts**: catalog_dependents=0; trigger_refs=0; policy_refs=0; view_refs=0; function_body_refs=0; repo_callers=0; edge_callers=0
- **Security classification**: NO_PR_D_REQUIRED (no API-role EXECUTE)
### public.record_ai_metric(p_fn_name text, p_model text, p_input_tokens integer, p_output_tokens integer, p_cost_usd numeric, p_latency_ms integer, p_status text, p_error_message text, p_case_id uuid, p_user_id uuid)
- **Return Type**: void
- **Trigger/Non-Trigger**: non-trigger
- **proconfig (PRODUCTION)**: search_path=internal, public, auth, pg_temp
- **Raw ACL (PRODUCTION)**: {postgres=X/postgres,=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
- **PUBLIC execute**: true
- **anon execute**: true
- **authenticated execute**: true
- **service_role execute**: true
- **PostgREST exposure**: EXPOSED_AND_EXECUTABLE
- **Authorization**: UNGUARDED_BROAD_EXECUTE (production body has NO authorization guard; all identity fields are caller-controlled)
- **Search_path**: SAFE_PINNED_TRUSTED_PATH (path is pinned; the finding is the guard/ACL, not the path)
- **Caller/dependency counts**: catalog_dependents=0; trigger_refs=0; policy_refs=0; view_refs=0; function_body_refs=0; repo_callers=0; edge_callers=1 (supabase/functions/_shared/ai-metrics.ts:35 → 6 service-role edge functions transitively)
- **Security classification**: **P1 — integrity/spoofing.** Remediation designed in PR-A (`20260718180110`, service-role-only); PR-A is on HOLD and NOT applied to production. See Section 7.
### public.search_legal_corpus(p_query_text text, p_query_embedding vector, p_content_domain content_domain, p_norm_status normalized_status, p_effective_at date, p_language_code text, p_limit integer, p_offset integer)
- **Return Type**: TABLE(chunk_id uuid, document_id uuid, version_id uuid, title_hy text, text_snippet text, source_url text, citation_anchor text, page_from integer, page_to integer, content_domain content_domain, norm_status normalized_status, effective_from date, effective_to date, hybrid_score real, vector_score real, fts_score real, match_reason text)
- **Trigger/Non-Trigger**: non-trigger
- **proconfig**: search_path=public, extensions, pg_temp, statement_timeout=60000
- **Raw ACL**: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
- **PUBLIC execute**: true
- **anon execute**: true
- **authenticated execute**: true
- **service_role execute**: true
- **PostgREST exposure**: EXPOSED_AND_EXECUTABLE
- **Authorization**: OPEN_PUBLIC_READ (no body guard; SELECT-only over public reference corpus)
- **Search_path**: SAFE_PINNED_TRUSTED_PATH
- **Caller/dependency counts**: catalog_dependents=0; trigger_refs=0; policy_refs=0; view_refs=0; function_body_refs=0; repo_callers=0; edge_callers=0 (edge search paths use *_metric / *_dual variants)
- **Security classification**: NO_PR_D_REQUIRED (intentional public legal-corpus read; no tenant rows)
### public.search_legal_corpus_dual(p_query_text text, p_metric_embedding vector, p_qwen_embedding vector, p_content_domain content_domain, p_norm_status normalized_status, p_limit integer, p_metric_limit integer, p_qwen_limit integer, p_bm25_limit integer, p_effective_at date)
- **Return Type**: TABLE(chunk_id uuid, document_id uuid, version_id uuid, doc_id text, title text, text_snippet text, source_url text, citation_anchor text, language text, source text, content_domain content_domain, norm_status normalized_status, score real, vector_score real, fts_score real, retrieval_model text, retrieval_route text, match_reason text)
- **Trigger/Non-Trigger**: non-trigger
- **proconfig**: search_path=public, extensions, pg_temp, statement_timeout=60000
- **Raw ACL**: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
- **PUBLIC execute**: true
- **anon execute**: true
- **authenticated execute**: true
- **service_role execute**: true
- **PostgREST exposure**: EXPOSED_AND_EXECUTABLE
- **Authorization**: OPEN_PUBLIC_READ (no body guard; dynamic SQL binds only embeddings/limits via `%L`, not identifiers; SELECT-only over public corpus)
- **Search_path**: SAFE_PINNED_TRUSTED_PATH
- **Caller/dependency counts**: catalog_dependents=0; trigger_refs=0; policy_refs=0; view_refs=0; function_body_refs=0; repo_callers=0; edge_callers=2 (kb-unified-search/index.ts:59, vector-search/index.ts:78)
- **Security classification**: NO_PR_D_REQUIRED (intentional public legal-corpus read; no tenant rows)
### public.search_legal_unit_chunks_preview(p_query_text text, p_limit integer, p_content_domain content_domain, p_language text, p_effective_at date)
- **Return Type**: TABLE(chunk_id uuid, document_id uuid, version_id uuid, title text, text_snippet text, source_url text, citation_anchor text, language text, content_domain content_domain, norm_status normalized_status, legal_unit_id uuid, article_number text, chunk_version text, score real)
- **Trigger/Non-Trigger**: non-trigger
- **proconfig**: search_path=public
- **Raw ACL**: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
- **PUBLIC execute**: true
- **anon execute**: true
- **authenticated execute**: true
- **service_role execute**: true
- **PostgREST exposure**: EXPOSED_AND_EXECUTABLE
- **Authorization**: OPEN_PUBLIC_READ (no body guard; lexical SELECT-only over public.search_chunks_legal_unit)
- **Search_path**: SAFE_PINNED_TRUSTED_PATH
- **Caller/dependency counts**: catalog_dependents=0; trigger_refs=0; policy_refs=0; view_refs=0; function_body_refs=0; repo_callers=0; edge_callers=0 (preview surface; no live caller)
- **Security classification**: NO_PR_D_REQUIRED (intentional public legal-corpus read; no tenant rows)

## 3. Reconcile the Broad-Execute Routines
Corrected authorization dispositions (the previous blanket "harmless / read-only"
labels are replaced with the effective ACL + body-guard evidence):

**Not PostgREST-reachable (schema `app` not exposed) — caller-scoped helpers:**
- app.can_manage_case — NOT_POSTGREST_EXPOSED; caller-scoped via `auth.uid()`; broad grant is inert externally.
- app.can_read_case — NOT_POSTGREST_EXPOSED; caller-scoped via `auth.uid()`.
- app.check_case_upload_access — NOT_POSTGREST_EXPOSED; caller-scoped via `auth.uid()`.
- app.get_my_role — NOT_POSTGREST_EXPOSED; caller-scoped via `auth.uid()`.
- app.is_case_lawyer — NOT_POSTGREST_EXPOSED; caller-scoped via `auth.uid()`.
- app.is_case_member — NOT_POSTGREST_EXPOSED; caller-scoped via `auth.uid()`.

**PostgREST-exposed and safe:**
- public.get_ai_metrics_summary — SAFE_ADMIN_GATED; NULL-safe `is distinct from 'admin'` early-return.
- public.get_my_role — SAFE_CALLER_SELF; returns only the caller's own row.
- public.search_legal_corpus — SAFE_OPEN_PUBLIC_READ; SELECT-only public corpus.
- public.search_legal_corpus_dual — SAFE_OPEN_PUBLIC_READ; SELECT-only public corpus.
- public.search_legal_unit_chunks_preview — SAFE_OPEN_PUBLIC_READ; SELECT-only public corpus.

**PostgREST-exposed and UNSAFE in production (broad EXECUTE + no/failed guard):**
- public.admin_set_user_role — **P0** FAIL_OPEN_ADMIN_GUARD (see Sections 4/7).
- public.record_ai_metric — **P1** UNGUARDED_BROAD_EXECUTE (see Sections 4/7).

**Trigger functions with excess direct grant (broad EXECUTE):**
- public.cases_compat_insert — **P3** (PR-C, HOLD).
- public.handle_new_user — **P3** (PR-C, HOLD).

## 4. Reconcile PostgREST-Exposed Executable Routines (exact evidence)
The five routines with `EXPOSED_AND_EXECUTABLE` + a live API-role EXECUTE grant,
each with the exact in-body evidence rather than a generic safety claim.

### public.get_ai_metrics_summary(p_days integer)
- Exposed: Yes (public). Non-trigger; authenticated+service_role EXECUTE.
- Exact guard: `if app.get_my_role() is distinct from 'admin' then return; end if;`
  (`is distinct from` is NULL-safe → NULL role returns an empty set, never leaks).
- Side effects: none (SELECT aggregate over `internal.ai_metrics`).
- anon: no EXECUTE (401). authenticated non-admin: empty set. authenticated admin: own-org aggregate.
- Verdict: SAFE. No P0/P1/P2 — admin-gated, read-only, NULL-safe.
### public.get_my_role()
- Exposed: Yes (public). Non-trigger; broad EXECUTE.
- Exact query: `select role from public.users where id = auth.uid();` — row filter is `auth.uid()`.
- Side effects: none. No parameter controls the identity read → no cross-user disclosure.
- anon: `auth.uid()` is NULL → no row. authenticated: exactly the caller's own role.
- Verdict: SAFE (caller-self). INFO: zero callers in repo (legacy-hygiene candidate).
### public.search_legal_corpus(...)
- Exposed: Yes (public). Non-trigger; broad EXECUTE.
- Exact behavior: SELECT-only CTE over `public.search_chunks`, `public.document_versions`,
  `public.documents`, `public.embeddings` — public legal reference corpus, no tenant/case tables.
- Side effects: none (no INSERT/UPDATE/DELETE; `STABLE`).
- anon/authenticated: identical public-corpus results.
- Verdict: SAFE by intent (OPEN_PUBLIC_READ). No P0/P1/P2.
### public.search_legal_corpus_dual(...)
- Exposed: Yes (public). Non-trigger; broad EXECUTE.
- Exact behavior: `plpgsql` builds dynamic SQL with `format()`; interpolations are the
  two embedding vectors and integer limits bound via `%L`/`%s` — no caller string reaches an
  identifier position. SELECT-only over `public.embeddings` + public corpus.
- Side effects: none (`STABLE`).
- anon/authenticated: identical public-corpus results.
- Verdict: SAFE by intent (OPEN_PUBLIC_READ). No P0/P1/P2.
### public.search_legal_unit_chunks_preview(...)
- Exposed: Yes (public). Non-trigger; broad EXECUTE.
- Exact behavior: lexical-score SELECT over `public.search_chunks_legal_unit`; token filter
  from `p_query_text` used only in `LIKE` predicates, never as an identifier.
- Side effects: none (`STABLE`).
- anon/authenticated: identical public-corpus results.
- Verdict: SAFE by intent (OPEN_PUBLIC_READ). No P0/P1/P2.

### Exposed-and-executable routines that are NOT safe (production)
### public.admin_set_user_role(p_user_id uuid, p_role app.app_role)
- Exposed: Yes (public). Non-trigger; **PRODUCTION broad EXECUTE (anon/authenticated)**.
- Exact production guard: `if app.get_my_role() <> 'admin' then raise 42501` — `<>` is
  NULL-unsafe; when `app.get_my_role()` returns NULL the predicate is NULL, the guard is
  skipped, and the SECURITY DEFINER `UPDATE app.user_profiles SET app_role = p_role` proceeds.
- Impact: any anon/authenticated caller can assign arbitrary roles (privilege escalation).
- Verdict: **P0**. Fixed body designed (hotfix 20260717141940) but NOT applied to production.
### public.record_ai_metric(...)
- Exposed: Yes (public). Non-trigger; **PRODUCTION broad EXECUTE (anon/authenticated)**.
- Exact production state: **no authorization guard**; all identity fields
  (`fn_name, model, tokens, cost_usd, latency_ms, status, error_message, case_id, user_id`)
  are caller-controlled; SECURITY DEFINER bypasses RLS on `internal.ai_metrics`.
- Impact: unauthenticated insertion of spoofed/forged metric rows → billing/analytics
  corruption and log/storage amplification.
- Verdict: **P1**. Fixed body designed (PR-A) but NOT applied to production.

## 5. search_path Findings (consistent with Section 2)
Every routine pins `search_path` at the function level, so none is caller-mutable.
Classification here is identical to Section 2 (the prior Section-2-vs-Section-5
contradiction is removed):

- **SAFE_EXPLICIT_EMPTY_PATH** (`SET search_path=''`): app.check_case_upload_access,
  public.get_embedding_metrics.
- **SAFE_PINNED_TRUSTED_PATH** (fixed trusted schema list): app.can_manage_case,
  app.can_read_case, app.get_my_role, app.is_case_lawyer, app.is_case_member,
  public.admin_set_user_role, public.cases_compat_insert, public.get_ai_metrics_summary,
  public.get_my_role, public.handle_new_user, public.record_ai_analysis_run,
  public.record_ai_metric, public.search_legal_corpus, public.search_legal_corpus_dual,
  public.search_legal_unit_chunks_preview.

UNSAFE (unset/inherited/caller-mutable) `search_path` findings = **0**. Note: the P0/P1
on `admin_set_user_role` / `record_ai_metric` are authorization findings, not
`search_path` findings — their paths are pinned and trusted.

## 6. Corrected Orphan Terminology

CONFIRMED_ORPHANS = 0

TRIGGER_DRIFT_CANDIDATES = 1

The single trigger-drift candidate is:

public.cases_compat_insert()

Its exact disposition:

TRIGGER_DRIFT / EXTERNAL_COMPATIBILITY_REVIEW_REQUIRED

- the production function exists;
- production trigger count is zero (staging has cases_insert_tg);
- direct API-role EXECUTE has NOT yet been removed in production (PR-C on HOLD);
- it is not proven safe to drop;
- it is not proven correct to restore the production trigger;
- no PR-D implementation is authorized for it (owned by PR-C).

INFO (legacy-hygiene, not orphan, not a finding): public.get_my_role and
public.search_legal_unit_chunks_preview have zero repository/edge callers.

## 7. Closed-Target vs In-Flight Targets (dual hashes)

Only one target is genuinely closed in production; the previous revision
incorrectly listed four as closed. Each row now carries **both**
`md5(prosrc)` and `md5(pg_get_functiondef)` from the committed evidence.

### A. Genuinely CLOSED in production (excluded from PR-D scope)
- **public.get_embedding_metrics** — remediated & live (PR-B, out-of-band on production ledger).
  - md5(prosrc) = de1ec5a3983b9e6dc5efebeaaa865ec0
  - md5(pg_get_functiondef) = b47444a0382f21eb6035b64141646902
  - Source: PR_B_GET_EMBEDDING_METRICS_EVIDENCE.md §B.

### B. In-flight — remediation designed but NOT applied to production (NOT exclusions; open findings)
- **public.admin_set_user_role** — **P0** (fail-open admin guard). Owner: hotfix 20260717141940 (HOLD).
  - md5(pg_get_functiondef) = 71d960885366c4d4b0a00a610a957664 (production state A, from hotfix header)
  - md5(prosrc) = NOT_INDEPENDENTLY_CAPTURED (no corroborated production `prosrc` hash in evidence; the
    prior report's `b35c1f5b5daf8a054c91192f65730b9c` is uncorroborated and has been withdrawn; must
    be captured read-only from the production catalog before remediation sign-off).
- **public.record_ai_metric** — **P1** (unguarded broad execute). Owner: PR-A (HOLD).
  - md5(prosrc) = e38e47bea9581f2970e12200394fb54a
  - md5(pg_get_functiondef) = a77d65c5466a893c8e5db16aff026902
  - Source: PR_A_RECORD_AI_METRIC_EVIDENCE.md (def_md5/src_md5).
- **public.cases_compat_insert** — **P3** (excess direct EXECUTE on trigger fn). Owner: PR-C (HOLD).
  - md5(prosrc) = b8b6d0f95bb1fb8915f60984637c1dbd
  - md5(pg_get_functiondef) = 93472ba38356e7f957ba04167433b53f
  - Source: PR_C_TRIGGER_FUNCTION_GRANTS_EVIDENCE.md §B (production pre-state).
- **public.handle_new_user** — **P3** (excess direct EXECUTE on active trigger fn). Owner: PR-C (HOLD).
  - md5(prosrc) = 98475b8fbef19a2fde45ddcc79eebc57
  - md5(pg_get_functiondef) = ced5947b7403494228b6ac1dba6c2541
  - Source: PR_C_TRIGGER_FUNCTION_GRANTS_EVIDENCE.md §B (production pre-state).

## Final PR-D decision

Inventory (unchanged):
- scoped project-owned routines = 50; public = 38; app = 8; auth = 4;
- SECURITY DEFINER routines = 17;
- SECURITY DEFINER with broad API-role EXECUTE = 11;
- PostgREST-exposed executable routines = 5 safe + 2 unsafe (`admin_set_user_role`, `record_ai_metric`) = 7 exposed-executable total;
- unsafe search_path findings = 0;
- confirmed orphan routines = 0; trigger-drift candidates = 1.

Recalculated severity (production-first):
- **P0 = 1** — public.admin_set_user_role (fail-open admin guard, broad EXECUTE, exposed) → privilege escalation. Owner: hotfix 20260717141940 (HOLD).
- **P1 = 1** — public.record_ai_metric (unguarded broad EXECUTE, exposed) → metric spoofing/integrity. Owner: PR-A (HOLD).
- **P2 = 0** — no unguarded cross-tenant read/mutation beyond P0/P1; exposed search RPCs are intentional public-corpus reads.
- **P3 = 2** — public.cases_compat_insert, public.handle_new_user (excess direct API-role EXECUTE on trigger functions). Owner: PR-C (HOLD).
- previously remediated & excluded = 1 (get_embedding_metrics, PR-B).
- recommended NEW PR-D implementation targets = 0 (every open finding is already owned by an existing, held PR).
- database changes made by this document = none.

Correction of the prior verdict: the previous `NO_PR_D_REQUIRED` conclusion was
unsound because it (a) mislabelled the production state of `admin_set_user_role`
and `record_ai_metric` as closed/service-role-only and (b) suppressed the live
P0/P1. The corrected discovery surfaces real production findings, but each maps to
an already-designed remediation held in PR-A / PR-C / the admin hotfix (with PR-B
already live), so PR-D proposes **no new implementation of its own**. What remains
is re-review of this corrected, evidence-backed documentation and gating of the
held remediations toward an authorized production deployment.

Final verdict:

READY_FOR_PR_D_DOCUMENTATION_RE_REVIEW

Rationale:
- authorization matrix corrected (effective ACL + exact body guard per routine, replacing the blanket SERVICE_ROLE_ONLY);
- search_path classification made internally consistent (Section 2 == Section 5; two exhaustive safe classes; 0 mutable findings);
- generic PostgREST safety statements replaced with exact per-routine in-body evidence;
- catalog / trigger / policy / view / function-body / repository / Edge caller counts separated and sourced;
- both md5(prosrc) and md5(pg_get_functiondef) recorded for closed and in-flight targets (one production prosrc explicitly flagged as not-yet-captured rather than fabricated);
- P0/P1/P2/P3 recalculated against production truth;
- no production or staging change was made; only this report was modified;
- PR #21 is NOT merged.
