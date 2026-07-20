# Clone Coordination Plan

Generated (UTC): 2026-07-20T15:54:00Z
Prerequisite: APPROVE_HISTORY_REWRITE.

## Clone holders to coordinate

- All developers with a local clone (must re-clone or run git fetch + reset to new history).
- Vercel build environment (re-deploy from rewritten default branch).
- CI runners (purge caches; re-run from rewritten history).
- VPS deployment clones.
- Any backup repositories and mirrors.
- GitHub forks (operator must enumerate and notify fork owners).

## Communication

- Notify all clone holders of the force-push window before executing.
- Provide re-clone instructions and the old/new ref mapping (no secret contents).
- After the force-push, confirm each known clone holder has re-synced.

## Verification after coordination

- Confirm no affected ref still points at old history.
- Confirm secret scan over all rewritten refs is clean.
- Confirm production deployments still function from rewritten default branch.
