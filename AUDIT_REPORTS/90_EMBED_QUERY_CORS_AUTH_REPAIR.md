# 90 — Embed Query CORS/Auth Repair

## Deployment

- Previous observed live version: `50`.
- Deployed live version: `52`, `ACTIVE`, `verify_jwt=false` with application-level auth.
- Only `embed-query` was deployed.
- Provider route remains server-side: base endpoint plus `/embed/query`.
- Response contract is fixed to `armenian-text-embeddings-2-large`, dimension `1024`.
- Non-finite or wrong-dimension vectors are rejected.
- Provider model filesystem paths are not returned.
- Query size and provider timeout have controlled errors.

## Live evidence

- Metric service `/health`: HTTP success, status `ok`, dimension `1024`.
- Production origin preflight: `204`, exact origin reflected.
- `www` production origin preflight: `204`, exact origin reflected.
- Invalid origin: `403 cors_not_allowed`.
- Valid origin without auth: `401 Unauthorized`.
- No origin and no internal credential: `403`.
- Direct provider embedding request without provider key: denied.
- Contract tests: `3/3 PASS`.
- Full Edge tests: `55/55 PASS`.
- Secret values in response/log evidence: `0`.

## Blocker

A valid internal `200` call was not executed. The existing `INTERNAL_INGEST_KEY` is present remotely but intentionally unreadable, and no matching value exists in the secure local environment. It was not rotated solely to make a test pass. Therefore end-to-end vector finiteness through the live Edge function is not claimed.

Result: `EDGE_DEPLOYED_CORS_PASS_PROVIDER_HEALTH_PASS_INTERNAL_200_NOT_PROVEN`.
