# JWT Signing Secret Rotation — Maintenance Runbook

Generated (UTC): 2026-07-20T15:51:00Z
Prerequisite: APPROVE_JWT_ROTATION received from operator. Do NOT execute without explicit approval.

## Pre-flight (do NOT skip)

1. Confirm staging project vavjajwiqsdhlweggalw rotation rehearsal completed (or explicitly waived by operator).
2. Identify the Vercel production project that owns the frontend (prerequisite for step 5).
3. Announce the maintenance window and forced re-login to users.
4. Capture current consumer configuration for rollback documentation (no secret values).

## Execution (operator-side, via Supabase Dashboard)

1. Supabase Dashboard -> project avmgtsonawtzebvazgcr -> Settings -> API -> Rotate JWT secret.
2. Copy the new anon/publishable key (operator-side only; never paste into chat or commit).
3. Update VITE_SUPABASE_ANON_KEY / VITE_SUPABASE_PUBLISHABLE_KEY in the Vercel project env (Production, Preview, Development).
4. If rotating SECRET_001 (service-role) in the same window, do so now and update local .env / ops scripts.
5. Trigger a frontend redeploy so the browser bundle picks up the new publishable key.

## Post-rotation health checks

- Browser login succeeds; new session token validates.
- Edge functions verify_jwt=true accept new token.
- Edge functions verify_jwt=false still pass via shared-secret gate.
- Service-role operations still bypass RLS.
- Browser bundle secret scan: no server-only key exposed.

## Communication

- Announce completion and forced re-login in the same channel used for the window notice.
- Record sanitized evidence in final_closure/01_SECRET_CONSUMER_INVENTORY.json and final_verdict/03_SECRET_ROTATION_VERDICT.md.

## Stop conditions

- If any post-rotation health check fails, do NOT roll back by guessing the old secret (it is unrecoverable). Rotate again to a fresh value and re-propagate. Escalate to operator immediately.
