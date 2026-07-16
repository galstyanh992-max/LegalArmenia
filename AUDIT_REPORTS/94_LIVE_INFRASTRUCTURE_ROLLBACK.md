# 94 — Live Infrastructure Rollback

Rollback was prepared but not executed.

1. Keep `METRIC_RPC_SHADOW_ENABLED=false`.
2. Keep the user route on the unchanged old dual RPC.
3. Restore the captured previous `embed-query` source from the operator snapshot and deploy only `embed-query` with `--no-verify-jwt` if Edge rollback is required.
4. Restore prior secret values only from the operator's secure secret store; values cannot be read back from Supabase and are not present in this repository.
5. If removal of the additive database object is explicitly approved, execute `scripts/live_infra/prompt19_5a_rollback.sql` and mark migration `20260714165009` reverted in the migration ledger.
6. Confirm PostgREST no longer exposes the new RPC if it was removed.
7. Smoke the unchanged old production route.
8. Re-run corpus, embedding, Qwen, index, and old dual RPC hash invariants.

Safety properties:

- No corpus restoration is needed because corpus DML was `0`.
- Old dual RPC and Qwen artifacts remain intact.
- Previous Edge source snapshot exists outside the repository at the controlled operator workspace.
- Automatic rollback is not warranted because the existing user search route was never cut over.

Result: `ROLLBACK_PREPARED_NOT_EXECUTED`; prior secret restoration requires operator-held values.
