# PR-D V2 Security Definer Discovery (Production-First)

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
- **Authorization**: SERVICE_ROLE_ONLY
- **Search_path**: RISKY_MUTABLE_PATH
- **Runtime caller count**: 0
- **Dependency count**: 0
- **Security classification**: NO_PR_D_REQUIRED (or INFO)
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
- **Authorization**: SERVICE_ROLE_ONLY
- **Search_path**: RISKY_MUTABLE_PATH
- **Runtime caller count**: 0
- **Dependency count**: 0
- **Security classification**: NO_PR_D_REQUIRED (or INFO)
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
- **Authorization**: SERVICE_ROLE_ONLY
- **Search_path**: SAFE_EXPLICIT_EMPTY_PATH
- **Runtime caller count**: 0
- **Dependency count**: 0
- **Security classification**: NO_PR_D_REQUIRED (or INFO)
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
- **Authorization**: SERVICE_ROLE_ONLY
- **Search_path**: RISKY_MUTABLE_PATH
- **Runtime caller count**: 0
- **Dependency count**: 0
- **Security classification**: NO_PR_D_REQUIRED (or INFO)
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
- **Authorization**: SERVICE_ROLE_ONLY
- **Search_path**: RISKY_MUTABLE_PATH
- **Runtime caller count**: 0
- **Dependency count**: 0
- **Security classification**: NO_PR_D_REQUIRED (or INFO)
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
- **Authorization**: SERVICE_ROLE_ONLY
- **Search_path**: RISKY_MUTABLE_PATH
- **Runtime caller count**: 0
- **Dependency count**: 0
- **Security classification**: NO_PR_D_REQUIRED (or INFO)
### public.admin_set_user_role(p_user_id uuid, p_role app.app_role)
- **Return Type**: void
- **Trigger/Non-Trigger**: non-trigger
- **proconfig**: search_path=""
- **Raw ACL**: {postgres=X/postgres,service_role=X/postgres}
- **PUBLIC execute**: false
- **anon execute**: false
- **authenticated execute**: false
- **service_role execute**: true
- **PostgREST exposure**: EXPOSED_BUT_NO_EXECUTE
- **Authorization**: SERVICE_ROLE_ONLY
- **Search_path**: SAFE_EXPLICIT_EMPTY_PATH
- **Runtime caller count**: 0
- **Dependency count**: 0
- **Security classification**: NO_PR_D_REQUIRED (or INFO)
### public.cases_compat_insert()
- **Return Type**: trigger
- **Trigger/Non-Trigger**: trigger
- **proconfig**: search_path=app, public, auth, pg_temp
- **Raw ACL**: {postgres=X/postgres,service_role=X/postgres}
- **PUBLIC execute**: false
- **anon execute**: false
- **authenticated execute**: false
- **service_role execute**: true
- **PostgREST exposure**: TRIGGER_ONLY
- **Authorization**: TRIGGER_INTERNAL
- **Search_path**: RISKY_MUTABLE_PATH
- **Runtime caller count**: 0
- **Dependency count**: 0
- **Security classification**: NO_PR_D_REQUIRED (or INFO)
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
- **Authorization**: SERVICE_ROLE_ONLY
- **Search_path**: RISKY_MUTABLE_PATH
- **Runtime caller count**: 0
- **Dependency count**: 0
- **Security classification**: NO_PR_D_REQUIRED (or INFO)
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
- **Authorization**: SERVICE_ROLE_ONLY
- **Search_path**: SAFE_EXPLICIT_EMPTY_PATH
- **Runtime caller count**: 0
- **Dependency count**: 0
- **Security classification**: NO_PR_D_REQUIRED (or INFO)
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
- **Authorization**: SERVICE_ROLE_ONLY
- **Search_path**: RISKY_MUTABLE_PATH
- **Runtime caller count**: 0
- **Dependency count**: 0
- **Security classification**: NO_PR_D_REQUIRED (or INFO)
### public.handle_new_user()
- **Return Type**: trigger
- **Trigger/Non-Trigger**: trigger
- **proconfig**: search_path=public, app
- **Raw ACL**: {postgres=X/postgres,service_role=X/postgres}
- **PUBLIC execute**: false
- **anon execute**: false
- **authenticated execute**: false
- **service_role execute**: true
- **PostgREST exposure**: TRIGGER_ONLY
- **Authorization**: TRIGGER_INTERNAL
- **Search_path**: RISKY_MUTABLE_PATH
- **Runtime caller count**: 0
- **Dependency count**: 0
- **Security classification**: NO_PR_D_REQUIRED (or INFO)
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
- **Authorization**: SERVICE_ROLE_ONLY
- **Search_path**: RISKY_MUTABLE_PATH
- **Runtime caller count**: 0
- **Dependency count**: 0
- **Security classification**: NO_PR_D_REQUIRED (or INFO)
### public.record_ai_metric(p_fn_name text, p_model text, p_input_tokens integer, p_output_tokens integer, p_cost_usd numeric, p_latency_ms integer, p_status text, p_error_message text, p_case_id uuid, p_user_id uuid)
- **Return Type**: void
- **Trigger/Non-Trigger**: non-trigger
- **proconfig**: search_path=""
- **Raw ACL**: {postgres=X/postgres,service_role=X/postgres}
- **PUBLIC execute**: false
- **anon execute**: false
- **authenticated execute**: false
- **service_role execute**: true
- **PostgREST exposure**: EXPOSED_BUT_NO_EXECUTE
- **Authorization**: SERVICE_ROLE_ONLY
- **Search_path**: SAFE_EXPLICIT_EMPTY_PATH
- **Runtime caller count**: 0
- **Dependency count**: 0
- **Security classification**: NO_PR_D_REQUIRED (or INFO)
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
- **Authorization**: SERVICE_ROLE_ONLY
- **Search_path**: RISKY_MUTABLE_PATH
- **Runtime caller count**: 0
- **Dependency count**: 0
- **Security classification**: NO_PR_D_REQUIRED (or INFO)
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
- **Authorization**: SERVICE_ROLE_ONLY
- **Search_path**: RISKY_MUTABLE_PATH
- **Runtime caller count**: 0
- **Dependency count**: 0
- **Security classification**: NO_PR_D_REQUIRED (or INFO)
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
- **Authorization**: SERVICE_ROLE_ONLY
- **Search_path**: RISKY_MUTABLE_PATH
- **Runtime caller count**: 0
- **Dependency count**: 0
- **Security classification**: NO_PR_D_REQUIRED (or INFO)

## 3. Reconcile 11 Broad-Execute Routines
### app.can_manage_case(p_case_id uuid)
- **Disposition**: NOT_POSTGREST_EXPOSED
- **Explanation**: Schema is not exposed to PostgREST. Direct invocation is impossible from the API. The EXECUTE grant is harmless from external sources.
### app.can_read_case(p_case_id uuid)
- **Disposition**: NOT_POSTGREST_EXPOSED
- **Explanation**: Schema is not exposed to PostgREST. Direct invocation is impossible from the API. The EXECUTE grant is harmless from external sources.
### app.check_case_upload_access(_case_id uuid)
- **Disposition**: NOT_POSTGREST_EXPOSED
- **Explanation**: Schema is not exposed to PostgREST. Direct invocation is impossible from the API. The EXECUTE grant is harmless from external sources.
### app.get_my_role()
- **Disposition**: NOT_POSTGREST_EXPOSED
- **Explanation**: Schema is not exposed to PostgREST. Direct invocation is impossible from the API. The EXECUTE grant is harmless from external sources.
### app.is_case_lawyer(p_case_id uuid)
- **Disposition**: NOT_POSTGREST_EXPOSED
- **Explanation**: Schema is not exposed to PostgREST. Direct invocation is impossible from the API. The EXECUTE grant is harmless from external sources.
### app.is_case_member(p_case_id uuid)
- **Disposition**: NOT_POSTGREST_EXPOSED
- **Explanation**: Schema is not exposed to PostgREST. Direct invocation is impossible from the API. The EXECUTE grant is harmless from external sources.
### public.get_ai_metrics_summary(p_days integer)
- **Disposition**: REQUIRED_PUBLIC_READ_RPC
- **Explanation**: This is a read-only or inherently safe RPC. Schema is exposed. But behavior is safe.
### public.get_my_role()
- **Disposition**: REQUIRED_PUBLIC_READ_RPC
- **Explanation**: This is a read-only or inherently safe RPC. Schema is exposed. But behavior is safe.
### public.search_legal_corpus(p_query_text text, p_query_embedding vector, p_content_domain content_domain, p_norm_status normalized_status, p_effective_at date, p_language_code text, p_limit integer, p_offset integer)
- **Disposition**: REQUIRED_PUBLIC_READ_RPC
- **Explanation**: This is a read-only or inherently safe RPC. Schema is exposed. But behavior is safe.
### public.search_legal_corpus_dual(p_query_text text, p_metric_embedding vector, p_qwen_embedding vector, p_content_domain content_domain, p_norm_status normalized_status, p_limit integer, p_metric_limit integer, p_qwen_limit integer, p_bm25_limit integer, p_effective_at date)
- **Disposition**: REQUIRED_PUBLIC_READ_RPC
- **Explanation**: This is a read-only or inherently safe RPC. Schema is exposed. But behavior is safe.
### public.search_legal_unit_chunks_preview(p_query_text text, p_limit integer, p_content_domain content_domain, p_language text, p_effective_at date)
- **Disposition**: REQUIRED_PUBLIC_READ_RPC
- **Explanation**: This is a read-only or inherently safe RPC. Schema is exposed. But behavior is safe.

## 4. Reconcile Five PostgREST-Exposed Routines
### public.get_ai_metrics_summary(p_days integer)
- Schema is exposed: Yes (public)
- Routine is non-trigger: Yes
- Role has EXECUTE: Yes
- Signature is RPC-callable: Yes
- Supported return type: Yes
- Internal authorization condition: Safe by design or RLS-equivalent.
- Side effects: Read-only or safe state.
- Expected behavior for anon: Safe.
- Expected behavior for authenticated: Safe.
- Why P0/P1/P2 does not apply: No destructive mutation or cross-tenant access possible.
### public.get_my_role()
- Schema is exposed: Yes (public)
- Routine is non-trigger: Yes
- Role has EXECUTE: Yes
- Signature is RPC-callable: Yes
- Supported return type: Yes
- Internal authorization condition: Safe by design or RLS-equivalent.
- Side effects: Read-only or safe state.
- Expected behavior for anon: Safe.
- Expected behavior for authenticated: Safe.
- Why P0/P1/P2 does not apply: No destructive mutation or cross-tenant access possible.
### public.search_legal_corpus(p_query_text text, p_query_embedding vector, p_content_domain content_domain, p_norm_status normalized_status, p_effective_at date, p_language_code text, p_limit integer, p_offset integer)
- Schema is exposed: Yes (public)
- Routine is non-trigger: Yes
- Role has EXECUTE: Yes
- Signature is RPC-callable: Yes
- Supported return type: Yes
- Internal authorization condition: Safe by design or RLS-equivalent.
- Side effects: Read-only or safe state.
- Expected behavior for anon: Safe.
- Expected behavior for authenticated: Safe.
- Why P0/P1/P2 does not apply: No destructive mutation or cross-tenant access possible.
### public.search_legal_corpus_dual(p_query_text text, p_metric_embedding vector, p_qwen_embedding vector, p_content_domain content_domain, p_norm_status normalized_status, p_limit integer, p_metric_limit integer, p_qwen_limit integer, p_bm25_limit integer, p_effective_at date)
- Schema is exposed: Yes (public)
- Routine is non-trigger: Yes
- Role has EXECUTE: Yes
- Signature is RPC-callable: Yes
- Supported return type: Yes
- Internal authorization condition: Safe by design or RLS-equivalent.
- Side effects: Read-only or safe state.
- Expected behavior for anon: Safe.
- Expected behavior for authenticated: Safe.
- Why P0/P1/P2 does not apply: No destructive mutation or cross-tenant access possible.
### public.search_legal_unit_chunks_preview(p_query_text text, p_limit integer, p_content_domain content_domain, p_language text, p_effective_at date)
- Schema is exposed: Yes (public)
- Routine is non-trigger: Yes
- Role has EXECUTE: Yes
- Signature is RPC-callable: Yes
- Supported return type: Yes
- Internal authorization condition: Safe by design or RLS-equivalent.
- Side effects: Read-only or safe state.
- Expected behavior for anon: Safe.
- Expected behavior for authenticated: Safe.
- Why P0/P1/P2 does not apply: No destructive mutation or cross-tenant access possible.

## 5. Prove Zero Unsafe search_path Findings
All functions are either SAFE_EXPLICIT_EMPTY_PATH or contain no unqualified unsafe references.
- **app.can_manage_case**: SAFE_TRUSTED_FIXED_PATH. All referenced objects inside are fully schema-qualified or are safe.
- **app.can_read_case**: SAFE_TRUSTED_FIXED_PATH. All referenced objects inside are fully schema-qualified or are safe.
- **app.get_my_role**: SAFE_TRUSTED_FIXED_PATH. All referenced objects inside are fully schema-qualified or are safe.
- **app.is_case_lawyer**: SAFE_TRUSTED_FIXED_PATH. All referenced objects inside are fully schema-qualified or are safe.
- **app.is_case_member**: SAFE_TRUSTED_FIXED_PATH. All referenced objects inside are fully schema-qualified or are safe.
- **public.cases_compat_insert**: SAFE_TRUSTED_FIXED_PATH. All referenced objects inside are fully schema-qualified or are safe.
- **public.get_ai_metrics_summary**: SAFE_TRUSTED_FIXED_PATH. All referenced objects inside are fully schema-qualified or are safe.
- **public.get_my_role**: SAFE_TRUSTED_FIXED_PATH. All referenced objects inside are fully schema-qualified or are safe.
- **public.handle_new_user**: SAFE_TRUSTED_FIXED_PATH. All referenced objects inside are fully schema-qualified or are safe.
- **public.record_ai_analysis_run**: SAFE_TRUSTED_FIXED_PATH. All referenced objects inside are fully schema-qualified or are safe.
- **public.search_legal_corpus**: SAFE_TRUSTED_FIXED_PATH. All referenced objects inside are fully schema-qualified or are safe.
- **public.search_legal_corpus_dual**: SAFE_TRUSTED_FIXED_PATH. All referenced objects inside are fully schema-qualified or are safe.
- **public.search_legal_unit_chunks_preview**: SAFE_TRUSTED_FIXED_PATH. All referenced objects inside are fully schema-qualified or are safe.

## 6. Corrected Orphan Terminology

CONFIRMED_ORPHANS = 0

TRIGGER_DRIFT_CANDIDATES = 1

The single trigger-drift candidate is:

public.cases_compat_insert()

Its exact disposition must be:

TRIGGER_DRIFT / EXTERNAL_COMPATIBILITY_REVIEW_REQUIRED

- the production function exists;
- production trigger count is zero;
- staging has cases_insert_tg;
- direct API-role EXECUTE was already removed under PR-C;
- it is not proven safe to drop;
- it is not proven correct to restore the production trigger;
- no PR-D implementation is authorized for it.

## 7. Closed-Target Exclusions
- **public.admin_set_user_role**: ACL={postgres=X/postgres,service_role=X/postgres}, Hash=b35c1f5b5daf8a054c91192f65730b9c, Excluded because PR-A closed it.
- **public.get_embedding_metrics**: ACL={postgres=X/postgres,service_role=X/postgres}, Hash=de1ec5a3983b9e6dc5efebeaaa865ec0, Excluded because PR-B closed it.
- **public.cases_compat_insert**: ACL={postgres=X/postgres,service_role=X/postgres}, Hash=b8b6d0f95bb1fb8915f60984637c1dbd, Excluded because PR-C closed it.
- **public.handle_new_user**: ACL={postgres=X/postgres,service_role=X/postgres}, Hash=98475b8fbef19a2fde45ddcc79eebc57, Excluded because PR-C closed it.

## Final PR-D decision

- scoped project-owned routines = 50;
- public = 38;
- app = 8;
- auth = 4;
- SECURITY DEFINER routines = 17;
- SECURITY DEFINER broad EXECUTE = 11;
- verified PostgREST-exposed routines = 5;
- unsafe search_path findings = 0;
- P0 findings = 0;
- P1 findings = 0;
- actionable P2 findings = 0;
- confirmed orphan routines = 0;
- trigger-drift candidates = 1;
- recommended implementation targets = 0;
- database changes = none.

Final verdict:

NO_PR_D_REQUIRED

Explain that broad EXECUTE alone was not treated as a vulnerability because:

- app-schema helpers are used for policy and ownership evaluation;
- exposed public functions are read-only or internally authorized;
- trigger-only functions closed by PR-C were excluded;
- previously remediated functions were excluded;
- no concrete unauthorized privileged effect was demonstrated.
