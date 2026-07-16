# V3 STAGED CUTOVER PLAN

V3 (`search_legal_corpus_metric_v3`) replaces the primary only after Stage A production deploy is stable, shadow validation PASSes, and human legal review is complete. Cutover is feature-flag based, incremental, reversible, and never 100% in one step.

## Feature flags (Edge Function secrets)

| Flag | Default | Meaning |
|---|---|---|
| `LEGAL_SEARCH_PRIMARY` | `metric` | Active primary route (`metric` = `search_legal_corpus_metric`; `dual` preserved as fallback) |
| `LEGAL_SEARCH_V3_SHADOW` | `false` | Master switch for non-primary V3 shadow comparison |
| `LEGAL_SEARCH_V3_PRIMARY` | `false` | Promotes V3 to the primary response path (Stage A: MUST stay false) |
| `LEGAL_SEARCH_V3_TRAFFIC_PERCENT` | `0` | 0..100 deterministic-per-request sampling of shadow (and, later, V3-primary traffic) |

Semantics: shadow runs only when `LEGAL_SEARCH_V3_SHADOW=true` AND sampled by `LEGAL_SEARCH_V3_TRAFFIC_PERCENT`. The shadow path cannot promote V3 even if `LEGAL_SEARCH_V3_PRIMARY=true` is misconfigured (defense-in-depth guard in `v3-shadow.ts`).

## Stages

| Stage | V3 primary traffic | Observation window | Max error rate | Max p95 latency | Max citation regression | Max no-answer regression | Rollback trigger | Rollback action |
|---|---|---|---|---|---|---|---|---|
| 0 | 0% (shadow only) | 24h | n/a (shadow) | shadow ? 4s timeout, 0 user impact | n/a | n/a | any shadow data loss/PII leak | flags ? all false, redeploy |
| 1 | internal/admin-only | 48h | < 1% | +10% vs baseline | 0 regression | 0 regression | any gate breach | `LEGAL_SEARCH_V3_PRIMARY=false` + redeploy |
| 2 | 5% eligible | 72h | < 0.5% | +10% | < 2% | < 2% | error/latency/citation breach | flags ? false, redeploy |
| 3 | 25% | 72h | < 0.5% | +10% | < 2% | < 2% | breach | flags ? false, redeploy |
| 4 | 50% | 72h | < 0.5% | +10% | < 2% | < 2% | breach | flags ? false, redeploy |
| 5 | 100% | ongoing | < 0.5% | +10% | < 2% | < 2% | breach | flags ? false, redeploy |

## Rollback (no DB migration)

```
supabase secrets set LEGAL_SEARCH_V3_PRIMARY=false LEGAL_SEARCH_PRIMARY=metric LEGAL_SEARCH_V3_SHADOW=false LEGAL_SEARCH_V3_TRAFFIC_PERCENT=0 --project-ref avmgtsonawtzebvazgcr
supabase functions deploy kb-unified-search vector-search --project-ref avmgtsonawtzebvazgcr
```
Estimated time: < 2 min. Validation: `search_legal_corpus_metric` serves user responses; V3 grants unchanged (read-only).

## Gates required before each stage advance

- Shadow telemetry stable (no timeout/error spike, overlap@K stable).
- Quality gates (Recall@5/10, MRR, nDCG@10, exact provision accuracy, citation accuracy, status correctness, no-answer precision/recall, false-positive rate) within thresholds on a fixed query set.
- Latency p50/p95/p99 within budget; timeout/error rate within budget.
- Tenant/security negative tests green (cross-tenant denial, anon denial, authenticated-no-EXECUTE-V3, body user_id spoofing denied, cache key tenant-scoped).
- Legal review status: Stage 1+ require LEGAL_REVIEWED_GOLD PASS. Stage 0 (shadow) may run with legal review pending.
- No PII in telemetry; no service-role key in frontend bundle; no V3 call from browser.

## Hard rules

- Never 100% in one step.
- Never auto-advance; each stage requires operator sign-off after the observation window.
- Rollback is always feature-flag based and does not require a migration.
- If a production migration incident occurs, stop, do not continue, and use the additive rollback files only with a confirmed incident.