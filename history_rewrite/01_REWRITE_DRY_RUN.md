# History Rewrite Dry-Run Plan

Generated (UTC): 2026-07-20T15:54:00Z
Status: PLAN ONLY — do NOT execute without APPROVE_HISTORY_REWRITE.

## Goal

Remove db_passwords.cjs (and the plaintext connection string it carried) from every reachable commit, across every affected ref, without exposing the credential during the operation.

## Recommended tool

git filter-repo (preferred) or BFG Repo-Cleaner. Do NOT use git filter-branch (slow, error-prone).

## Dry-run steps (no force-push yet)

1. Create a verified full backup of the repository (bare clone) before any rewrite.
2. Document all refs before rewrite (git show-ref > refs-before.txt).
3. In a throwaway clone, run the rewrite with the path-removal rule:
   - git filter-repo --path db_passwords.cjs --invert-paths
   (This removes the file from all history. Verify the replacement/removal rules do not touch unrelated files.)
4. Verify the secret is absent across rewritten history:
   - git log --all --source -p -- db_passwords.cjs (must be empty)
   - run a secret scan over all blobs in rewritten history (must be 0 matches for the credential pattern)
5. Record old/new object mapping (commit SHAs before/after) WITHOUT secret contents.
6. Confirm build and tests pass on the rewritten tree.
7. Produce re-clone instructions for every clone holder.

## Force-push scope (only after approval and dry-run verification)

- Force-push ONLY the intended refs (all affected branches listed in 00_EXPOSURE_MAP.md).
- Use --force-with-lease where supported, with the documented before-SHAs.
- Expire local reflogs only after post-rewrite verification confirms integrity.

## Risks

- Force-push rewrites shared history; every clone holder must re-clone or re-sync.
- Any missed fork/mirror/clone retains the old object.
- CI caches and release archives may retain the object and must be purged separately.
