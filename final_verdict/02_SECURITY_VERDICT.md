# Security Verdict

Generated (UTC): 2026-07-20T15:55:00Z

## Verdict: PARTIAL — active P0 closed; remaining security gates blocked

### Active credential risk

- P0-001 (production Postgres password): ACTIVE_RISK = CLOSED. Rotated by operator; old rejected (28P01); new revalidated (select 1 as ok); Session pooler *.pooler.supabase.com:5432. Evidence: secret_rotation_audit/10_DATABASE_PASSWORD_ROTATION_EVIDENCE.json.

### Historical exposure

- P0-001 historical: PRESENT_BUT_REVOKED. Plaintext in commit 09023b0, ancestor of origin/main. History rewrite NOT_EXECUTED; pending APPROVE_HISTORY_REWRITE or DEFER (history_rewrite/05_DECISION.md).

### Provider rotations

- SECRET_002: ROTATED. All other 14 credentials: NOT_ROTATED (BLOCKED_PROVIDER_ACCESS). See final_closure/02_PROVIDER_ROTATION_ACTION_PACKETS.md.

### Consumer map

- PARTIAL — 9 consumers UNKNOWN (Vercel project scope, Supabase Edge Secret contents, GitHub Actions secrets, VPS systemd env, Cloudflare tunnel config, scheduled invoker).

### JWT signing secret

- SECRET_006: NOT_ROTATED, operator-gated. Decision PENDING. Do NOT rotate automatically (final_closure/04-07).

### Working-tree secret scan

- PASS — 0 real credential matches (7 pre-classified non-leaks: local defaults, placeholders, redacted audit prose).

### Reachable-history scan

- FAIL_HISTORY_RESIDUE_ONLY — revoked P0-001 plaintext still reachable.

### RLS / IDOR / Edge auth

- Not re-audited in this loop; interactive E2E branch verified IDOR 44/44, role tests 20/20, storage 19/19. Edge auth policy and RLS verification were part of prior security-PR branches (codex/security-pr-*); not re-run here.

## Sub-verdicts

- SECURITY_CRITICAL_GATE: PARTIAL
- ACTIVE_SECRET_ROTATION_GATE: PARTIAL
- SECRET_CONSUMER_MAP: PARTIAL
- JWT_DECISION: PENDING
- HISTORY_REWRITE_DECISION: PENDING
