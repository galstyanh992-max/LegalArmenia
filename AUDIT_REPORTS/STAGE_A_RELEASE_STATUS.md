# STAGE A RELEASE STATUS ? Phase 1

Date: 2026-07-16
Production main (pre-PR12): `230cca302366ecff95ea689f97dd7ed7cc132954`
New production main (post-PR12 merge): `c30abb78e85139135c8a11488ce2f3ada0eab761`
PR #12 merge commit: `c30abb78e85139135c8a11488ce2f3ada0eab761`
PR #12 branch: `codex/production-v3-shadow-release` (head `a93f832947cd696838ab74b2951ae27be032aea4`)

## Phase 1 ? what was completed

1. Worktree located: `D:/1V/LegalArmenia-prompt19-7` @ branch `codex/production-v3-shadow-release`, HEAD `daa493a` (verified).
2. `.env.production.local` created at worktree root with `VITE_SUPABASE_URL=https://avmgtsonawtzebvazgcr.supabase.co` + `VITE_SUPABASE_ANON_KEY` (production publishable anon key, role=anon, RLS-protected). Ignored (`.gitignore:23: *.local`), untracked, no forbidden vars (service-role key/access token/DB password/Vercel token/embedding API key).
3. PR #12 gates verified locally AND in GitHub CI:
   - vitest: 21 files / 125 tests PASS
   - deno edge: 97 passed (13 steps), 0 failed, exit 0
   - production build: PASS (`npm run build` with `.env.production.local`)
   - bundle scan: PASS ? no `"role":"service_role"` token; no staging ref; anon key decoded role=anon; `SUPABASE_SERVICE_ROLE_KEY`/`service_role` strings present only as Edge source-code literals in the admin prompt-editor raw imports (not values)
   - shadow default OFF: PASS; V3 primary guard: PASS
   - lint: FAIL (5 pre-existing `no-explicit-any` in `deterministic-search-v4.ts`, proven unchanged on origin/main, out of PR #12 scope, non-blocking)
4. PR #12 merged into main via merge commit (not squash). New `origin/main` = `c30abb7`. GitHub CI checks were green before merge.
5. Production read-only preflight performed (link temporarily set to production, then restored to staging):
   - production RPCs present: dual, metric, metric_v2 (V3 absent)
   - production grants: metric/v2 = service_role-only; dual = public
   - 8 additive metadata tables absent (no collision); `content_domain` enum present
   - production migration ledger divergent (40 remote-only) ? confirms PB-002

## Phase 1 ? what is BLOCKED (operator-gated, NOT executed)

- **Backup confirmation: NOT_VERIFIED** ? no Supabase management API access (`supabase secrets list` fails: "Access token not provided"). Per release rules: `BLOCKED_NO_BACKUP` ? production DB write may not proceed.
- **Production migrations NOT applied** ? `supabase db execute` requires the access token; not available. Plan prepared in `PRODUCTION_TARGETED_MIGRATION_PLAN.md` (SHA256, objects, validation, rollback, PB-002 Strategy B).
- **Edge Functions NOT deployed** ? `supabase functions deploy` requires the access token.
- **Frontend production deploy** ? triggered by the main merge via the Vercel integration (if main is the production branch), but the deployment ID is NOT directly observable here without `vercel` CLI auth (`vercel login` not performed). Bundle verified clean and shadow OFF, so a Vercel production deploy of main is safe for Stage A.
- **Supabase Edge secrets (search flags) NOT set** ? `supabase secrets set` requires the access token. Required flags for Stage A (shadow OFF): `LEGAL_SEARCH_PRIMARY=metric`, `LEGAL_SEARCH_V3_SHADOW=false`, `LEGAL_SEARCH_V3_PRIMARY=false`, `LEGAL_SEARCH_V3_TRAFFIC_PERCENT=0` ? to be set by the operator when deploying Edge Functions.
- **Smoke tests NOT run** ? require production auth + browser E2E.

## DEPLOYMENT_SCOPE

- Code merged: PR #12 (V3 shadow, OFF by default) into `main` @ `c30abb7`.
- Schema: unchanged (no production migration applied).
- Edge runtime: unchanged (no Edge deploy).
- Frontend: may auto-deploy via Vercel main integration; not observable here.

No production migration, Edge deploy, secret change, or smoke has been executed by this agent. All production-affecting steps above are operator actions requiring credentials not present in this session.