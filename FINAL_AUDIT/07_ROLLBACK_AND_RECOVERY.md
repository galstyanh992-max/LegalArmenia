# 07 — Rollback & Recovery

## This audit
- Read-only against production/staging; no DB object changed. Nothing to roll back on the databases.
- Repository: documentation-only artifacts on branch `codex/final-closure-master-loop`
  (worktree D:\1V\LegalArmenia-final-closure). Revert = delete the branch / revert the doc commit.
  No implementation PR was opened; no auto-merge.

## Existing remediation rollbacks (already in repo, for the applied hardening)
- supabase/rollback/20260718230128_hotfix_get_embedding_metrics_service_role_only_rollback.sql
- supabase/rollback/20260719000000_hotfix_trigger_function_execute_grants_rollback.sql
- supabase/rollback/20260719000001_harden_postgres_default_privileges_rollback.sql
- PR-A containment rollback for record_ai_metric (documented in PR_A evidence).
These keep the safe fail-closed bodies and only narrow ACLs; they never restore a vulnerable body.

## If a future authorized change is made
- Every implementation PR must ship a forward migration + matching rollback + staging evidence
  before any production apply, behind an explicit production-authorization gate.

## Search cutover recovery
- Cutover is flag-gated (V3 primary/shadow OFF). Recovery from a bad cutover = flip flags OFF;
  no data migration involved. Do not enable without the FINAL_AUDIT/06 gate satisfied.

## Cases compatibility
- No change made. If staging/production parity is later addressed, treat as a reviewed
  compatibility change with its own forward+rollback; production currently relies on the
  auto-updatable view and needs no trigger.
