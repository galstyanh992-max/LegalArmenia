# History Rewrite Decision

Generated (UTC): 2026-07-20T15:54:00Z
Status: PENDING_OPERATOR_APPROVAL

The active database credential (SECRET_002 / P0-001) is already CLOSED — the password was rotated by the operator and the old password was rejected with PostgreSQL error 28P01. The historical plaintext remains in reachable Git history (commit 09023b0, ancestor of origin/main) but is now a revoked, inactive credential.

This orchestrator will NOT rewrite history automatically. Two explicit operator decisions are possible:

## Option A — APPROVE_HISTORY_REWRITE

Requires exact operator text: APPROVE_HISTORY_REWRITE

Then the orchestrator (with operator) executes 01_REWRITE_DRY_RUN.md -> 03_BACKUP_AND_ROLLBACK.md -> force-push all affected refs (02_CLONE_COORDINATION_PLAN.md) -> 04_POST_REWRITE_VALIDATION.md. A dry-run plan and backup verification are produced BEFORE any force-push. Force-push is used ONLY on the intended refs.

## Option B — DEFER_HISTORY_REWRITE_WITH_ACCEPTED_RISK

Requires exact operator text: DEFER_HISTORY_REWRITE_WITH_ACCEPTED_RISK

Then the orchestrator records:
- credential is revoked
- active risk is closed
- historical exposure remains
- force-push risk outweighs immediate benefit (operator judgment)
- owner: operator
- review date: ______ (operator sets)
- compensating controls: rotated DB password (28P01 verified), RLS enforcement, audit logging, restricted repository read access

## Current recorded state

HISTORY_REWRITE_DECISION = PENDING_OPERATOR_APPROVAL
HISTORY_REWRITE_STATUS = NOT_EXECUTED

Do NOT silently choose either option. The decision must be explicit operator text.
