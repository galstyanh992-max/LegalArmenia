# Prompt 19.3 rollback

No production rollout occurred. `LEGAL_RERANKING_ENABLED` remains false.

If a future approved custom reranker canary fails: disable the feature flag; remove the custom endpoint from server-side configuration; verify telemetry reports deterministic fallback; retain identifier + Metric ANN + Armenian FTS + deterministic legal scorer + status/temporal guards; revoke the new reranker-only secret; preserve logs without query/corpus bodies; rerun citation, no-answer, injection and tenant-isolation checks before any re-enable.
