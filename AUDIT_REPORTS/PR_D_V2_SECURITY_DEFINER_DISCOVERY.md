# PR-D V2 Security Definer Discovery (Production-First) — Live-Verified

> **Authority & correction note (this revision).** All state below is verified
> against the **live production catalog** (project `avmgtsonawtzebvazgcr`) via
> read-only `SELECT` on `2026-07-20`, plus the production migration ledger. This
> supersedes any earlier revision that inferred production state from PR
> description text.
>
> **Stale-description warning.** The PR-A/PR-B/PR-C evidence files contain phrases
> such as "DO NOT MERGE", "HOLD", "production unchanged", and "production remains
> on the vulnerable baseline". Those are **stale historical snapshots** written
> *before* the corresponding PRs were merged and applied to production. They are
> **not** the current production source of truth. GitHub merge state
> (PR #15, #17, #18, #19, #20 = MERGED) and the live catalog are authoritative.
> The prior revision of this document wrongly treated those stale snapshots as
> current and manufactured live P0/P1/P3 findings; that is corrected here.
>
> **Live production facts (read-only verified):** production ledger = **52**; the
> five hardening migrations `20260717141940` (admin_set_user_role),
> `20260718180110` (record_ai_metric), `20260718230128` (get_embedding_metrics),
> `20260719000000` (trigger-function EXECUTE revocation), `20260719000001`
> (default-privilege hardening) are each present exactly once. No production or
> staging object was modified to produce this report; only this file changed.

## 0. Evidence provenance and classification methodology

**Production truth source:** live read-only catalog queries against
`avmgtsonawtzebvazgcr` (`pg_proc.proconfig`, `pg_proc.proacl`, `md5(prosrc)`,
`md5(pg_get_functiondef(oid))`, `has_function_privilege`, `has_schema_privilege`,
`pg_trigger`, `supabase_migrations.schema_migrations`). Repository migrations and
PR evidence files are used only for function-body text and caller enumeration,
never as a substitute for live state.

**Authorization taxonomy** (from *effective live ACL* + *actual body guard*):
`OPEN_PUBLIC_READ`, `CALLER_IDENTITY_SELF`, `CALLER_ROLE_GATED_ADMIN`,
`SERVICE_ROLE_ONLY_ACL`, `SERVICE_ROLE_BODY_GUARD`, `TRIGGER_INTERNAL`.
No routine is currently in an `UNGUARDED_BROAD_EXECUTE` or `FAIL_OPEN_ADMIN_GUARD`
state (both were remediated and applied to production).

**`search_path` taxonomy** — two exhaustive classes, applied identically in
Section 2 and Section 5 (the prior Section-2-vs-Section-5 contradiction is gone):
- `SAFE_EXPLICIT_EMPTY_PATH` — live `SET search_path = ''`.
- `SAFE_PINNED_TRUSTED_PATH` — live `SET search_path` to a fixed list of trusted
  schemas (`app`, `public`, `auth`, `internal`, `extensions`, `pg_temp`,
  `pg_catalog`). Live `has_schema_privilege('anon'|'authenticated', <schema>,
  'CREATE') = false` for `app`, `auth`, `extensions`, `internal`, `public`, so API
  roles cannot create shadowing objects on any pinned schema. **0** unset/mutable
  `search_path` findings.

**Caller/dependency provenance** — seven separated dimensions:
`catalog_dependents` (pg_depend: triggers+policies+views), `trigger_refs`
(live `pg_trigger`), `policy_refs` (baseline RLS), `view_refs` (`INSTEAD OF`),
`function_body_refs` (in-scope SECURITY DEFINER callers), `repo_callers`
(non-test `src/` `.rpc()`), `edge_callers` (non-test `supabase/functions/`
`.rpc()`).

## 1. Inventory Reconciliation
- ALL_DATABASE_NON_SYSTEM_ROUTINE_COUNT = 191
- PROJECT_OWNED_SCOPED_ROUTINE_COUNT = 50

### Scoped Catalog Breakdown
- app: 8 (expected 8)
- auth: 4 (expected 4)
- public: 38 (expected 38)

SECURITY DEFINER routines in scope (live count) = 17.

## 2. All 17 SECURITY DEFINER Routines (live state)
### app.can_manage_case(p_case_id uuid)
- **Return Type**: boolean
- **Trigger/Non-Trigger**: non-trigger
- **proconfig (live)**: search_path=app, public, auth
- **Raw ACL (live)**: {=X/postgres,postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
- **anon / authenticated / service_role execute (live)**: true / true / true
- **PostgREST exposure**: NOT_EXPOSED_SCHEMA
- **Authorization**: CALLER_IDENTITY_SELF (body: `app.get_my_role()='admin' OR app.is_case_lawyer(p_case_id)`; both resolve `auth.uid()`)
- **Search_path**: SAFE_PINNED_TRUSTED_PATH
- **Caller/dependency counts**: catalog_dependents=7; trigger_refs=0; policy_refs=7; view_refs=0; function_body_refs=0; repo_callers=0; edge_callers=0
- **Security classification**: NO_PR_D_REQUIRED (not API-reachable; caller-scoped)
### app.can_read_case(p_case_id uuid)
- **Return Type**: boolean
- **Trigger/Non-Trigger**: non-trigger
- **proconfig (live)**: search_path=app, public, auth
- **Raw ACL (live)**: {=X/postgres,postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
- **anon / authenticated / service_role execute (live)**: true / true / true
- **PostgREST exposure**: NOT_EXPOSED_SCHEMA
- **Authorization**: CALLER_IDENTITY_SELF (every branch scoped to `auth.uid()`)
- **Search_path**: SAFE_PINNED_TRUSTED_PATH
- **Caller/dependency counts**: catalog_dependents=29; trigger_refs=0; policy_refs=29; view_refs=0; function_body_refs=0; repo_callers=0; edge_callers=0
- **Security classification**: NO_PR_D_REQUIRED (not API-reachable; caller-scoped)
### app.check_case_upload_access(_case_id uuid)
- **Return Type**: boolean
- **Trigger/Non-Trigger**: non-trigger
- **proconfig (live)**: search_path=""
- **Raw ACL (live)**: none (default; no explicit grants)
- **anon / authenticated / service_role execute (live)**: true / true / true
- **PostgREST exposure**: NOT_EXPOSED_SCHEMA
- **Authorization**: CALLER_IDENTITY_SELF (scoped to `auth.uid()` via app.cases / app.case_members)
- **Search_path**: SAFE_EXPLICIT_EMPTY_PATH
- **Caller/dependency counts**: catalog_dependents=2; trigger_refs=0; policy_refs=2; view_refs=0; function_body_refs=0; repo_callers=0; edge_callers=0
- **Security classification**: NO_PR_D_REQUIRED (not API-reachable; caller-scoped)
### app.get_my_role()
- **Return Type**: app.app_role
- **Trigger/Non-Trigger**: non-trigger
- **proconfig (live)**: search_path=app, public, auth
- **Raw ACL (live)**: {=X/postgres,postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
- **anon / authenticated / service_role execute (live)**: true / true / true
- **PostgREST exposure**: NOT_EXPOSED_SCHEMA
- **Authorization**: CALLER_IDENTITY_SELF (`select up.app_role from app.user_profiles up where up.user_id = auth.uid()`)
- **Search_path**: SAFE_PINNED_TRUSTED_PATH
- **Caller/dependency counts**: catalog_dependents=38; trigger_refs=0; policy_refs=38; view_refs=0; function_body_refs=3 (can_manage_case, can_read_case, get_ai_metrics_summary); repo_callers=0; edge_callers=0
- **Security classification**: NO_PR_D_REQUIRED (not API-reachable; caller-scoped)
### app.is_case_lawyer(p_case_id uuid)
- **Return Type**: boolean
- **Trigger/Non-Trigger**: non-trigger
- **proconfig (live)**: search_path=app, public, auth
- **Raw ACL (live)**: {=X/postgres,postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
- **anon / authenticated / service_role execute (live)**: true / true / true
- **PostgREST exposure**: NOT_EXPOSED_SCHEMA
- **Authorization**: CALLER_IDENTITY_SELF (`c.lawyer_id = auth.uid()`)
- **Search_path**: SAFE_PINNED_TRUSTED_PATH
- **Caller/dependency counts**: catalog_dependents=3; trigger_refs=0; policy_refs=3; view_refs=0; function_body_refs=2 (can_manage_case, can_read_case); repo_callers=0; edge_callers=0
- **Security classification**: NO_PR_D_REQUIRED (not API-reachable; caller-scoped)
### app.is_case_member(p_case_id uuid)
- **Return Type**: boolean
- **Trigger/Non-Trigger**: non-trigger
- **proconfig (live)**: search_path=app, public, auth
- **Raw ACL (live)**: {=X/postgres,postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
- **anon / authenticated / service_role execute (live)**: true / true / true
- **PostgREST exposure**: NOT_EXPOSED_SCHEMA
- **Authorization**: CALLER_IDENTITY_SELF (`cm.user_id = auth.uid()`)
- **Search_path**: SAFE_PINNED_TRUSTED_PATH
- **Caller/dependency counts**: catalog_dependents=0; trigger_refs=0; policy_refs=0; view_refs=0; function_body_refs=1 (can_read_case); repo_callers=0; edge_callers=0
- **Security classification**: NO_PR_D_REQUIRED (not API-reachable; caller-scoped)
### public.admin_set_user_role(p_user_id uuid, p_role app.app_role)
- **Return Type**: void
- **Trigger/Non-Trigger**: non-trigger
- **proconfig (live)**: search_path=""
- **Raw ACL (live)**: {postgres=X/postgres,service_role=X/postgres}
- **anon / authenticated / service_role execute (live)**: false / false / true
- **PostgREST exposure**: EXPOSED_BUT_NO_EXECUTE
- **Authorization**: SERVICE_ROLE_BODY_GUARD (fail-closed `auth.jwt()->>'role' = 'service_role'`) + SERVICE_ROLE_ONLY_ACL
- **Search_path**: SAFE_EXPLICIT_EMPTY_PATH
- **md5(prosrc) / md5(pg_get_functiondef) (live)**: b35c1f5b5daf8a054c91192f65730b9c / 2b548eaa391ca4cf82afac87c94e66a4
- **Caller/dependency counts**: catalog_dependents=0; trigger_refs=0; policy_refs=0; view_refs=0; function_body_refs=0; repo_callers=0; edge_callers=0 (3 references are test-harness only)
- **Security classification**: CLOSED / SERVICE_ROLE_ONLY (hardening `20260717141940` applied to production). Not a current P0.
### public.cases_compat_insert()
- **Return Type**: trigger
- **Trigger/Non-Trigger**: trigger
- **proconfig (live)**: search_path=app, public, auth, pg_temp
- **Raw ACL (live)**: {postgres=X/postgres,service_role=X/postgres}
- **anon / authenticated / service_role execute (live)**: false / false / true
- **PostgREST exposure**: TRIGGER_ONLY
- **Authorization**: TRIGGER_INTERNAL (direct API-role EXECUTE already revoked)
- **Search_path**: SAFE_PINNED_TRUSTED_PATH
- **md5(prosrc) / md5(pg_get_functiondef) (live)**: b8b6d0f95bb1fb8915f60984637c1dbd / 93472ba38356e7f957ba04167433b53f
- **Caller/dependency counts**: live production trigger_refs=0 (function exists, no registered trigger); policy_refs=0; view_refs=1 (public.cases INSTEAD OF INSERT, drift); function_body_refs=0; repo_callers=0; edge_callers=0
- **Security classification**: ACL_CLOSED_UNDER_PR_C. TRIGGER_DRIFT / EXTERNAL_COMPATIBILITY_REVIEW_REQUIRED. Not a current P3 excessive-grant finding.
### public.get_ai_metrics_summary(p_days integer)
- **Return Type**: TABLE(day date, fn_name text, model text, calls bigint, total_tokens bigint, cost_usd numeric, avg_latency_ms numeric, failures bigint)
- **Trigger/Non-Trigger**: non-trigger
- **proconfig (live)**: search_path=internal, public, auth, pg_temp
- **Raw ACL (live)**: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
- **anon / authenticated / service_role execute (live)**: false / true / true
- **PostgREST exposure**: EXPOSED_AND_EXECUTABLE
- **Authorization**: CALLER_ROLE_GATED_ADMIN (`if app.get_my_role() is distinct from 'admin' then return; end if;` — NULL-safe; non-admins get an empty set)
- **Search_path**: SAFE_PINNED_TRUSTED_PATH
- **Caller/dependency counts**: catalog_dependents=0; trigger_refs=0; policy_refs=0; view_refs=0; function_body_refs=0; repo_callers=1 (src/components/UsageMonitor.tsx:146); edge_callers=0
- **Security classification**: NO_PR_D_REQUIRED (admin-gated, read-only, NULL-safe)
### public.get_embedding_metrics(p_model text)
- **Return Type**: TABLE(model text, total_chunks bigint, embedded bigint, pending bigint, failed bigint, est_total_tokens bigint, est_total_cost_usd numeric, est_remaining_cost_usd numeric)
- **Trigger/Non-Trigger**: non-trigger
- **proconfig (live)**: search_path=""
- **Raw ACL (live)**: {postgres=X/postgres,service_role=X/postgres}
- **anon / authenticated / service_role execute (live)**: false / false / true
- **PostgREST exposure**: EXPOSED_BUT_NO_EXECUTE
- **Authorization**: SERVICE_ROLE_BODY_GUARD + SERVICE_ROLE_ONLY_ACL
- **Search_path**: SAFE_EXPLICIT_EMPTY_PATH
- **md5(prosrc) / md5(pg_get_functiondef) (live)**: de1ec5a3983b9e6dc5efebeaaa865ec0 / b47444a0382f21eb6035b64141646902
- **Caller/dependency counts**: catalog_dependents=0; trigger_refs=0; policy_refs=0; view_refs=0; function_body_refs=0; repo_callers=0; edge_callers=0
- **Security classification**: CLOSED / SERVICE_ROLE_ONLY (hardening `20260718230128` applied to production)
### public.get_my_role()
- **Return Type**: text
- **Trigger/Non-Trigger**: non-trigger
- **proconfig (live)**: search_path=public
- **Raw ACL (live)**: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
- **anon / authenticated / service_role execute (live)**: true / true / true
- **PostgREST exposure**: EXPOSED_AND_EXECUTABLE
- **Authorization**: CALLER_IDENTITY_SELF (`select role from public.users where id = auth.uid()`; returns only the caller's own row)
- **Search_path**: SAFE_PINNED_TRUSTED_PATH
- **Caller/dependency counts**: catalog_dependents=0; trigger_refs=0; policy_refs=0; view_refs=0; function_body_refs=0; repo_callers=0; edge_callers=0
- **Security classification**: NO_PR_D_REQUIRED (caller-self read). INFO: no repo caller — legacy-hygiene candidate, not a vulnerability.
### public.handle_new_user()
- **Return Type**: trigger
- **Trigger/Non-Trigger**: trigger
- **proconfig (live)**: search_path=public, app
- **Raw ACL (live)**: {postgres=X/postgres,service_role=X/postgres}
- **anon / authenticated / service_role execute (live)**: false / false / true
- **PostgREST exposure**: TRIGGER_ONLY
- **Authorization**: TRIGGER_INTERNAL (direct API-role EXECUTE already revoked)
- **Search_path**: SAFE_PINNED_TRUSTED_PATH
- **md5(prosrc) / md5(pg_get_functiondef) (live)**: 98475b8fbef19a2fde45ddcc79eebc57 / ced5947b7403494228b6ac1dba6c2541
- **Caller/dependency counts**: catalog_dependents=1; trigger_refs=1 (on_auth_user_created, enabled, live); policy_refs=0; view_refs=0; function_body_refs=0; repo_callers=0; edge_callers=0
- **Security classification**: ACL_CLOSED_UNDER_PR_C. TRIGGER_INTERNAL (active, legitimate trigger). Not a current P3 excessive-grant finding.
### public.record_ai_analysis_run(p_case_id uuid, p_result jsonb, p_query text, p_model text)
- **Return Type**: TABLE(run_id uuid, case_id uuid)
- **Trigger/Non-Trigger**: non-trigger
- **proconfig (live)**: search_path=pg_catalog, app, public
- **Raw ACL (live)**: {postgres=X/postgres,service_role=X/postgres}
- **anon / authenticated / service_role execute (live)**: false / false / true
- **PostgREST exposure**: EXPOSED_BUT_NO_EXECUTE
- **Authorization**: SERVICE_ROLE_ONLY_ACL (body uses `auth.uid()` fallback for attribution)
- **Search_path**: SAFE_PINNED_TRUSTED_PATH
- **Caller/dependency counts**: catalog_dependents=0; trigger_refs=0; policy_refs=0; view_refs=0; function_body_refs=0; repo_callers=0; edge_callers=0
- **Security classification**: NO_PR_D_REQUIRED (no API-role EXECUTE)
### public.record_ai_metric(p_fn_name text, p_model text, p_input_tokens integer, p_output_tokens integer, p_cost_usd numeric, p_latency_ms integer, p_status text, p_error_message text, p_case_id uuid, p_user_id uuid)
- **Return Type**: void
- **Trigger/Non-Trigger**: non-trigger
- **proconfig (live)**: search_path=""
- **Raw ACL (live)**: {postgres=X/postgres,service_role=X/postgres}
- **anon / authenticated / service_role execute (live)**: false / false / true
- **PostgREST exposure**: EXPOSED_BUT_NO_EXECUTE
- **Authorization**: SERVICE_ROLE_BODY_GUARD (fail-closed `auth.jwt()->>'role' = 'service_role'`) + SERVICE_ROLE_ONLY_ACL
- **Search_path**: SAFE_EXPLICIT_EMPTY_PATH
- **md5(prosrc) / md5(pg_get_functiondef) (live)**: a6a22938019a964b5c499d1fcb5bb626 / 2053521782327872288c1bcdbe1b801a
- **Caller/dependency counts**: catalog_dependents=0; trigger_refs=0; policy_refs=0; view_refs=0; function_body_refs=0; repo_callers=0; edge_callers=1 (supabase/functions/_shared/ai-metrics.ts:35 → service-role edge functions)
- **Security classification**: CLOSED / SERVICE_ROLE_ONLY (hardening `20260718180110` applied to production). Not a current P1.
### public.search_legal_corpus(p_query_text text, p_query_embedding vector, p_content_domain content_domain, p_norm_status normalized_status, p_effective_at date, p_language_code text, p_limit integer, p_offset integer)
- **Return Type**: TABLE(...) hybrid search result set
- **Trigger/Non-Trigger**: non-trigger
- **proconfig (live)**: search_path=public, extensions, pg_temp, statement_timeout=60000
- **Raw ACL (live)**: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
- **anon / authenticated / service_role execute (live)**: true / true / true
- **PostgREST exposure**: EXPOSED_AND_EXECUTABLE
- **Authorization**: OPEN_PUBLIC_READ (no guard; SELECT-only over public reference corpus)
- **Search_path**: SAFE_PINNED_TRUSTED_PATH
- **Caller/dependency counts**: catalog_dependents=0; trigger_refs=0; policy_refs=0; view_refs=0; function_body_refs=0; repo_callers=0; edge_callers=0 (edge paths use *_metric / *_dual variants)
- **Security classification**: NO_PR_D_REQUIRED (intentional public legal-corpus read; no tenant rows)
### public.search_legal_corpus_dual(p_query_text text, p_metric_embedding vector, p_qwen_embedding vector, p_content_domain content_domain, p_norm_status normalized_status, p_limit integer, p_metric_limit integer, p_qwen_limit integer, p_bm25_limit integer, p_effective_at date)
- **Return Type**: TABLE(...) dual-retrieval result set
- **Trigger/Non-Trigger**: non-trigger
- **proconfig (live)**: search_path=public, extensions, pg_temp, statement_timeout=60000
- **Raw ACL (live)**: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
- **anon / authenticated / service_role execute (live)**: true / true / true
- **PostgREST exposure**: EXPOSED_AND_EXECUTABLE
- **Authorization**: OPEN_PUBLIC_READ (dynamic SQL binds only embeddings/limits via `%L`/`%s`; SELECT-only over public corpus)
- **Search_path**: SAFE_PINNED_TRUSTED_PATH
- **Caller/dependency counts**: catalog_dependents=0; trigger_refs=0; policy_refs=0; view_refs=0; function_body_refs=0; repo_callers=0; edge_callers=2 (kb-unified-search/index.ts:59, vector-search/index.ts:78)
- **Security classification**: NO_PR_D_REQUIRED (intentional public legal-corpus read; no tenant rows)
### public.search_legal_unit_chunks_preview(p_query_text text, p_limit integer, p_content_domain content_domain, p_language text, p_effective_at date)
- **Return Type**: TABLE(...) legal-unit preview result set
- **Trigger/Non-Trigger**: non-trigger
- **proconfig (live)**: search_path=public
- **Raw ACL (live)**: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
- **anon / authenticated / service_role execute (live)**: true / true / true
- **PostgREST exposure**: EXPOSED_AND_EXECUTABLE
- **Authorization**: OPEN_PUBLIC_READ (lexical SELECT-only over public.search_chunks_legal_unit)
- **Search_path**: SAFE_PINNED_TRUSTED_PATH
- **Caller/dependency counts**: catalog_dependents=0; trigger_refs=0; policy_refs=0; view_refs=0; function_body_refs=0; repo_callers=0; edge_callers=0
- **Security classification**: NO_PR_D_REQUIRED (intentional public legal-corpus read; no tenant rows)

## 3. Reconcile the Broad-Execute Routines (live)
The 11 routines with broad API-role EXECUTE are all inert or intentional:

**Not PostgREST-reachable (schema `app` not exposed) — caller-scoped helpers:**
- app.can_manage_case, app.can_read_case, app.check_case_upload_access,
  app.get_my_role, app.is_case_lawyer, app.is_case_member — each scoped by
  `auth.uid()`; broad grant is inert externally.

**PostgREST-exposed and safe:**
- public.get_ai_metrics_summary — admin-gated, NULL-safe early-return.
- public.get_my_role — caller-self row only.
- public.search_legal_corpus / search_legal_corpus_dual /
  search_legal_unit_chunks_preview — SELECT-only public corpus, no tenant rows.

No broad-execute routine is currently unsafe. The three functions that previously
carried broad *anon/authenticated* EXECUTE with a weak/absent guard
(`admin_set_user_role`, `record_ai_metric`, and the trigger pair) have had those
grants **revoked in production** (verified: anon=false, authenticated=false).

## 4. PostgREST-Exposed Executable Routines (exact evidence)
Five routines are `EXPOSED_AND_EXECUTABLE` with a live API-role EXECUTE grant:

- **get_ai_metrics_summary** — guard `if app.get_my_role() is distinct from 'admin' then return; end if;` (NULL-safe). Read-only aggregate over `internal.ai_metrics`. anon has no EXECUTE. SAFE.
- **get_my_role** — `select role from public.users where id = auth.uid();`. Row filter is `auth.uid()`; no parameter selects another user. SAFE (caller-self).
- **search_legal_corpus** — SELECT-only over `public.search_chunks/document_versions/documents/embeddings`; `STABLE`; no mutation; no tenant tables. SAFE (open public read).
- **search_legal_corpus_dual** — `plpgsql` dynamic SQL; interpolations are embeddings + integer limits via `%L`/`%s`; no caller string reaches an identifier; SELECT-only. SAFE (open public read).
- **search_legal_unit_chunks_preview** — lexical SELECT over `public.search_chunks_legal_unit`; query tokens only in `LIKE` predicates. SAFE (open public read).

`admin_set_user_role`, `record_ai_metric`, `get_embedding_metrics`, and
`record_ai_analysis_run` are `EXPOSED_BUT_NO_EXECUTE` (no API-role EXECUTE) and are
therefore not in the exposed-executable set. No P0/P1/P2 among any exposed routine.

## 5. search_path Findings (consistent with Section 2)
Every routine pins `search_path` at the function level; none is caller-mutable.

- **SAFE_EXPLICIT_EMPTY_PATH** (`SET search_path=''`, live): app.check_case_upload_access,
  public.admin_set_user_role, public.get_embedding_metrics, public.record_ai_metric.
- **SAFE_PINNED_TRUSTED_PATH** (fixed trusted schema list, live): app.can_manage_case,
  app.can_read_case, app.get_my_role, app.is_case_lawyer, app.is_case_member,
  public.cases_compat_insert, public.get_ai_metrics_summary, public.get_my_role,
  public.handle_new_user, public.record_ai_analysis_run, public.search_legal_corpus,
  public.search_legal_corpus_dual, public.search_legal_unit_chunks_preview.

Live evidence for "trusted": `has_schema_privilege('anon', s, 'CREATE')` and
`has_schema_privilege('authenticated', s, 'CREATE')` are both **false** for
`app`, `auth`, `extensions`, `internal`, `public`. API roles cannot create
shadowing objects on any pinned schema. This is asserted from live
`has_schema_privilege(...)` checks, not from default-privilege configuration alone.

UNSAFE (unset/inherited/caller-mutable) `search_path` findings = **0**.

## 6. Corrected Orphan Terminology (live)

CONFIRMED_ORPHANS = 0

TRIGGER_DRIFT_CANDIDATES = 1 → public.cases_compat_insert()

Live disposition: TRIGGER_DRIFT / EXTERNAL_COMPATIBILITY_REVIEW_REQUIRED
- the production function exists;
- live production trigger count for it is **0** (staging retains `cases_insert_tg`);
- direct API-role EXECUTE is already revoked in production (ACL = {postgres, service_role});
- it is not proven safe to drop, nor proven correct to restore the production trigger;
- no PR-D implementation is authorized for it.

Do not drop it, restore its trigger, classify it as an orphan, or classify its ACL
as vulnerable. INFO (legacy-hygiene, not orphan/finding): public.get_my_role and
public.search_legal_unit_chunks_preview have zero repository/edge callers.

## 7. Target Hardening Status (dual hashes, live)

All targets are CLOSED in production. Each row carries both live hashes.

- **public.admin_set_user_role** — CLOSED / SERVICE_ROLE_ONLY (migration `20260717141940` applied).
  - md5(prosrc) = b35c1f5b5daf8a054c91192f65730b9c
  - md5(pg_get_functiondef) = 2b548eaa391ca4cf82afac87c94e66a4
- **public.record_ai_metric** — CLOSED / SERVICE_ROLE_ONLY (migration `20260718180110` applied).
  - md5(prosrc) = a6a22938019a964b5c499d1fcb5bb626
  - md5(pg_get_functiondef) = 2053521782327872288c1bcdbe1b801a
- **public.get_embedding_metrics** — CLOSED / SERVICE_ROLE_ONLY (migration `20260718230128` applied).
  - md5(prosrc) = de1ec5a3983b9e6dc5efebeaaa865ec0
  - md5(pg_get_functiondef) = b47444a0382f21eb6035b64141646902
- **public.cases_compat_insert** — ACL_CLOSED_UNDER_PR_C; TRIGGER_DRIFT / EXTERNAL_COMPATIBILITY_REVIEW_REQUIRED.
  - md5(prosrc) = b8b6d0f95bb1fb8915f60984637c1dbd
  - md5(pg_get_functiondef) = 93472ba38356e7f957ba04167433b53f
- **public.handle_new_user** — ACL_CLOSED_UNDER_PR_C; TRIGGER_INTERNAL (active trigger).
  - md5(prosrc) = 98475b8fbef19a2fde45ddcc79eebc57
  - md5(pg_get_functiondef) = ced5947b7403494228b6ac1dba6c2541

The PR-C trigger-function ACL hardening (`20260719000000`) and the PR-F
default-privilege hardening (`20260719000001`) are both applied to production
(ledger 52).

## Final PR-D decision (live-verified)

Inventory:
- PROJECT_OWNED_SCOPED_ROUTINE_COUNT = 50 (public 38, app 8, auth 4)
- SECURITY_DEFINER_COUNT = 17
- BROAD_EXECUTE_COUNT = 11
- VERIFIED_POSTGREST_EXPOSED_COUNT = 5
- UNSAFE_SEARCH_PATH_COUNT = 0

Findings (current live production):
- P0_FINDINGS = 0
- P1_FINDINGS = 0
- ACTIONABLE_P2_FINDINGS = 0
- P3_ACL_FINDINGS = 0
- CONFIRMED_ORPHANS = 0
- TRIGGER_DRIFT_CANDIDATES = 1 (public.cases_compat_insert)
- RECOMMENDED_PR_D_TARGETS = 0
- DATABASE_CHANGES = NONE (read-only verification only)

Why no findings remain: the earlier revision inferred an unhardened production from
stale "HOLD / DO NOT MERGE / production unchanged" PR text. Live verification shows
those PRs are merged and applied — `admin_set_user_role`, `record_ai_metric`,
`get_embedding_metrics` are all service-role-only with `search_path=''`, and the
trigger functions `cases_compat_insert` / `handle_new_user` have had direct
API-role EXECUTE revoked. The single trigger-drift candidate is documentation /
external-compatibility follow-up, not a security finding and not a PR-D target.

Security decision:

NO_PR_D_REQUIRED

Document workflow verdict:

READY_FOR_PR_D_DOCUMENTATION_RE_REVIEW

- authorization matrix reflects effective live ACL + exact body guard per routine;
- search_path classification is internally consistent (Section 2 == Section 5), backed by live `has_schema_privilege` CREATE=false; 0 mutable findings;
- generic PostgREST safety statements replaced with exact per-routine evidence;
- catalog / trigger / policy / view / function-body / repository / Edge caller counts separated;
- both md5(prosrc) and md5(pg_get_functiondef) recorded per target, all live;
- P0/P1/P2/P3 recalculated against the live production catalog (all 0; ledger 52);
- stale PR-description text explicitly flagged as non-authoritative;
- no production or staging change was made; only this report was modified;
- PR #21 is NOT merged.
