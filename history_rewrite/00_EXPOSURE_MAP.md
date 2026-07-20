# Git History Exposure Map — P0-001

Generated (UTC): 2026-07-20T15:54:00Z
Subject: revoked production Postgres password (SECRET_002) plaintext in reachable Git history.
Active credential risk: CLOSED (password rotated; old rejected with PostgreSQL error 28P01).
Historical exposure: PRESENT_BUT_REVOKED.

## Affected object

- File path: db_passwords.cjs
- Introduced in commit: 09023b0 (codex/armenian-legal-reranker)
- Later untracked in commits: 17d9bfe, 624460d (untracking does NOT remove from history)
- Present at current HEAD: false (file is no longer tracked)
- Reachable from origin/main: YES (git merge-base --is-ancestor 09023b0 origin/main = 0 / true)
- Content: a plaintext production Postgres connection string for the role on db.avmgtsonawtzebvazgcr.supabase.co (value NOT reproduced here)

## Branches/refs containing 09023b0 (local + remote)

The commit is reachable from a large number of refs, including:
- main, origin/main, origin/HEAD
- codex/armenian-legal-reranker, codex/final-closure-master-loop, codex/final-secret-rotation-closure, codex/interactive-e2e-closure, codex/rag-citation-retrieval-closure
- codex/prompt-18-production-hardening, codex/prompt-19-1-metric-rpc, codex/prompt-19-2-legal-reranker, codex/prompt-19-3-custom-armenian-reranker, codex/prompt-19-5a-live-infrastructure-unblocking, codex/prompt-19-6-citation-injection-final, codex/prompt-19-7-structured-metadata
- codex/security-pr-c-* / pr-d* / pr-f, codex/supabase-replay-verification, codex/v3-shadow-verification
- backup/prompt19-7-before-large-file-cleanup, backup/prompt19-7-before-main-merge
- and several hotfix/release branches

Implication: a history scrub, if approved, must rewrite ALL affected refs (not just main) and coordinate every clone holder.

## Forks / mirrors / deployment clones / CI caches / release archives — UNKNOWN

These cannot be enumerated from this environment and require the operator to inventory:
- GitHub forks of galstyanh992-max/LegalArmenia
- Any mirrors
- Deployment clones (Vercel build, CI runners, VPS)
- CI caches and logs that may have captured the object
- Release archives / downloaded zips
- Developer clones

## Safety

The credential is revoked, so the active risk is closed. The historical artifact remains recoverable by anyone with read access to the repository or any ref containing 09023b0. The scrub removes the artifact; rotation already defused the credential.
