# 04 — Secret Rotation Status

- Static hygiene: only `.env.example` tracked; `.gitignore` excludes real env files; no hardcoded
  secrets found in tracked `src/`/`supabase/functions/` (scan). No secret value handled here.
- Inventory (names only) + classification: see AUDIT_REPORTS/FINAL_04_SECRET_ROTATION.md.
- Rotation execution: NOT performed. Requires operator/provider console access and redeploys.

STATUS: BLOCKED_EXTERNAL_CREDENTIAL_REQUIRED.

Exact next action (operator, interactive): for each ACTIVE_ROTATION_REQUIRED key —
create new → add to consumer secret store (Supabase/Vercel/GitHub) → redeploy → verify new →
revoke old → verify old fails → scrub local residue → record rotation metadata (no values).
Never paste secrets into chat; enter them only into provider consoles / CI secret stores.
