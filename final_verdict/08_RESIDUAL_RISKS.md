# Residual Risks

Generated (UTC): 2026-07-20T15:55:00Z

## Blocking residual risks (not yet accepted)

1. Historical P0-001 plaintext in reachable Git history — revoked but not scrubbed. Owner: operator. Decision pending (APPROVE_HISTORY_REWRITE or DEFER). Review date: unset.
2. 14 provider credentials NOT_ROTATED — active risk if any were also exposed. Owner: operator. Action: provider rotation packets (final_closure/02).
3. JWT signing secret NOT rotated — owner: operator. Decision pending. Review date: unset.
4. 9 unknown consumers — owner: operator. Action: enumerate Vercel scope, Supabase Edge Secrets, scheduled invoker.
5. RAG live chain / coverage / retrieval evaluation NOT_EXECUTED — owner: operator (provide endpoint + retrieval caller).
6. Licensed lawyer review NOT performed — owner: external licensed lawyer.
7. Deployment health unverified — owner: operator (provider access).

## Non-blocking residual risks (documented)

- Pre-existing typecheck errors on origin/main (CaseDetail.tsx, Dashboard.tsx, MyDocuments.tsx — nullable DB types vs component props; generated DB types missing 'cases' table). Build and tests pass; swc strips types. Owner: engineering. Not blocking the build gate but must be resolved before a strict typecheck gate can pass. Review date: unset.
- COHERE_API_KEY legacy/unused — recommend decommission. Owner: operator.
- Two deno edge test failures under Windows CRLF checkout (pass under LF) — environment artifact; on CI/Linux these pass. Owner: engineering (consider .gitattributes eol=lf for .sql/.ts in a separate change).

## Acceptance

No residual risk has been formally accepted yet (no DEFER_*_WITH_ACCEPTED_RISK decisions recorded). Residual risks become accepted only when the operator supplies the explicit DEFER decision strings with owner and review date.
