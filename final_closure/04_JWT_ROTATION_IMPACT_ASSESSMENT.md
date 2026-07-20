# Supabase JWT Signing Secret Rotation — Impact Assessment

Generated (UTC): 2026-07-20T15:51:00Z
Subject: SECRET_006 — Supabase JWT signing secret (project avmgtsonawtzebvazgcr)
Decision required: APPROVE_JWT_ROTATION or DEFER_JWT_ROTATION_WITH_ACCEPTED_RISK
Status: NOT_EXECUTED — operator-gated. This orchestrator will NOT rotate the JWT signing secret automatically.

## Why this is operator-gated

On the legacy Supabase JWT model, the signing secret derives every anon key, every service-role JWT, and every signed user session. Resetting it invalidates all of them simultaneously. There is no overlap window and no rollback (the previous signing secret is not recoverable).

## Active authentication flows affected

- Browser sessions: every signed-in user (client, lawyer, admin) is forcibly signed out.
- Server verification code: any server-side code that verifies Supabase JWTs must pick up the new signing secret.
- Edge Functions: all 50 edge functions that rely on JWT verification will reject old tokens until propagation completes.
- Scheduled jobs / service-to-service tokens: any long-lived token minted under the old secret stops validating.
- Vercel frontend: VITE_SUPABASE_ANON_KEY / VITE_SUPABASE_PUBLISHABLE_KEY must be updated in the Vercel project env after rotation.

## Expected session invalidation

All active user sessions end immediately on rotation. Users must re-authenticate. The anon/publishable key changes as a consequence and must be propagated to every browser-bundle consumer.

## Required maintenance window

A short announced downtime window is required because the change is non-overlapping. Recommended: low-traffic window; announce forced re-login in advance.

## Staged rollout possibility

Limited. Supabase exposes a single rotate action, not a gradual key rollover. Staging project (vavjajwiqsdhlweggalw) should be rotated first as a blast-radius rehearsal, with staging frontend and edge validation, before the production rotation.

## Rollback limitations

None — the previous signing secret is not recoverable. Rollback is only possible by rotating again to a new value and re-updating every consumer. This is a one-way operation.

## Post-rotation health checks

- New anon/publishable key present in Vercel project env (Production, Preview, Development).
- Browser login succeeds and a new session token validates.
- Edge functions with verify_jwt=true accept the new token.
- Edge functions with verify_jwt=false still pass via their shared-secret gate (unaffected by JWT rotation).
- Service-role operations still bypass RLS.
- No browser bundle contains a server-only key.

## Final-verdict impact

Until a decision is recorded, JWT_ROTATION_DECISION = PENDING and the active secret-rotation gate cannot be marked fully PASS. DEFER is acceptable if compensating controls (revoked DB password, RLS enforcement, audit logging) are documented and a review date is set.
