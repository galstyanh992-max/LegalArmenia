# 75 — Deterministic search production plan

## Metric endpoint

Replace Quick Tunnel with an approved persistent Cloudflare Tunnel hostname, origin authentication, separately rotatable secret, `/healthz` and `/readyz`, startup warmup, request-body logging disabled, bounded timeout/retry, uptime/latency alerts, supervised restart and FTS-only fallback. Store no secret in Git. Do not rotate production secrets without separate approval.

## Supabase

Keep RPC execution least-privileged and RLS-aware. Current Supabase platform changes were checked: nested Edge Function calls have hosted rate limits, and anonymous OpenAPI schema access was removed; neither authorizes a production change here. Replay the existing migration in disposable local/staging databases before approval.

## Rollout

1. Repair and backfill trusted citation/version/source metadata in staging.
2. Rebuild candidate pools and complete two-lawyer review plus adjudication.
3. Reach citation document 1.00, provision >=0.95 and injection 1.00 on untouched release gold.
4. Pass production-like multi-tenant staging with measured leakage 0.
5. Provision persistent Metric endpoint and validate FTS fallback.
6. Obtain explicit migration/deployment/secret approval.
7. Canary deterministic V2; monitor citation, no-answer, tenant and latency signals; rollback per runbook.

No migration or deployment was performed.
