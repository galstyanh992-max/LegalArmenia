# Post-Rewrite Validation

Generated (UTC): 2026-07-20T15:54:00Z

After the rewrite and force-push, verify ALL of the following before declaring the scrub complete:

1. Secret absence: git log --all --source -p -- db_passwords.cjs is empty; a full-history secret scan over all rewritten refs returns 0 matches for the credential pattern.
2. Ref integrity: every affected ref now points at rewritten history; no ref still resolves to an old object containing db_passwords.cjs.
3. Build and tests: clean install, vitest, deno edge tests, and production build pass on the rewritten default branch.
4. Working-tree secret scan: 0 real credential matches.
5. Production deployments: still function from the rewritten default branch (Vercel redeploy + health check; Supabase unaffected by history change; VPS unaffected).
6. Clone holders: all known clone holders have re-synced; forks/mirrors enumerated and notified.
7. CI caches: purged and re-run from rewritten history.
8. Backup: retained and verified until all the above pass.

Record the old/new object mapping (no secret contents) and the validation evidence in final_verdict/02_SECURITY_VERDICT.md and final_verdict/08_RESIDUAL_RISKS.md.
