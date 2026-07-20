# Backup and Rollback — History Rewrite

Generated (UTC): 2026-07-20T15:54:00Z

## Pre-rewrite backup

1. Create a bare clone of the current repository: git clone --mirror <origin> legalarmenia-backup-before-rewrite.git
2. Store the backup outside the working tree; record its path and the before-SHA of every ref (refs-before.txt).
3. Verify the backup is a complete mirror (git -C backup show-ref matches origin).

## Rollback concept

History rewrite is not cleanly reversible on shared history: once force-pushed, old SHAs are only recoverable from the backup or from reflogs before they expire. Therefore:

- Keep the backup until every clone holder has re-synced AND post-rewrite validation passes.
- If post-rewrite validation fails critically, the backup can be re-pushed (force) to restore the pre-rewrite history; but any clones that already re-synced to rewritten history would then need to re-sync again. Prefer fixing the rewrite and re-pushing.

## Reflog handling

- Do NOT expire local reflogs until post-rewrite validation (04) confirms integrity and the backup is verified.
- After validation, expire reflogs and run git gc --prune=now on the rewritten clone to drop unreachable old objects.
