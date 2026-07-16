# Prompt 19.2 rollback runbook

No Prompt 19.1 or Prompt 19.2 production deployment was performed.

If a future approved reranker deployment must be rolled back:

1. Set `LEGAL_RERANKING_ENABLED=false` in the approved server-side Edge environment.
2. Redeploy the last approved Edge Function revision; do not change the Metric-only RPC or corpus.
3. Revoke the reranker-only bearer secret and stop the private reranker service.
4. Verify telemetry reports `reranker_ok=false`, `degraded=false`, and the Metric route remains `identifier+metric_hy+fts`.
5. Run exact identifier, current, extended, historical, unknown-warning and no-answer smoke tests.
6. Confirm service-role keys are absent from clients/logs and reranker ports are not publicly reachable.
7. Preserve evaluation artifacts and incident logs; do not delete Qwen rows/index or the old dual RPC as part of this rollback.

Rollback trigger conditions include citation regression, current-law contamination, cross-tenant leakage, no-answer hallucination above 2%, authentication failure, repeated timeout/circuit opening, or p95 above the approved budget.
