# 41 — Unknown corpus recovery results

## Production baseline (read-only)

| Status | Chunks |
|---|---:|
| active | 779,040 |
| unknown | 669,292 |
| repealed | 41,448 |

No status or corpus row was changed. “Recovery” means that the new local contract can retrieve existing `unknown` rows in `extended`; it becomes live only after separately approved production rollout.

## Scope behavior

| Scope | Eligible statuses | Warning behavior |
|---|---|---|
| current | active | no unknown/repealed rows |
| extended | active, unknown | unknown: `Статус действия документа не подтверждён.` |
| historical | active, unknown, repealed | repealed: `Документ утратил силу или помечен как недействующий.` |

Reason codes are `CURRENT_ACTIVE`, `UNCONFIRMED_STATUS`, and `REPEALED_HISTORICAL`. The returned contract includes status, scope, eligibility, reason, warning, and effective dates.

## Verification

- SQL fixtures prove `current` excludes unknown/repealed, `extended` admits unknown but excludes repealed, and `historical` admits all three.
- Scope predicates are present in identifier, ANN, and FTS candidate generation and before final result construction.
- The 90-query provisional evaluation produced zero status-contamination rows in all four compared modes.
- Unknown/repealed warning failures: zero.
- Failed expected-result queries: zero.
- Evaluation fixtures remaining after rollback: zero.

Artifacts: `prompt19_1_evaluation.json`, `prompt19_1_raw_metrics.json`, and `prompt19_1_failed_queries.jsonl`.

