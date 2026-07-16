# 89 — Live Secret Configuration

- Project: `avmgtsonawtzebvazgcr`
- Secret values printed or committed: `0`
- `.env*` files changed: `0`
- `EMBEDDING_ENDPOINT`: configured from the secure local environment; updated.
- `EMBEDDING_API_KEY`: configured in live; preserved because no replacement value was present locally.
- `ALLOWED_ORIGINS`: configured for the two production origins; wildcard is not used.
- `INTERNAL_INGEST_KEY`: configured in live and required by the deployed internal-call contract; preserved because Supabase does not expose its value and no replacement value was present locally.
- `METRIC_RPC_SHADOW_ENABLED`: configured as `false`.
- Shell variables holding credentials were cleared after each operation.
- JWT, anon, service-role, and database credentials were not rotated.

Result: `PASS_WITH_VALID_INTERNAL_CALL_NOT_EXECUTABLE_FROM_OPERATOR_ENV`.
