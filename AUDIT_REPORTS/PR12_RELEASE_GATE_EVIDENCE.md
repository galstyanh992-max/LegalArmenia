# PR #12 RELEASE GATE EVIDENCE

Branch: `codex/production-v3-shadow-release` (HEAD `daa493a53363aa8cd0698a5b9bbee34a06de6859`)
Base: `main` (`230cca302366ecff95ea689f97dd7ed7cc132954`)
Date: 2026-07-16

## Gates (merge-blocking set per Step 2)

| GATE | RESULT | EVIDENCE |
|---|---|---|
| tests (vitest) | PASS | 21 files / 125 tests, exit 0 (`npm test -- --run`) |
| tests (deno edge) | PASS | 97 passed (13 steps), 0 failed, exit 0 (`npm run test:edge` = `deno test -A --no-check supabase/functions/_tests/`) |
| production build | PASS | `npm run build` exit 0 using `.env.production.local` (production env, not committed) |
| bundle secret scan | PASS | dist/ scan: no `"role":"service_role"` token; no staging ref `vavjajwiqsdhlweggalw`; production ref `avmgtsonawtzebvazgcr` present; embedded `eyJ` token decoded ? `role=anon`, `ref=avmgtsonawtzebvazgcr` (publishable anon key, RLS-protected ? correct for browser). `SUPABASE_SERVICE_ROLE_KEY`/`service_role` strings present only as Edge source-code literals inside the admin prompt-editor raw imports (`Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")`), not as values. |
| shadow default OFF | PASS | `readV3ShadowFlags()` with `LEGAL_SEARCH_V3_SHADOW` unset returns `shadowEnabled=false, v3Primary=false, trafficPercent=0`; deno test "defaults to OFF" ok; no Edge secret sets these at build time |
| V3 primary guard | PASS | deno test "refuses to promote V3 to primary even if flag misconfigured" ok ? shadow path short-circuits when `v3Primary=true` |
| working tree | PASS | `git status --short` clean (tracked); `.env.production.local` ignored (`!!`); `dist` ignored |

## Lint (informational, NOT merge-blocking)

`npm run lint` ? FAIL: 5 `@typescript-eslint/no-explicit-any` errors, all in `supabase/functions/_shared/deterministic-search-v4.ts` (lines 66, 101, 102, 180, 203). Plus 42546 non-ASCII-literal warnings.

**Proof these are pre-existing on main and unrelated to PR #12:**
- `git diff --stat origin/main..HEAD -- supabase/functions/_shared/deterministic-search-v4.ts` ? empty (PR #12 does not touch this file).
- `git cat-file -e origin/main:supabase/functions/_shared/deterministic-search-v4.ts` ? exists (file identical on origin/main).
- PR #12 changed files (audit): `PRODUCTION_V3_SHADOW_RELEASE.md`, `V3_CUTOVER_PLAN.md`, `v3-shadow.ts`, `v3-shadow.test.ts`, `kb-unified-search/index.ts`, `vector-search/index.ts` ? none is `deterministic-search-v4.ts`.

Per AGENTS.md ("Do not rewrite working code", "keep edits closely scoped") and Step 2 ("??????? ?????? ???????? ??????????? ????????"), these pre-existing, out-of-scope type-lint errors are not fixed in PR #12. They are tracked separately and do not block the release merge (the merge-blocking set above is fully green).

## .env.production.local

Created at worktree root with `VITE_SUPABASE_URL=https://avmgtsonawtzebvazgcr.supabase.co` + `VITE_SUPABASE_ANON_KEY` (production publishable anon key, role=anon). `git check-ignore -v .env.production.local` ? `.gitignore:23:*.local`. Not committed, not tracked. No forbidden vars (service-role key, access token, DB password, Vercel token, embedding API key) present.