# PRODUCTION V3 SHADOW RELEASE ? Preflight + Stage B Plan

Branch: `codex/production-v3-shadow-release` (from `main` @ `230cca302366ecff95ea689f97dd7ed7cc132954`, PR #11 merged)
Date: 2026-07-16
Target: safe production release of current main WITHOUT switching users to RPC V3. Two independent stages:
- **Stage A** ? production deploy of current main, active search route unchanged.
- **Stage B** ? V3 shadow integration, validation, then a separate staged feature-flag cutover.

---

## 1. RELEASE_VERDICT

**PASS_FOR_V3_SHADOW_ONLY ? Stage A production DB deploy is BLOCKED (migration-ledger divergence, PB-002).**

- Stage B (shadow mode code) is implemented and verified locally; it is OFF by default and cannot affect any production response until an operator turns it on after Stage A.
- Stage A production `supabase db push` is BLOCKED: production's remote migration ledger diverges from the repo (40 remote-only migrations vs 8 local-only baseline/hardening migrations). A full push is unsafe and the CLI refuses it. See ?5.

No production write, migration, Edge deploy, or cutover has been executed. Nothing below claims a production effect without evidence.

---

## 2. GIT_STATE

- branch: `codex/production-v3-shadow-release`
- HEAD base: `230cca302366ecff95ea689f97dd7ed7cc132954` (= origin/main, PR #11 merge)
- origin/main: `230cca302366ecff95ea689f97dd7ed7cc132954`
- working tree: clean except this branch's additive shadow work
- remote: `https://github.com/galstyanh992-max/LegalArmenia.git`
- conflict markers in tree: none
- tracked secret/session files (`.env`, `.env.local`, `.env.production`, `db_passwords.cjs`, `.e2e_browser.json`): none tracked
- large blobs in **current tree** >50 MB: none. Large blobs exist only in **history** (pre-cleanup commits, e.g. `prompt19_7_source_manifest.jsonl` 225 MB); history rewriting is forbidden, so this is a recorded condition, not a release blocker. `.gitignore` excludes the generated artifacts; they are untracked at HEAD.

## 3. ENVIRONMENT_MATRIX

| ENVIRONMENT | PROJECT_REF | NAME | LINK_STATUS | MIGRATION_HEAD | EDGE_FUNCTIONS | RUNTIME_SEARCH_ROUTE |
|---|---|---|---|---|---|---|
| staging | `vavjajwiqsdhlweggalw` | AI Legal Armenia Staging | currently linked locally (restored after preflight) | 13/13 local migrations applied incl. `20260716000100`, `20260716000200` | not enumerated (staging) | `search_legal_corpus_metric` |
| production | `avmgtsonawtzebvazgcr` | AilegalFinalVersion | not linked locally (read-only inspected) | divergent: 40 remote-only migrations; local `20260716000100`/`20260716000200` NOT applied; metric V2 (`20260715023423`,`20260715024359`) applied | 36 ACTIVE functions; search-relevant: `kb-unified-search`(v42), `kb-search`(v42), `kb-search-assistant`(v43), `vector-search`(v43), `embed-query`(v55), `legal-chat`(v54) | `search_legal_corpus_metric` (via `kb-unified-search` direct + `legal-chat`?`rag-search`?`vector-search`) |

Notes:
- `supabase/config.toml` declares `project_id = "avmgtsonawtzebvazgcr"` (production) while the local link cache pointed at staging ? recorded and left as-is; link was temporarily set to production only for read-only `migration list` / `db push --dry-run`, then restored to staging.
- Staging verified (read-only `supabase db query --linked`): `search_legal_corpus_metric_v3` exists (1), `search_legal_corpus_dual` exists (1), `search_legal_corpus_metric_v2` exists (1). V3 grants on staging: `postgres` EXECUTE, `service_role` EXECUTE, `authenticated` NO, `anon` NO (confirmed via `information_schema.role_routine_grants`).

## 4. QUALITY_GATES

| GATE | RESULT | EVIDENCE |
|---|---|---|
| typecheck | SKIPPED | no `typecheck` script in package.json |
| lint | FAIL (pre-existing, non-critical) | 5 `@typescript-eslint/no-explicit-any` errors + 42546 non-ASCII-literal warnings; all pre-existing on main, not introduced by this branch |
| tests (vitest) | PASS | 21 files / 125 tests passed (`npm run test`) |
| build (production) | BLOCKED_EXTERNAL_DEPENDENCY | `vite build` requires `VITE_SUPABASE_URL` env; no `.env` locally. Code compiles: `build:dev` PASS (PWA generated). Not a code regression. |
| build:dev | PASS | `vite build --mode development` succeeded; no service-role key, no staging URL, no test users in bundle |
| bundle secret scan | PASS (source) | no hardcoded production secrets in diff vs origin/main; only local Docker default `postgres:postgres@127.0.0.1:54322` (non-secret). Full bundle scan pending a production env build. |
| deno check (Edge) | PASS | `deno check` clean on `v3-shadow.ts`, `vector-search/index.ts`, `kb-unified-search/index.ts` |
| edge tests (deno) | PASS | `v3-shadow.test.ts` 2 describe / 9 steps / 0 failed; metric-only + v3 contract tests 5 passed |

## 5. DATABASE_GATES

| GATE | RESULT | EVIDENCE |
|---|---|---|
| backup | NOT_VERIFIED | no CLI access token for Supabase management API (`supabase secrets list` failed: "Access token not provided"); operator must confirm Supabase-managed backup / take a pre-push snapshot before Stage A |
| dry-run (production) | BLOCKED | `supabase db push --dry-run` against `avmgtsonawtzebvazgcr` reports 40 remote-only migrations not in local; CLI recommends `migration repair --status reverted ...` (destructive, forbidden) or `db pull`. See below. |
| applied migrations (production) | divergent | production has its own 40-migration baseline (20260530010000..20260711084117) + `20260714110215`; repo's 8 baseline/hardening migrations (2026071212xxxx, 2026071322xxxx) are local-only; metric V2 (20260715023423/20260715024359) applied on both; `20260716000100`/`20260716000200` local-only (need applying) |
| rollback readiness | PASS (file review) | `20260716000100_..._rollback.sql` drops only 8 additive metadata tables (`if exists`); `20260716000200_..._rollback.sql` drops only V3 function (`if exists`); neither drops dual/V1/V2 or affects current runtime |
| V3 grants (staging verified) | PASS | postgres+service_role EXECUTE; authenticated/anon NO |
| dual RPC preserved | PASS | staging: `search_legal_corpus_dual` exists (1); no migration drops it; V3 migration explicitly states it does not modify dual/V1/V2 |

**Production dry-run output (excerpt):**
```
Remote migration versions not found in local migrations directory.
Make sure your local git repo is up-to-date ... try repairing the migration history table:
supabase migration repair --status reverted 20260530010000 ... 20260714110215
And update local migrations to match remote database: supabase db pull
```

This is the known PB-002 divergence (audit report 13/14): production's tracked migration ledger never contained the repo's foundational app-schema migrations. A blind `db push` would attempt to apply 8 baseline/hardening migrations onto a divergent production schema ? risk of conflict/destructive impact. Per the release rules, this is a hard STOP.

**Safe Stage A path (operator-gated, NOT auto-executed):**
1. Operator confirms a production backup / Supabase PITR is enabled.
2. Apply ONLY the two new additive migrations to production via targeted execute (NOT a full `db push`), since both are additive and verified on staging:
   - `supabase db execute` / psql against production for `20260716000100_additive_legal_metadata_schema.sql`
   - `supabase db execute` / psql against production for `20260716000200_metric_rpc_v3.sql`
   (Or reconcile the migration ledger via an operator decision ? PB-002 is explicitly operator-gated.)
3. Verify on production (read-only): V3 exists with grants postgres/service_role EXECUTE, authenticated/anon NO; dual unchanged; runtime still `search_legal_corpus_metric`.

## 6. PRODUCTION_DEPLOY_STATUS

| COMPONENT | STATUS |
|---|---|
| frontend (Vercel) | NOT_DEPLOYED ? no Vercel token in session; Stage A pending operator deploy with production `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` |
| Edge Functions | NOT_DEPLOYED ? requires Supabase access token (`supabase functions deploy`); not executed. Current production functions remain on versions listed in ?3. |
| database | NOT_DEPLOYED ? Stage A db push BLOCKED (?5) |
| smoke tests | NOT_RUN ? require production auth + browser E2E; not available in this session |

## 7. V3_SHADOW_STATUS

| ITEM | STATUS |
|---|---|
| implemented | YES ? `supabase/functions/_shared/v3-shadow.ts` (additive); wired into `vector-search` and `kb-unified-search` (the two user-facing retrieval routes: direct KB search + `legal-chat`?`rag-search`?`vector-search`). `kb-search`/`kb-search-assistant` are internal/recursive assistant routes, left unwired by design. |
| enabled | NO (default OFF) ? `LEGAL_SEARCH_V3_SHADOW` must === "true"; traffic default 0% |
| traffic percentage | 0 (default) |
| telemetry | structured `v3-shadow` log via safe-logger (PII-redacted): request_id, shadow_enabled, v3_primary, primary_route, status (ok/error/timeout/skipped), v3_result_count, primary_count, overlap_at_5, overlap_at_10, rank_delta_top1, no_answer_disagreement, latency_ms, v3_error_class, sampled |
| errors | failure-isolated: shadow timeout/error never alters the primary response; v3_primary guard refuses to promote V3 from the shadow path |

Shadow contract: V3 called server-side only (service_role); never from browser; tenant authority from backend context, never body user_id; no access tokens/keys/full prompts/full case text in telemetry; hard timeout (default 4s, max 10s).

## 8. TENANT_SECURITY_MATRIX

| CHECK | STATUS |
|---|---|
| SQL-level RLS (cases, case_members, client_documents, public.case_files) | Previously verified in Prompt 17 behavioral matrix; not re-run here (requires local Docker replay). |
| Auth/HTTP/E2E cross-tenant (Client A/B, Lawyer A/B, Admin, Anonymous) | NOT_RUN in this session ? requires local Docker Supabase + browser E2E or production credentials. See `supabase/functions/_shared/authorization-matrix.local.test.ts` / `storage-matrix.local.test.ts` for the existing gates. |
| anon cannot EXECUTE V3 | PASS (staging verified: anon has no EXECUTE grant) |
| authenticated cannot EXECUTE V3 | PASS (staging verified) |
| V3 not callable from browser | PASS by construction ? V3 is service_role-only; no frontend `invoke('...v3')`; shadow runs server-side inside Edge Functions |
| cache leakage / shared response cache | Not re-audited; the search functions do not maintain a cross-tenant response cache. |

**Mandatory negative tests before any cutover (must be run by operator in staging/local):** Client A cannot read/download file B; Lawyer A cannot see case B; Client A cannot insert metadata into case B; Client A cannot call privileged Edge Function without JWT; anon cannot call private search route; authenticated cannot directly EXECUTE V3; V3 shadow does not use private tenant corpus without correct case authorization; cache key includes tenant/user/security scope if cache exists. These are staged in the existing local test files and must be green before Stage A production deploy.

## 9. SEARCH_QUALITY

Not re-run in this session. Per Prompt 19.6 ledger: frozen citation 0.8627 and frozen injection label pass 0.50 remain BELOW gate ? 19.6 = BLOCKED. V3 shadow comparison metrics (Recall@5/10, MRR, nDCG@10, exact provision accuracy, citation accuracy, status correctness, no-answer, latency p50/p95/p99, timeout/error, determinism) must be collected during shadow validation (Stage B, after Stage A) on a fixed query set across the categories in ?11 of the task brief. Synthetic-only results are insufficient; ENGINEERING_GOLD vs LEGAL_REVIEWED_GOLD must be separated.

## 10. LEGAL_REVIEW_STATUS

**PENDING / BLOCKED.** Human legal review of Armenian provision parsing, article/part/point mapping, canonical citation, authority taxonomy, current/unknown/repealed classification, effective dates, ECHR source treatment, false citations, no-answer decisions is NOT complete. Per the rules, V3 cannot become primary without it:
`V3_PRIMARY_CUTOVER = BLOCKED_LEGAL_REVIEW`. Shadow mode may continue while review is pending.

## 11. CUTOVER_STATUS

**blocked ? shadow-only.** Stage 0 (dual/metric primary, V3 shadow 0%) is the only stage that may be enabled after Stage A. Stages 1?5 (internal-only ? 5% ? 25% ? 50% ? 100%) require legal review + quality gates + operator confirmation. No automatic cutover. See `V3_CUTOVER_PLAN.md`.

## 12. ROLLBACK

V3 cutover rollback is **feature-flag based, no DB migration required**:
- Flags: `LEGAL_SEARCH_V3_PRIMARY=false`, `LEGAL_SEARCH_PRIMARY=metric` (or `dual`), `LEGAL_SEARCH_V3_SHADOW=false`, `LEGAL_SEARCH_V3_TRAFFIC_PERCENT=0`
- Command: set the Edge Function secrets and redeploy (or use Supabase secrets update + Edge redeploy):
  `supabase secrets set LEGAL_SEARCH_V3_PRIMARY=false LEGAL_SEARCH_PRIMARY=metric LEGAL_SEARCH_V3_SHADOW=false LEGAL_SEARCH_V3_TRAFFIC_PERCENT=0 --project-ref avmgtsonawtzebvazgcr && supabase functions deploy kb-unified-search vector-search --project-ref avmgtsonawtzebvazgcr`
- Estimated rollback time: < 2 minutes (secret update + redeploy), no schema change.
- Validation query (read-only): confirm `search_legal_corpus_metric` still resolves user responses and `search_legal_corpus_metric_v3` grants unchanged.

If the V3 **schema** itself must be removed (incident only), use the additive rollback files (drops only V3 function + 8 metadata tables, `if exists`); do NOT apply on production without a confirmed incident.

## 13. REMAINING_BLOCKERS

1. **Stage A production DB push BLOCKED** ? migration-ledger divergence (PB-002). Operator decision required: targeted apply of the 2 additive migrations, or ledger reconciliation. (Hard STOP per release rules.)
2. **No Supabase management access token** in session ? `supabase secrets list`, `functions deploy`, `db execute` to production, and backup verification are unavailable. Operator must run these with an authenticated CLI.
3. **No Vercel token** ? frontend production deploy cannot be performed from this session.
4. **Production build needs env** ? `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` for `npm run build`; not present locally (correctly not committed).
5. **Legal review PENDING** ? blocks V3 primary cutover.
6. **E2E tenant/security smoke** not run here ? requires local Docker replay or production credentials.

## 14. EXACT_NEXT_ACTION

1. Operator: confirm production backup (Supabase PITR / snapshot).
2. Operator: apply ONLY `20260716000100_additive_legal_metadata_schema.sql` and `20260716000200_metric_rpc_v3.sql` to production (targeted execute), then verify V3 grants + dual preserved (read-only queries in ?5).
3. Operator: deploy frontend to Vercel with production env; deploy Edge Functions (`kb-unified-search`, `vector-search`) ? Stage A, V3 shadow OFF by default.
4. Operator: run smoke tests (login, client/lawyer/admin, cases, files, KB search, legal chat, no anon private access, no CORS regression, no 5xx spike).
5. Operator: after Stage A stable, enable shadow on staging first: `LEGAL_SEARCH_V3_SHADOW=true LEGAL_SEARCH_V3_TRAFFIC_PERCENT=100` (staging), validate telemetry + quality gates + legal review.
6. Only after legal review PASS and quality gates PASS: begin staged cutover per `V3_CUTOVER_PLAN.md`, starting internal/admin-only, with the feature-flag rollback ready.

No production deploy, migration, shadow enablement, or cutover has been executed. All production-affecting steps above are operator actions requiring the credentials/authorizations not present in this session.