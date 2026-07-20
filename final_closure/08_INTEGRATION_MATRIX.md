# Final Integration Matrix

Generated (UTC): 2026-07-20T15:51:00Z
Base: origin/main @ ad20a27bc32ba40c364fbe39d969285d4d17171b
Convergence branch: codex/final-verdict-convergence

All four closure branches share merge-base ad20a27bc32ba40c364fbe39d969285d4d17171b (current origin/main). None are merged into main. File-level conflicts across the four branches are NOT expected because each writes to a distinct directory, except the interactive E2E branch which modifies src/*.

| Branch | Head | Ahead | Files | Nature | Conflicts | Merge order |
|---|---|---|---|---|---|---|
| codex/final-secret-rotation-closure | d8f8ce5 | 2 | 12 (+1043) | DOCUMENTATION-ONLY (secret_rotation_audit/, AUDIT_REPORTS/FINAL_07) | none | 1 — pure audit artifacts |
| codex/rag-citation-retrieval-closure | a4bfe4d | 2 | 13 (+1217) | DOCUMENTATION-ONLY (final_search_audit/) | none | 2 — pure audit artifacts |
| codex/final-closure-master-loop | 921ed3d | 2 | 12 (+550) | DOCUMENTATION-ONLY (FINAL_AUDIT/) | none | 3 — pure audit artifacts |
| codex/interactive-e2e-closure | 2f46e5a | 3 | 65 (+4254) | CODE-BEARING (src/components/cases/*, src/pages/Dashboard.tsx, tests) | touches files with pre-existing typecheck errors on main; verify after merge | 4 — last, after functional re-validation |

## Merge plan

1. Documentation branches (secret-rotation, rag-closure, final-closure-master-loop): normal merge is safe; they add only audit artifacts in separate directories. Cherry-pick is unnecessary.
2. Interactive E2E branch: normal merge preserves branch integrity and the verified E2E commit ancestry. After merge, re-run the full gate suite (build, typecheck, vitest, deno edge tests, secret scan) because this branch modifies src/* including files with pre-existing typecheck errors (CaseDetail.tsx, Dashboard.tsx, MyDocuments.tsx).
3. Do NOT merge the code-bearing branch until the gate suite is re-validated on the integrated tree. The current final-verdict branch deliberately does NOT merge any branch yet because mandatory gates (provider rotation, RAG live chain, legal review, JWT decision, history rewrite decision) are still BLOCKED.

## Obsolete / superseded artifacts

- FINAL_AUDIT/ (codex/final-closure-master-loop) and final_search_audit/ (rag-closure) are prior closure-documentation iterations. The final_verdict/ set produced by this orchestrator is the authoritative convergence output; the prior sets remain as historical evidence and are not deleted.
- secret_rotation_audit/10_DATABASE_PASSWORD_ROTATION_EVIDENCE.json is the authoritative DB-password evidence; FINAL_AUDIT/04_SECRET_ROTATION_STATUS.md is superseded for the P0-001 active-credential question only.

## Required commit order if/when gates clear

1. Merge documentation branches (no functional risk).
2. Merge interactive E2E branch.
3. Re-run full gate suite on integrated tree.
4. Open exactly one PR codex/final-verdict-convergence -> default branch with the required PR description contents.
5. Do not auto-merge unless the operator explicitly requests merge.
