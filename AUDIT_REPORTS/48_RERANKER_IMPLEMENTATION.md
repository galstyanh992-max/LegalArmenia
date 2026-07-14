# 48 — Reranker implementation

## Service and client

- Authenticated `POST /rerank`; `/v1/rerank` compatibility alias.
- Immutable model/revision allowlist; GTE remote-code revision pinned.
- Request limits: 100 candidates, bounded query/candidate text, unique IDs, strict trusted metadata.
- Response requires the exact candidate-ID set, finite raw score, normalized score in [0,1], exact model and revision.
- One retry maximum, AbortController timeout, endpoint circuit breaker, deterministic fallback and truthful degraded telemetry.
- Access logging disabled; request bodies, queries, candidates and bearer secrets are not logged.

## Ranking pipeline

The local module implements status/temporal hard guards, 35-feature scorer, bounded cross-encoder batch, strict response validation, duplicate collapse, document cap, source diversity and calibrated no-answer.

No generic model passed the gates. Therefore no live Edge caller was wired to the reranker and `LEGAL_RERANKING_ENABLED` must remain false. Existing Metric-only retrieval remains the production design pending separate approval; no Edge deployment or database migration was performed.

## Failure behavior

Timeout/auth/HTTP/invalid-response failures never report `reranker_ok=true`. Fallback route is `identifier+metric_hy+fts+deterministic_legal_score`; the circuit opens after the configured failure threshold and resets only after cooldown.

## Verification

Python service contract 5/5; Deno reranker contract 9/9; full Edge suite 47/47. The disabled-runtime contract preserves existing order and reports no fictitious reranker success.
