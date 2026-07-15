# 64 — Custom reranker production plan

No deployment is authorized. Deterministic legal scorer D remains the best operational option and custom reranking stays disabled.

Future sequence: complete two-lawyer review/adjudication; repair citation metadata/candidate coverage; rebuild legally reviewed hard negatives; train an unfrozen or adapted Armenian legal encoder; require ≥0.03 supported quality effect or substantial citation/status gain; reach citation/injection/no-answer gates; validate real tenant-aware staging RLS; run 50-candidate load/soak; obtain security/legal/infrastructure approval; deploy private service with flag false; canary an approved cohort; monitor and use `prompt19_3_rollback_runbook.md` on any breach.
