# 98 — Internal Edge Auth Verification

- Existing `INTERNAL_INGEST_KEY` contract was retained and rotated with a cryptographically random 256-bit value.
- Secret values printed, returned, logged, or committed: `0`.
- `embed-query` now compares internal credentials without content-dependent early return.
- Correct internal secret → HTTP `200`.
- Wrong internal secret → HTTP `403`.
- Missing internal secret → HTTP `403`.
- Valid internal embedding: dimension `1024`, all values finite, model `armenian-text-embeddings-2-large`.
- Approved browser preflight → `204`.
- Foreign browser origin → `403`.
- Approved origin without user authentication → `401`.
- Live `vector-search` → internal `embed-query` chain → HTTP `200`.
- Raw embedding provider remains server-side and API-key protected.

`embed-query` is live at version `55`. `vector-search` code was not deployed; secret propagation advanced its runtime version to `43`, while its user route remains the old dual RPC. Replay resistance is not separately implemented because this is a TLS-protected request credential rather than a signed one-time message; rotation and constant-time comparison are in place.

Result: `INTERNAL_AUTH_PASS`.
