# Rollback Plan

Generated (UTC): 2026-07-20T15:55:00Z

## Scope

This orchestrator performed NO production mutations, so no production rollback is required. The rollback plan covers the operator actions that will follow.

## Secret rotation rollback

- SECRET_002 (already rotated): no-overlap credential; rollback is to rotate again if the new password is lost. Old password is dead (28P01).
- Provider tokens (overlap-capable): capture current consumer config before rotation; restore the previous token if validation fails; revoke the new one only after the old is confirmed restored.
- No-overlap credentials (EMBEDDING_API_KEY, internal keys, Telegram pair, JWT): defined per final_closure/02 packets and 06_JWT_MAINTENANCE_RUNBOOK / 07_JWT_ROLLBACK_PLAN.

## RAG cutover rollback

SEARCH_CUTOVER = OFF. If cutover is later enabled, the rollback is to flip the LEGAL_SEARCH_* flags back to the previous primary and verify retrieval health. Cutover must not be enabled until all RAG gates pass.

## History rewrite rollback

See history_rewrite/03_BACKUP_AND_ROLLBACK.md. Keep a verified mirror backup before any force-push; restore from backup only if post-rewrite validation fails critically.

## Deployment rollback

Operator-side: keep the previous Vercel deployment URL; redeploy the prior SHA if a new deploy fails health checks. Edge functions: redeploy the previous function version from Supabase if a new deploy breaks the fleet.

## No-auto-merge

The convergence PR (when opened) is not auto-merged. Rollback from a bad merge is to revert the merge commit on the default branch.
