# JWT Signing Secret Rotation — Rollback Plan

Generated (UTC): 2026-07-20T15:51:00Z

## Hard constraint

The Supabase JWT signing secret has NO recoverable rollback. The previous signing secret is destroyed on rotation. This is a one-way operation.

## Only available "rollback"

Rotate the signing secret again to a fresh value and re-propagate to every consumer. This does not restore the prior state; it produces a new valid state.

## Pre-rotation capture (for recovery, not rollback)

- Record consumer names and update mechanisms (see 05_JWT_CONSUMER_INVENTORY.json) — no key values.
- Confirm the Vercel project is identified before rotation so re-propagation is possible.
- Confirm a frontend redeploy path is ready.

## Failure handling

- Browser login fails after rotation: verify Vercel env update and redeploy completed; verify the new publishable key is the one the platform emitted.
- Edge functions reject all tokens: verify platform key propagation completed; verify_jwt=false functions are unaffected and confirm shared-secret gate intact.
- If recovery is not achievable, rotate to a fresh value and re-propagate; escalate to operator.

## Final-verdict impact

Because rollback is unrecoverable, DEFER_JWT_ROTATION_WITH_ACCEPTED_RISK is a valid operator choice. If deferred, record residual risk, compensating controls, owner, and review date in final_verdict/08_RESIDUAL_RISKS.md.
