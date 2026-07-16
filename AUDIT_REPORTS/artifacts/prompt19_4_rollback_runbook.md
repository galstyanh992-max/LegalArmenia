# Rollback runbook

1. Keep production unchanged; this branch is not deployed.
2. If approved later, retain the previous RPC and deterministic V1 commit as rollback target.
3. Disable V2 at the release boundary, restore the prior build, and verify Metric/FTS health.
4. Never enable Qwen or an experimental cross-encoder.
5. Re-run tenant authorization, citation, injection, and no-answer smoke tests.
