# 101 — Metric RPC V2 Rollback

Rollback is routing-only by default because no user route points to V2.

1. Keep `METRIC_RPC_SHADOW_ENABLED=false`.
2. Keep live users on the unchanged old dual RPC.
3. If V2 removal is explicitly approved, execute `scripts/live_infra/prompt19_5b_rollback.sql`.
4. Mark migration versions `20260715024359` and `20260715023423` reverted, newest first.
5. Verify PostgREST no longer exposes V2.
6. Re-run corpus, status, Metric, Qwen, old V1, and old dual invariants.
7. Restore the prior `embed-query` deployment only if the constant-time auth change itself must be reverted.
8. Restore the prior internal secret only from an operator-held secure copy; Supabase does not expose secret values.

No corpus restoration or index rollback is required. Automatic rollback is not warranted: all V2 performance, auth, and scope gates passed, while user cutover remains disabled.
