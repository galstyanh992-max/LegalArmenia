# 50 — Reranker security tests

## Passed controls

- Bearer authentication; unauthorized direct request returns 401.
- Malformed JSON, empty query, duplicate IDs and untrusted/tenant metadata rejected.
- Oversized query, batch and candidate text rejected deterministically.
- Missing, duplicate, invented and non-finite model outputs rejected.
- Candidate text is data; HTML/JSON/Markdown/pseudo-system instructions cannot change IDs or override scores.
- Current status hard guard removes unknown/repealed rows before return.
- Actual abort timeout performs at most one retry; circuit breaker opens.
- No access/request-body logging; no committed secret pattern in 186 scanned files.
- `.env*` diff count: 0; service-role exposure added: 0.

Python contract: 5/5. Deno contract: 9/9. Short authenticated load probes preserve all IDs, 12/12 for both models.

## Blocked measurement

The frozen snapshot intentionally excludes tenant data. Cross-tenant leakage is therefore not measurable and is not reported as zero. Extra `tenant_id` metadata is rejected with 422, but production approval requires a tenant-aware staging corpus and authorization-boundary test.

Corpus adversarial ranking pass rate is 0.5 for D/GTE/BGE test outputs; service contract resistance is 1.0. Release remains blocked.
