# Provider Credential Rotation — Operator Action Packets

Generated (UTC): 2026-07-20T15:51:00Z
Status: BLOCKED_PROVIDER_ACCESS
Policy: One provider / one approval domain per packet. No secret value, complete DATABASE_URL, access token, service-role key, JWT, or authorization header may be pasted into chat or committed. Supply PASS/FAIL evidence, provider-generated IDs, and last-four fingerprints only.

The production database password (SECRET_002) is already rotated and verified (28P01 negative test, select 1 revalidation, Session pooler). It is NOT repeated here.

## Packet A — Supabase service-role key (SECRET_001)

- Owner: operator (project owner)
- Required action: Supabase Dashboard -> project avmgtsonawtzebvazgcr -> Settings -> API -> rotate service-role key (legacy JWT model: coupled to SECRET_006; prefer rotating after the JWT signing-secret decision is recorded)
- Consumers to update: edge runtime is auto-injected; root ops scripts and tests read from local .env; GitHub Actions workflow consumer status UNKNOWN
- Expected safe evidence: "service-role key rotated; old key returns 401 invalid API key on GET /rest/v1/ with old Authorization; new key returns 200 on a low-cardinality metadata read"
- Validation command (operator-side): authenticated REST read with old key (expect 401), then new key (expect 200)
- Rollback: overlap-capable on legacy JWT model only after SECRET_006 decision
- Forbidden to paste: any sb_secret_/service-role value, any JWT

## Packet B — Vercel (SECRET_004 VERCEL_TOKEN + frontend env)

- Owner: operator
- Prerequisite: identify the Vercel team/project that owns the production deployment (authorized team currently exposes zero projects from this environment)
- Required action: enumerate Vercel project env vars by Production/Preview/Development; rotate VERCEL_TOKEN; verify VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are present per environment; confirm no server-only secret is exposed via NEXT_PUBLIC_/VITE_ browser bundles
- Expected safe evidence: "Vercel project <project_id> identified; VERCEL_TOKEN rotated; deployment <deployment_url> healthy; env var names present; browser bundle secret scan clean"
- Forbidden to paste: vcp_ tokens, any VITE_ key value

## Packet C — GitHub (SECRET_005)

- Owner: operator
- Required action: revoke stale PATs at github.com/settings/tokens; issue least-privilege replacement; enumerate repository Actions secrets and deploy keys; verify no secret is written to workflow logs
- Expected safe evidence: "old PAT revoked (github.com/settings/tokens shows revoked); new PAT scopes read:repo, workflows as needed; repo secrets enumerated by name"
- Forbidden to paste: ghp_/gho_/ghs_ tokens

## Packet D — AI providers (SECRET_007-010)

- Owner: operator
- Required action per provider (OpenRouter, OpenAI, Ollama Cloud, Gemini): confirm the key is actually used; remove obsolete variables; rotate active key; update edge secret; run a minimal authenticated models-list or completion call; revoke old key; record model and endpoint name (not the key)
- Expected safe evidence per provider: "key rotated; old key rejected; minimal authenticated call returned 200; model identity = <name>"
- Forbidden to paste: sk-/sk-or-v1-/AIza keys

## Packet E — Telegram (SECRET_013/014)

- Owner: operator
- Required action: rotate bot token via BotFather; rotate webhook secret; re-run setWebhook; verify webhook signature with a controlled test update; revoke old token
- Expected safe evidence: "bot token rotated via BotFather; setWebhook returned ok; controlled test update delivered and signature verified"
- Forbidden to paste: bot tokens, webhook secrets, chat IDs

## Packet F — VPS embedding service (SECRET_015)

- Owner: operator
- Required action: rotate EMBEDDING_API_KEY; update VPS systemd unit env and all callers; restart only the affected service; verify health endpoint, authorized embedding request (correct model + dimension), and unauthorized-request rejection; sanitize service logs
- Expected safe evidence: "EMBEDDING_API_KEY rotated; VPS service restarted; health endpoint 200; authorized request returned vectors of dimension <N>; unauthorized request rejected; model identity = <name>"
- Forbidden to paste: EMBEDDING_API_KEY, internal service credentials

## Packet G — Internal keys (SECRET_011/012)

- Owner: operator
- Prerequisite: identify the scheduled invoker that calls the 26 verify_jwt=false pipeline functions (currently UNKNOWN)
- Required action: regenerate INTERNAL_INGEST_KEY and CRON_WORKER_KEY (random 32+ bytes); update edge secrets and the caller side atomically; verify a controlled authenticated ingest; verify old key rejected
- Expected safe evidence: "scheduled invoker identified; both keys regenerated; controlled ingest succeeded; old keys rejected"
- Forbidden to paste: INTERNAL_INGEST_KEY, CRON_WORKER_KEY

## Packet H — Cohere (SECRET_018)

- Owner: operator
- Recommended action: decommission rather than rotate — remove COHERE_API_KEY variable and the dead Deno worker fallback path
- Expected safe evidence: "COHERE_API_KEY variable and fallback path removed; build and edge tests pass"

## Consolidated operator action

Provide sanitized PASS/FAIL evidence for one packet at a time. After each packet, the orchestrator resumes from the last checkpoint and updates final_closure/01_SECRET_CONSUMER_INVENTORY.json and the relevant verdict artifact without restarting the audit.
