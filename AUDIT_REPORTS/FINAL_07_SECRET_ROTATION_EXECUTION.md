# FINAL 07 — Secret Rotation Execution

**Date (UTC):** 2026-07-20
**Branch:** `codex/final-secret-rotation-closure`
**Base SHA:** `ad20a27bc32ba40c364fbe39d969285d4d17171b`
**Evidence directory:** `secret_rotation_audit/`
**Sanitization:** no credential value, prefix, suffix, fragment, JWT payload, authorization header, cookie, signed URL, connection-string password or value-derived hash appears in this report or in any artifact it references.

---

## 1. Executive status

**FINAL_VERDICT: `BLOCKED_PROVIDER_ACCESS`**

**OVERALL_SECRET_ROTATION: `PARTIAL_ROTATION_P0_CLOSED`**

**P0-001 active credential risk: CLOSED.** The operator reset the production Postgres password (SECRET_002) through the Supabase Dashboard for project `avmgtsonawtzebvazgcr`, updated the local active `DATABASE_URL` to the Session pooler (`*.pooler.supabase.com`, port 5432), and verified the rotation: the old password was rejected with PostgreSQL error `28P01`, and the new password revalidated by executing `select 1 as ok` successfully. Sanitized evidence is recorded in `secret_rotation_audit/10_DATABASE_PASSWORD_ROTATION_EVIDENCE.json`. This closes the active-credential half of P0-001 only.

**Historical repository exposure: STILL PRESENT (revoked).** The plaintext credential remains recoverable from reachable Git history (commit `09023b0`) but is now a revoked, inactive credential. The history scrub is a separate, operator-approved force-push and was not performed.

**No credential other than SECRET_002 was rotated.** The remainder of this loop is not a partial result that can be rounded up — it is a hard stop taken deliberately at the capability probe, before any provider was touched.

The execution environment has no authenticated write path to any credential provider in this system. The Supabase session is read-only metadata (projects, edge functions, migrations, advisors, logs) and offers no service-role reset, no database password reset, no personal-access-token issuance and no edge-secret read or write. The Vercel session is read-only and its authorized team exposes zero projects, so the deployment scope that owns `vercel.json` is not even identifiable from here. There is no GitHub API session, no provider CLI of any kind, and no session to the VPS embedding host or its Cloudflare tunnel.

Under section 16 of the loop specification a credential counts as rotated only when a replacement exists, every consumer is updated, the replacement is validated, the old credential is revoked, the old credential fails a negative test, and the replacement is revalidated after revocation. Not one of those six conditions could be produced for any credential. Reporting a PASS here would have meant fabricating rotation evidence, which section 0 forbids outright.

What this loop did produce is the thing that was actually missing: a real, evidence-based inventory, classification and dependency map, plus two findings that materially change the risk picture.

**Two open findings carried out of this loop:**

- **P0-001 — the production Postgres password is recoverable from Git history.** `db_passwords.cjs` was introduced in commit `09023b0` and untracked in `17d9bfe`, but the commit that contained the plaintext production connection string is still reachable from `origin/main`. Anyone with repository read access can recover it and connect directly, bypassing every RLS policy. Untracking a file does not remove it from history. This credential must be rotated regardless of whether the history is ever scrubbed.
- **P1-001 — the pre-existing rotation checklist has never been executed.** `docs/SECURITY_SECRET_ROTATION.md` records that the on-disk `.env` held live, working values for the service-role key, database password, Supabase PAT, Vercel token, two GitHub PATs, the OpenRouter key and the Gemini key, and declares all of them rotation-mandatory. Every checkbox in that document is still unchecked, and `AUDIT_REPORTS/89_LIVE_SECRET_CONFIGURATION.md` independently confirms that JWT, anon, service-role and database credentials were not rotated.

The `BLOCKED_SECRET_ROTATION` gate therefore remains **OPEN**, and it now has a concrete, prioritised close-out path rather than an unscoped one.

---

## 2. Repository and environment scope

| Item | Value |
|---|---|
| Origin | `github.com/galstyanh992-max/LegalArmenia` |
| Worktree | `D:\1V\LegalArmenia-secret-rotation` |
| Branch | `codex/final-secret-rotation-closure` |
| Base SHA | `ad20a27bc32ba40c364fbe39d969285d4d17171b` |
| `origin/main` | `ad20a27bc32ba40c364fbe39d969285d4d17171b` |
| Production Supabase | `avmgtsonawtzebvazgcr` — AilegalFinalVersion, ap-northeast-1, ACTIVE_HEALTHY, 50 ACTIVE edge functions |
| Staging Supabase | `vavjajwiqsdhlweggalw` — AI Legal Armenia Staging, ap-northeast-1, ACTIVE_HEALTHY |

**Recorded deviation.** The mission names `D:\1V\LegalArmenia` as the repository. That path does not exist. The canonical clone that owns the `.git` directory and the worktree registry — including every sibling audit branch such as `codex/interactive-e2e-closure` at `2f46e5a`, matching the known-closed E2E gate — is `D:\1V\LegalArmenia-clean`. The worktree was created from there, against the same origin. This is a path resolution, not a scope change.

The worktree contains exactly one incidental modification, `AUDIT_REPORTS/artifacts/prompt19_3_training/training_pairs.jsonl`, caused by an unlink failure in the FUSE filesystem layer during checkout. It is not staged and not committed. `BLOCKED_SCOPE_DRIFT` does not apply.

---

## 3. Secret-name inventory

Twenty logical secret names were discovered across eleven providers. Full detail in `secret_rotation_audit/01_SECRET_NAME_INVENTORY.json`.

**Critical (5):** `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` password component, `SUPABASE_ACCESS_TOKEN`, `VERCEL_TOKEN`, `GITHUB_PERSONAL_ACCESS_TOKEN`.

**High-risk (11):** `OPENROUTER_API_KEY`, `OPENAI_API_KEY`, `OLLAMA_CLOUD_API_KEY`, `GEMINI_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `INTERNAL_INGEST_KEY`, `CRON_WORKER_KEY`, `EMBEDDING_API_KEY`, `STAGING_SUPABASE_SERVICE_ROLE_KEY`, `STAGING_DATABASE_URL`.

**Provider-managed and operator-gated (1):** the Supabase JWT signing secret.

**Deferred or not applicable (3):** `COHERE_API_KEY` (legacy, recommend decommission), `TEST_USER_PASSWORD` (test fixture), `EVAL_CLIENT_JWT` (self-expiring).

---

## 4. Classification decisions

Classification was evidence-driven, not assumed. Three decisions are worth stating explicitly.

`INTERNAL_INGEST_KEY` and `CRON_WORKER_KEY` are treated as high-risk rather than as ordinary configuration because 26 of the 50 deployed edge functions run with `verify_jwt=false`. For those functions the shared secret checked in `supabase/functions/_shared/edge-security.ts` is the *only* authorization gate. Compromise is equivalent to unauthenticated ingestion and pipeline control.

The `DATABASE_URL` password is classified critical and escalated to P0 specifically because of the history finding, not merely because of its capability.

The Supabase JWT signing secret is classified `PROVIDER_MANAGED` and routed to operator confirmation rather than into the executable set. Resetting it invalidates every anon key, every service-role JWT and every live user session simultaneously. Section 6 forbids improvising that class of rotation.

---

## 5. Public values excluded from rotation

Eleven values were examined and deliberately **not** rotated, because rotating a public identifier to inflate a rotation count would be theatre:

`SUPABASE_URL`, `VITE_SUPABASE_URL`, the project refs, `SUPABASE_ANON_KEY`, `VITE_SUPABASE_ANON_KEY`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `EMBEDDING_ENDPOINT` (verified to carry no credential in its query string), the `EMBEDDING_*` model and batching settings, the CORS settings, the `LEGAL_SEARCH_*` RAG cutover flags, and the provider routing metadata.

One caveat: the anon key is public by design but is *derived* from the JWT signing secret. It changes only as a consequence of `SECRET_006`, which is operator-gated. It is not independently rotatable on the legacy JWT model.

---

## 6. Dependency map

Full detail in `secret_rotation_audit/02_DEPENDENCY_MAP.json`. Status: **PARTIAL**.

Repository-side consumers are fully enumerated. Provider-side consumer stores are not, and cannot be from here: Supabase Edge Function Secrets, Vercel project environment variables, GitHub Actions repository secrets, the VPS systemd unit environment, the Cloudflare tunnel configuration, and the identity of the scheduled pipeline invoker. **Nine consumers remain UNKNOWN.**

Two of those unknowns are genuinely blocking rather than cosmetic. The scheduled invoker that calls the `verify_jwt=false` pipeline functions cannot be identified, so `INTERNAL_INGEST_KEY` and `CRON_WORKER_KEY` cannot be rotated without risking a silent pipeline outage — and `AUDIT_REPORTS/89` already records that Supabase does not expose the current value, so the caller side cannot be reconciled without operator input. Separately, the Vercel scope that owns the production frontend is unidentified, so `VERCEL_TOKEN` and the frontend's anon-key configuration have no confirmed update path.

Section 5 forbids starting a rotation while a critical consumer is UNKNOWN. None was started.

---

## 7. Rotation order

The dependency-safe order is recorded in `secret_rotation_audit/03_ROTATION_PLAN.json` as eighteen steps: staging first as the blast-radius rehearsal, then the overlap-capable tokens (Supabase PAT, Vercel, GitHub, then the four AI provider keys), then the no-overlap coordinated pairs (embedding shared secret with its VPS restart, the two internal shared secrets, the Telegram pair), then the production database password, then the service-role key, and finally the operator-gated JWT secret. Cohere is decommissioned rather than rotated.

---

## 8. Staging execution

**NOT_EXECUTED.** Zero credentials created, zero consumers updated, zero validations run. No staging consumer configuration was modified, so no rollback was required. See `04_STAGING_EXECUTION.json`.

---

## 9. Production execution

**PARTIAL_ROTATION_P0_CLOSED.** Exactly one production credential was rotated: SECRET_002 (the production Postgres role password component of `DATABASE_URL`), which was the subject of finding P0-001. The rotation was performed by the operator through the Supabase Dashboard, outside this audit execution environment. The old password was rejected with PostgreSQL error `28P01`, and the new password revalidated with `select 1 as ok`. The local active `DATABASE_URL` was updated to the Session pooler (`*.pooler.supabase.com`, port 5432). See `05_PRODUCTION_EXECUTION.json` and `10_DATABASE_PASSWORD_ROTATION_EVIDENCE.json`.

Every other production credential remains NOT_EXECUTED for the reasons in section 1 and in `09_DEFERRED_OR_EXCLUDED_ITEMS.json`.

Guarantees for this loop: no schema change, no user-data change, no RLS change, no RAG flag change, no edge function deploy, no edge secret write.

---

## 10. Old credential revocation evidence

One credential revoked: SECRET_002 (the production Postgres role password). The operator reset it via the Supabase Dashboard and the old password was rejected with PostgreSQL error `28P01` (see `06_OLD_CREDENTIAL_NEGATIVE_TESTS.json`). No other credential was revoked — nothing was replaced, and section 0 forbids revoking before a replacement is validated.

---

## 11. Old credential negative-test evidence

For SECRET_002: `OLD_DATABASE_PASSWORD_NEGATIVE_TEST = PASS` (PostgreSQL error `28P01`, the old password was rejected). No other credential has been revoked, so no other negative test exists; firing an authentication attempt at a still-current production credential would generate noise with no security value. See `06_OLD_CREDENTIAL_NEGATIVE_TESTS.json`.

---

## 12. New credential revalidation

For SECRET_002: `NEW_DATABASE_PASSWORD_REVALIDATION = PASS`. The replacement credential established a connection through the Session pooler on port 5432 and executed `select 1 as ok` successfully. Temporary test environment variables and the temporary test script were removed after testing. No replacement exists for any other credential.

---

## 13. Health checks

Nine checks executed: seven pass, two fail. Seven marked NOT_EXECUTED with a stated reason, three BLOCKED. Detail in `08_FINAL_HEALTH_CHECK.json`. Nothing NOT_EXECUTED is represented as a pass.

Passing: both Supabase projects reachable and healthy, all 50 edge functions ACTIVE, worktree isolation and branch correctness, `git diff --check` clean, zero tracked `.env` variants, zero working-tree credential residue.

Failing: Vercel deployment target unidentifiable; Git history secret scan (P0-001).

The build, typecheck and contract suites were not run because this loop changed no source or configuration — running them would produce evidence about the base commit, not about this loop.

**PRODUCTION_HEALTH_STATUS: NOT_VALIDATED.**

---

## 14. Residue scan

Twelve detectors across the working tree. Eleven clean at zero matches. The twelfth, the Postgres-URL-with-password detector, produced four matches in three files — each classified without ever reproducing the value: three point at `127.0.0.1:54322`, the well-known non-secret local Supabase CLI default on loopback, and one is a redacted placeholder inside prior-audit prose.

**Real credential values in the working tree: 0.**
**Temporary secret store `D:\1V\_secrets\legalarmenia-rotation.env`: absent — never created.**
**Process-scoped secret variables set by this loop: 0. Credential-bearing shell commands: 0.**

The history finding (P0-001) is recorded in `07_SECRET_RESIDUE_SCAN.json`. **Active credential risk for P0-001 is now CLOSED** (password rotated, old rejected with `28P01`); the revoked plaintext still remains in reachable history (commit `09023b0`) and the history scrub still requires separate written operator authorization. No history rewrite and no force-push were performed.

---

## 15. Deferred items

See `09_DEFERRED_OR_EXCLUDED_ITEMS.json`. The Supabase JWT signing secret is deferred to an announced maintenance window with explicit approval. `COHERE_API_KEY` is recommended for removal rather than rotation. `TEST_USER_PASSWORD` is out of scope. `EVAL_CLIENT_JWT` has no rotation mechanism and expires on its own.

---

## 16. Risks

The dominant risk is not that this loop failed to rotate anything — it is that the exposure documented in P0-001 and P1-001 has now been carried across multiple audit cycles without remediation. A plaintext production database password sitting in reachable Git history is a standing compromise, and the correct assumption is that it is already known outside the intended holders. Every day of delay extends that window.

The secondary risk is operational: the two internal shared secrets guard 26 unauthenticated edge functions and have no identified caller-side owner. Rotating them without first identifying the scheduled invoker will break ingestion silently rather than loudly.

The third risk is a process one. Two prior reports already declared these rotations mandatory. A checklist that is written but never executed produces the appearance of remediation without the substance, and that gap is what this report exists to close.

---

## 17. Rollback evidence

No rollback was required or performed, because no production, staging, provider or configuration state was modified. The only filesystem writes made by this loop are the sanitized artifacts under `secret_rotation_audit/` and this report.

---

## 18. Final verdict

**`BLOCKED_PROVIDER_ACCESS`** — `OVERALL_SECRET_ROTATION = PARTIAL_ROTATION_P0_CLOSED`.

The active production database credential (SECRET_002 / P0-001) is CLOSED. The complete secret-rotation program is NOT PASS: the historical plaintext remains in Git history, the history rewrite is pending operator approval, and every other provider credential remains blocked or unverified.

Secondary open gates: `BLOCKED_SECRET_HISTORY_REWRITE_APPROVAL` (P0-001 historical exposure, now revoked but not scrubbed), `BLOCKED_OPERATOR_CONFIRMATION` (Supabase JWT signing secret — do NOT rotate automatically), `BLOCKED_DEPENDENCY_MAP` (nine unknown consumers, itself a consequence of the provider-access gate).

---

## 19. Exact next action

Rotation must be performed by an operator holding provider credentials, in an environment with authenticated provider CLIs. In priority order:

1. **~~Rotate the production database password now.~~ DONE — 2026-07-20.** The operator reset the production Postgres password via the Supabase Dashboard for project `avmgtsonawtzebvazgcr`, updated the local `DATABASE_URL` to the Session pooler, and verified the rotation (old rejected `28P01`, new revalidated with `select 1 as ok`). The active-credential half of P0-001 is CLOSED. Remaining direct-Postgres consumers beyond the local `.env` should still be reconciled by the operator when provider access is available.
2. **Decide on the history scrub.** The value stays recoverable from `origin/main` until commit `09023b0` is rewritten with `git filter-repo` or BFG and every clone holder is coordinated. That is a force-push and requires explicit written authorization. Rotation in step 1 is what actually defuses the credential; the scrub removes the artifact.
3. **Install and authenticate the provider CLIs** — `supabase login`, `vercel login`, `gh auth login` — then re-run this loop, which will proceed past the capability probe.
4. **Close the nine unknown consumers before touching the coupled secrets.** Identify the Vercel scope that owns the production deployment, enumerate the current Supabase Edge Function Secrets, and identify the scheduled invoker for the `verify_jwt=false` pipeline functions.
5. **Execute the eighteen-step order** in `03_ROTATION_PLAN.json`, staging first, one credential at a time, never revoking before the replacement validates.
6. **Schedule the JWT signing secret separately**, with an announced window, since it signs out every active user.
