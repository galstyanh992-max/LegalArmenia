# 15 — SECRET REGRESSION AND BRANCH RECONCILIATION

Prompt 11/20 — Independent Git Security Auditor
Date: 2026-07-12
Rule compliance: no credential values read into or reproduced in this report; no history rewrite; no force-push.

## EXIT DECISION: `CURRENT_TREE_RECONCILED`

---

## 1. Baseline

| Item | Value |
| --- | --- |
| Branch | `claude/case-upload-function-fix-lbn2sp` |
| HEAD at audit start | `636f445` |
| Remote | `origin = https://github.com/galstyanh992-max/LegalArmenia` |
| PR #7 | head `claude/case-upload-function-fix-lbn2sp` → base `main`; diff scope = 3 audit reports only (verified: `git diff origin/main...HEAD --name-only`) |
| Git status at start | clean (in sync with origin) |

## 2. Metadata verification (no credential content read or printed)

| Check | Result | Evidence |
| --- | --- | --- |
| Tracked in working branch? | **YES** | `git ls-files -- db_passwords.cjs` → listed |
| Present in index? | **YES** (blob `c995926`, mode 100644, stage 0) | `git ls-files --stage` |
| Present in PR #7 diff? | **NO** | `git diff origin/main...HEAD -- db_passwords.cjs` → empty (identical blob on both sides; PR is docs-only) |
| Present in `origin/main`? | **YES** | `git ls-tree origin/main --name-only` → listed |
| Historical-only? | **NO** — present at HEAD of both `main` and the working branch | above |
| Ever deleted in any reachable ref? | **NO** | `git log --all --diff-filter=D -- db_passwords.cjs` → empty |
| File's entire reachable history | Single commit: added at `09023b0` (2026-07-09), never modified, never removed | `git log --all --diff-filter=ADR --follow` |

## 3. Containment-claim reconciliation

The prior "containment" that reported removing hardcoded database credentials is identifiable from evidence gathered earlier in this session: Vercel deployment metadata for project `ai-legal-armenia` records a deployment built from commit `3b9215b2…` with message **"security: remove hardcoded database credentials, read from env"** on branch **`codex/github-ready-assembly`** (actor: codex, `gitDirty: 1`).

Reconciliation against this repository:

| Check | Result |
| --- | --- |
| Is commit `3b9215b2…` reachable here? | **NO** — `git cat-file -t 3b9215b2…` → `could not get object info` |
| Does branch `codex/github-ready-assembly` exist here? | **NO** — refs are only `main` and `claude/case-upload-function-fix-lbn2sp` (+ remotes) |
| Does any doc in the repo claim the deletion happened? | **NO** — the only `.md` files mentioning the script are this session's own audit reports (12, 14), which *recommended* removal, never claimed it |

**Conclusion:** the containment was authored on a line of work that never reached this repository — not merged, not pushed here, possibly performed in a different workspace/clone entirely (the deployment metadata shows a dirty working tree, i.e. a CLI deploy of uncommitted-adjacent state). Nothing regressed: within this repository the file has been continuously tracked since `09023b0` with zero removal events.

## 4. Classification

| Candidate | Verdict |
| --- | --- |
| `CURRENT_TREE_REGRESSION` | No — there was no prior removal in this repo to regress from |
| **`PR_SCOPE_MISMATCH`** | **YES (primary)** — the containment lived in an unmerged, out-of-repo branch (`codex/github-ready-assembly`); neither it nor PR #7 ever scoped the file's removal into `main` |
| `MAIN_ONLY_EXPOSURE` | No — exposure was in `main` *and* the working branch (both, identically) |
| `HISTORICAL_ONLY` | No — tracked at HEAD until this prompt's fix |
| `FALSE_POSITIVE` | No — report 12 already established the blob contains a live credential (value never reproduced) |

## 5. Side checks

| Item | Result |
| --- | --- |
| `fix_app_profiles.js` | Tracked (blob `ae7a3c5`). Contains only `postgres:postgres@127.0.0.1:54322` — the universal, documented `supabase start` local-dev default; loopback-only; **not a secret** (INFORMATIONAL, unchanged) |
| `.gitignore` before fix | **No rule** covering `db_passwords.cjs` (only `.env*` family rules) |
| Redacted scans (path-only, post-fix) | Remaining `postgresql://postgres:` pattern hits: `AUDIT_REPORTS/12_…md` (contains the literal placeholder `<password>` — verified redacted) and `fix_app_profiles.js` (loopback default) — **both safe** |

## 6. Repair loop (executed, one confirmed error → one minimal fix)

| Step | Action | Result |
| --- | --- | --- |
| Confirmed error | `db_passwords.cjs` tracked at HEAD of working branch | §2 |
| Minimal fix | `git rm --cached db_passwords.cjs` (tracking removed, **file preserved on disk** — user changes kept) + exact `.gitignore` rule `db_passwords.cjs` | staged |
| Targeted verification | `git ls-files` no longer lists it; file still on disk (1020 bytes); path-only rescan of tracked files → only the two safe hits above | PASS |
| Micro audit | Only `.gitignore` + the deletion staged; no other paths touched; no history rewrite; no credential printed | PASS |
| Commit/push guard | **Separate user permission requested and granted** ("Да, commit + push") → committed `17d9bfe`, pushed to `claude/case-upload-function-fix-lbn2sp` (fast-forward, no force) | DONE |

## 7. Residual risk (unchanged obligations)

1. **The credential value remains in git history** (`09023b0`…`d476cd8` and descendants) until rotated — **rotation in the Supabase dashboard remains the primary control and is still an operator action (DEEP-001)**. Untracking prevents the file from shipping at HEAD of future clones/branches; it does not sanitize history.
2. History scrubbing (filter-repo/BFG + force-push) is intentionally **out of scope** here (force-push prohibited by this pack) and is only worth doing *after* rotation, as a separate gated decision.
3. Once the PR #7 branch merges, `main`'s HEAD will also stop shipping the file.

## EXIT: `CURRENT_TREE_RECONCILED`
