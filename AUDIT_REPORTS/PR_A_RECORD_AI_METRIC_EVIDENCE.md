# PR-A Evidence — record_ai_metric service-role-only containment

Status: **HOLD / DO NOT MERGE** — awaiting emergency review. Production unchanged.

## Confirmed P1 threat model

`public.record_ai_metric` (SECURITY DEFINER, owner `postgres`) had EXECUTE granted to
PUBLIC/anon/authenticated/service_role and **no authorization guard**. anon + authenticated
could call `/rest/v1/rpc/record_ai_metric` and insert unbounded rows into `internal.ai_metrics`
(RLS bypassed by SECURITY DEFINER; `force_rls=false`). All metric identity fields are
caller-controlled (`fn_name, model, input_tokens, output_tokens, cost_usd, latency_ms, status,
error_message, case_id, user_id`), enabling spoofed user/case attribution and corruption of
the admin `UsageMonitor` / billing / analytics dashboards, plus storage/log amplification.

## Production change status

**NO_CHANGES.** Production `record_ai_metric` baseline captured pre- and post-PR and verified
unchanged:

| field | baseline | post-PR |
|-------|----------|---------|
| def_md5 | a77d65c5466a893c8e5db16aff026902 | a77d65c5466a893c8e5db16aff026902 |
| src_md5 | e38e47bea9581f2970e12200394fb54a | e38e47bea9581f2970e12200394fb54a |
| proacl | {postgres=X/postgres,=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres} | (unchanged) |
| comment | (empty) | (empty) |

No production DDL, ACL, migration-ledger, Edge deployment, or secret change was performed.

## Exact caller model

**SERVICE_ROLE_ONLY.** Body guard:
`if (auth.jwt() ->> 'role') is distinct from 'service_role' then raise exception 'Service role required' using errcode = '42501'; end if;`
ACL: `REVOKE ALL ... FROM PUBLIC, anon, authenticated, service_role;` then
`GRANT EXECUTE ... TO service_role;`. `SET search_path = ''`. SECURITY DEFINER retained.
Signature, parameter names/defaults, return type (void), and insert behavior preserved.

## Real repository call-site evidence

Every runtime caller is a Supabase Edge Function building its client with
`SUPABASE_SERVICE_ROLE_KEY`. Where `p_user_id` is supplied, it is derived from trusted
server-side context (the verified user JWT, `user.id`); `kb-search-assistant` intentionally
omits `p_user_id`. No browser/frontend runtime caller exists (generated `types.ts` is not
runtime evidence).

| caller | line | client construction | p_user_id source |
|--------|------|---------------------|------------------|
| supabase/functions/_shared/ai-metrics.ts | 35 | RPC wrapper (receives service client) | caller-supplied server-derived |
| supabase/functions/ai-analyze/index.ts | 1180,1193,1524 | createClient(url, SUPABASE_SERVICE_ROLE_KEY) (L413) | user.id |
| supabase/functions/multi-agent-analyze/index.ts | 879,1061,1351 | createClient(url, SUPABASE_SERVICE_ROLE_KEY) (L786) | user.id |
| supabase/functions/ocr-process/index.ts | 278,442,491 | createClient(url, SUPABASE_SERVICE_ROLE_KEY) (L193) | user.id |
| supabase/functions/audio-transcribe/index.ts | 272 | createClient(url, SUPABASE_SERVICE_ROLE_KEY) (L58) | user.id |
| supabase/functions/legal-chat/index.ts | 781 | createClient(url, SUPABASE_SERVICE_ROLE_KEY) (L405) | user.id |
| supabase/functions/kb-search-assistant/index.ts | 240 | createClient(url, SUPABASE_SERVICE_ROLE_KEY) (L100) | (no userId) |
| supabase/functions/_shared/rag-search.ts | 716 | opts.supabase (documented service_role, L41) | caller-derived |

No non-service-role runtime caller → no caller-model conflict.

## Staging HTTP matrix (project vavjajwiqsdhlweggalw)

Candidate applied to staging without a ledger row (postgres DDL only). Matrix run with real
Supabase HTTP clients:

| case | client | HTTP status | body | metric rows |
|------|--------|------------|------|-------------|
| A. ANON_DENIED | anon key | 401 | 42501 permission denied for function record_ai_metric | 0 |
| B. AUTHENTICATED_DENIED | ephemeral user JWT | 403 | 42501 permission denied for function record_ai_metric | 0 |
| C. AUTHENTICATED_ADMIN_DENIED | ephemeral user JWT (app_role=admin set via db) | 403 | 42501 permission denied for function record_ai_metric | 0 |
| D. SERVICE_ROLE_JWT_PROOF | service_role key, temp helper public._hotfix_jwt_probe() | 200 | "service_role" | n/a |
| E. SERVICE_ROLE_WRITE_SUCCESS | service_role key | 204 | "" (void) | 1, all fields match request |
| E2. SERVICE_ROLE_WRITE_SUCCESS (verify) | service_role key | 204 | "" | 1, all fields match (model=hotfix-verify-model, 555/666, 7.777, 123, failed, verify-marker, user_id=<ephemeral>) |
| F. SPOOFING_CONTAINMENT | anon + auth with spoofed p_user_id | denied (see A/B) | — | 0 |

Inserted-row verification (E2) via postgres read of `internal.ai_metrics`:
`fn_name=hotfix_record_ai_metric_20260718180110, model=hotfix-verify-model, input_tokens=555,
output_tokens=666, cost_usd=7.777000, latency_ms=123, status=failed, error_message=verify-marker,
user_id=<ephemeral uid>`. Every field matches the request; return shape 204 (void).

## JWT proof

Temp helper `public._hotfix_jwt_probe()` (SECURITY INVOKER, `select auth.jwt() ->> 'role'`,
service_role EXECUTE only) returned `"service_role"` when called with the service_role key
(status 200). Helper dropped after the proof.

## Post-apply catalog proof (staging)

| field | value |
|-------|-------|
| signature | unchanged (10 params, names, defaults, order) |
| owner | postgres (unchanged) |
| return type | void (unchanged) |
| SECURITY DEFINER | true (retained) |
| search_path | '' (empty) |
| md5(prosrc) | a6a22938019a964b5c499d1fcb5bb626 (matches migration candidate prosrc) |
| dynamic SQL | none |
| comment | updated (service-role-only statement) |

Effective privileges post-apply: PUBLIC_EXECUTE=false, ANON_EXECUTE=false,
AUTHENTICATED_EXECUTE=false, SERVICE_ROLE_EXECUTE=true.
proacl=`{postgres=X/postgres,service_role=X/postgres}`. Spot-check of 9 other SECURITY DEFINER
functions confirmed their ACLs unchanged (migration touched only record_ai_metric).

## Cleanup and exact staging restoration

Deleted: 2 test metric rows, 2 ephemeral Auth users (Admin API DELETE 200), 2 profile rows,
temp helper `public._hotfix_jwt_probe()`, temp runner files, and the staging secrets env file.
Staging `record_ai_metric` restored to the **exact captured pre-test state** (byte-exact
prosrc, not the containment rollback):

| field | pre-test | post-restore | match |
|-------|----------|--------------|-------|
| def_md5 | a77d65c5466a893c8e5db16aff026902 | a77d65c5466a893c8e5db16aff026902 | yes |
| src_md5 | e38e47bea9581f2970e12200394fb54a | e38e47bea9581f2970e12200394fb54a | yes |
| proacl | {postgres=X/postgres,=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres} | (same) | yes |
| proconfig | search_path=internal, public, auth, pg_temp | (same) | yes |
| comment | (empty) | (empty) | yes |
| owner | postgres | postgres | yes |

Leftover verification: marker_rows=0, leftover_auth_users=0, leftover_profiles=0,
leftover_helpers=0, internal.ai_metrics total rows=0 (pre=0). Migration ledger unchanged:
count=13 (pre=13), latest=20260716000200 (pre=20260716000200). No candidate version inserted
into the ledger.

## Function hashes (committed artifacts)

- forward migration prosrc md5 = a6a22938019a964b5c499d1fcb5bb626
- forward migration def_md5 (applied on staging) = 2053521782327872288c1bcdbe1b801a
- final staging ACL = {postgres=X/postgres,service_role=X/postgres}

## Containment rollback semantics

`supabase/rollback/20260718180110_hotfix_record_ai_metric_service_role_only_rollback.sql`
keeps the safe fail-closed service_role-guarded body and **revokes EXECUTE from all roles
including service_role**. The RPC becomes non-callable (availability containment). It never
restores PUBLIC/anon/authenticated EXECUTE and never restores the vulnerable body. To restore
legitimate service_role writes, re-apply the forward migration.

## CI status

Local contract test suite (`deno test -A --no-check supabase/functions/_tests/`): **100 passed
(65 steps) | 0 failed**, including the new `hotfix-record-ai-metric.contract.test.ts` (30
steps) and the pre-existing `hotfix-admin-set-user-role.contract.test.ts`. CI status for the
remote PR will be reported here once the branch is pushed.

## Hold

**DO NOT MERGE.** Awaiting emergency security review. Production remains on the vulnerable
baseline until this PR is reviewed, merged, and a separate production deployment is explicitly
authorized. The containment rollback is included for safe reversion if needed.