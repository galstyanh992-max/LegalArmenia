# 100 — Status Scope Live Proof

Proof used stored production Metric vectors and read-only calls. No status rows were changed.

- Current: 30 semantic calls plus current identifier/no-answer calls returned only `active` rows.
- Extended: 10/10 calls completed; an `unknown` result with `UNCONFIRMED_STATUS` and a non-null legal warning was observed.
- Historical: 10/10 calls completed; a `repealed` result with `REPEALED_HISTORICAL` and a non-null legal warning was observed.
- Extended returned no repealed contamination.
- Current returned no unknown or repealed contamination.
- Total status contamination: `0`.
- Corpus/status writes: `0`.

Result: `STATUS_SCOPES_PASS`.
