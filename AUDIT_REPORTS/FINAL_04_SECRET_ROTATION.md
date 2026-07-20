# FINAL_04 — Secret Rotation

Base: origin/main = ad20a27. Mode: inventory + hygiene (names only, no values). Date: 2026-07-20.
No secret value is printed, stored, or transmitted in this report.

## 4.0 Static hygiene (repository)
- Only `.env.example` is tracked. No real `.env` in the tree.
- `.gitignore` excludes `.env`, `.env.local`, `.env.*.local`, `.env.*` (allowing `*.example`).
- Quick scan of tracked `src/` and `supabase/functions/` found no hardcoded `sk-…`, `gho_…`, or
  JWT-shaped secrets. No secret in tracked files (this scan).

## 4.1 Secret-name inventory (names only)
Server / Edge (Deno.env / config):
- SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ACCESS_TOKEN, DATABASE_URL
- EMBEDDING_ENDPOINT, EMBEDDING_API_KEY, EMBEDDING_MODEL, EMBEDDING_DB_MODEL, EMBEDDING_DIM
- OPENROUTER_API_KEY, OPENAI_API_KEY, COHERE_API_KEY, OLLAMA_CLOUD_API_KEY / OLLAMA_API_KEY,
  OLLAMA_CLOUD_BASE_URL, OPENAI_BASE_URL, OPENROUTER_BASE_URL
- INTERNAL_INGEST_KEY, CRON_WORKER_KEY
- TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET
- VERCEL_TOKEN
- EVAL_CLIENT_JWT, EVAL_CLIENT_EMAIL, TEST_USER_EMAIL, TEST_USER_PASSWORD (test fixtures)
Frontend (public, non-secret by design):
- VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_SUPABASE_PUBLISHABLE_KEY

## 4.2 Classification (by name / usage)
- ACTIVE_REQUIRED: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL, EMBEDDING_ENDPOINT,
  EMBEDDING_API_KEY, OPENROUTER_API_KEY (+ fallback providers actually enabled).
- PUBLIC_NON_SECRET: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_ANON_KEY (anon key is public by design; RLS-gated).
- ACTIVE_ROTATION_REQUIRED (periodic best practice): SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_ACCESS_TOKEN, VERCEL_TOKEN, TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET,
  INTERNAL_INGEST_KEY, CRON_WORKER_KEY, EMBEDDING_API_KEY, OPENROUTER_API_KEY, OPENAI_API_KEY,
  COHERE_API_KEY, OLLAMA_* keys.
- LOCAL_ONLY / TEST: EVAL_CLIENT_JWT, EVAL_CLIENT_EMAIL, TEST_USER_EMAIL, TEST_USER_PASSWORD.
- EXPOSED_ROTATE_IMMEDIATELY: none identified from tracked files in this scan.
- UNUSED_REMOVE / DUPLICATE_REMOVE / UNKNOWN_OWNER: not determinable without provider/console
  access; deferred to the interactive rotation step.

Note: whether any secret was exposed in historical terminal history, agent transcripts, CI logs,
or deployment logs cannot be determined from the repository alone and requires operator access to
those systems.

## 4.3 / 4.4 Rotation execution + post-rotation verification
Rotation is dependency-ordered (create new → add to consumers → deploy/restart → verify new →
revoke old → verify old fails → scrub residue → record metadata without values). Executing it
requires:
- provider consoles / dashboards (Supabase, OpenRouter, OpenAI, Cohere, Telegram, Vercel,
  Ollama Cloud) and the authority to create/revoke keys;
- redeploying Edge Functions and Vercel with the new values;
- these are credentialed, interactive operations not available in this non-interactive session.

## Phase 4 status
- SECRET_INVENTORY = COMPLETE (names only; no values handled).
- STATIC_SECRET_SCAN = PASS (only `.env.example` tracked; no hardcoded secret in tracked `src/`/`supabase/functions/`).
- SECRET_ROTATION_EXECUTION = NOT_PERFORMED (requires operator/provider console access + redeploys).
- OLD_SECRET_REVOCATION_VERIFIED = NO (no rotation executed; old keys not verified revoked).
- FINAL_SECRET_ROTATION_STATUS = BLOCKED_EXTERNAL_CREDENTIAL_REQUIRED.

No rotation performed. No value handled. The inventory + classification + ordered plan above is
the deliverable; execution is the exact-next-action once an operator with provider access runs it
interactively (secrets entered into provider consoles / CI secret stores, never into chat).
