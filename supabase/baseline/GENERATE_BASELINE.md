# Generating the authoritative schema baseline

The authoritative, replay-complete baseline is a **schema-only dump of production**,
produced with the Supabase CLI. It is not hand-written, because production contains
64 tables across `app`/`public`/`storage`/`internal` whose exact
columns/constraints/indexes/grants must match byte-for-byte for a clean replay —
`supabase db dump` guarantees that; manual transcription does not.

This step requires a **production database connection string**, which the audit
agent deliberately does not handle. Run it yourself (read-only; `db dump` only
reads the catalog):

```bash
# From the repo root, with the production DB URL available in your shell/vault.
# Read-only: db dump performs SELECTs against the catalog only.

supabase db dump \
  --db-url "$SUPABASE_PROD_DB_URL" \
  --schema app,public,storage \
  -f supabase/baseline/00_schema_baseline.sql

# Optional: capture the roles/grants layer separately if needed
supabase db dump --db-url "$SUPABASE_PROD_DB_URL" --role-only \
  -f supabase/baseline/01_roles.sql
```

Then:

1. **Redact / exclude data.** `db dump` with no `--data-only` is schema-only — verify
   the output contains **no `INSERT`/`COPY` of user rows** and **no secrets**
   (grep for `postgresql://`, `service_role`, `password`, `INSERT INTO`). Reference
   data seeds (document templates, ai_prompts) live separately under `supabase/seed/`,
   not in the schema baseline.
2. **Exclude managed objects.** Remove any `auth.*`, `realtime.*`, `vault.*`,
   `supabase_migrations.*`, `pgbouncer.*` sections the dump may include — the baseline
   is application schema only (`app`, `public`, `storage` policies).
3. **Order.** The baseline applies **before** `supabase/migrations/` on a fresh
   environment. `supabase/migrations/00000000000000_baseline.sql` symlink/copy, or an
   explicit `psql -f supabase/baseline/00_schema_baseline.sql` pre-step, wires it into
   the replay (Prompt 17 verifies the exact ordering on a disposable branch).
4. **Cross-check** the generated file against `supabase/baseline/00_app_authorization_core.reference.sql`
   (this repo) — the `app` authorization functions and `handle_new_user` body must match.

The reference file in this directory captures the security-critical `app.*`
authorization core exactly (from read-only catalog queries) so it can be reviewed in
diff independently of the full dump.
