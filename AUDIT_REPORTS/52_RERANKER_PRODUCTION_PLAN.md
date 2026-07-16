# 52 — Reranker production plan

## Current decision

No production deployment is authorized. Generic rerankers are rejected; Edge callers remain unwired and the feature flag remains false.

## Required custom Armenian legal cross-encoder

1. Complete two independent lawyer reviews, adjudication and agreement reporting on blinded pools.
2. Diagnose citation, repealed-warning and adversarial failures; add reviewed hard negatives without changing the frozen test.
3. Train a non-Qwen Armenian legal cross-encoder on train only; choose architecture, blend and calibration on dev only.
4. Freeze model/tokenizer/code revisions, hashes, license review, model card and data lineage.
5. Run the unchanged A–E matrix, paired statistics, tenant-aware security tests and full 50–100-candidate staging load.
6. Require every quality/security gate, material MRR+nDCG improvement, no recall/citation/no-answer regression and approved latency/cost.

## Exact future deployment sequence

1. Obtain legal-gold, security, infrastructure and production approvals.
2. Deploy the authenticated reranker privately with no public ingress and a new server-side secret.
3. Deploy feature-flagged Edge integration to tenant-aware staging only; flag default false.
4. Run identifier/current/extended/historical/unknown/repealed/no-answer/injection/cross-tenant/end-to-end checks and load soak.
5. Record approved model revision, endpoint, limits, thresholds and rollback owner.
6. Canary production with flag false, then enable for an approved cohort only; monitor citation, contamination, no-answer, timeout and p95.
7. Stop and execute `prompt19_2_rollback_runbook.md` on any trigger breach.

## Remaining blockers

Legal review/adjudication; citation accuracy 1.00; repealed warning recall 1.00; adversarial ranking 1.00; tenant-aware leakage 0 measurement; custom model material improvement; p95 budget; live end-to-end staging performance; production approvals. No production write or deployment occurred.
