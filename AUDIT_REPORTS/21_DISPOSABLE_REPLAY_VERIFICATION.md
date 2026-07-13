# 21 — Disposable Replay Verification

## 1. Metadata

- Date: 2026-07-14
- Phase: `P7 — Clean Replay Verification`
- Prompt 16 verdict: `MIGRATION_IMPLEMENTATION_READY_FOR_REPLAY`
- Replay cycles: 18
- Active migrations: 8
- Decision: `BLOCKED_DISPOSABLE_ENVIRONMENT`

## 2. Environment Safety Evidence

- Target: local Supabase CLI Docker stack on loopback ports only for test clients.
- Production project was not used as a replay or behavioral-test target.
- All destructive resets used `supabase db reset --local --no-seed`; `--linked` was never used.
- No paid branch/project was created; billing impact is none.
- Browser frontend override uses local URL through ignored `.env.local`; no service/secret key is exposed to the frontend.
- Production remained unchanged.

## 3. Empty-State Evidence

Each repository repair was followed by a full local database recreation and replay from migration zero. The final cycle recreated the database, applied all eight active versions in order, and began with no Auth identities, application rows, Storage objects, or customer data.

## 4. Replay Cycles

| Cycle | First Failure | Owning File | Minimal Fix | New Environment? | Result |
| ----- | ------------- | ----------- | ----------- | ---------------: | ------ |
| 1–10 | SQLSTATE `42601`: `DEFAULT` appeared in function ACL identities | `20260712120002_versioned_baseline_20260712.sql` | Removed only the failing default expression(s) from each `GRANT/REVOKE` identity | Yes | PASS after cycle 10 repairs |
| 11–13 | SQLSTATE `42710`: duplicate case-files Storage policies | `20260712120008_enforce_case_files_bucket_constraints.sql` | Added one ordered `DROP POLICY IF EXISTS` per first conflicting policy | Yes | PASS after cycle 13 repairs |
| 14 | No SQL replay failure; behavioral INSERT on `public.cases` hit RLS because the compatibility INSERT trigger was absent | `20260713221836_restore_cases_insert_trigger.sql` | Added only `cases_insert_tg` for `public.cases` | Yes | Replay PASS; authorization matrix advanced |
| 15 | Cross-user read of legacy `media-uploads` succeeded | `20260713222445_isolate_legacy_media_reads.sql` | Replaced only the legacy SELECT policy with owner-folder isolation | Yes | Replay PASS; legacy media isolation PASS |
| 16 | Explicit case member could not read a transcription belonging to a readable case | `20260713222818_align_audio_transcription_read_access.sql` | Aligned only the transcription SELECT policy with `app.can_read_case()` | Yes | Replay PASS; transcription isolation PASS |
| 17 | Synthetic role-change audit rows remained after otherwise successful tests | local test cleanup | Deleted fixture audit rows before profile/Auth cleanup | Yes | Cleanup verification advanced |
| 18 | None | Full eight-migration active path | No database correction | Yes | Full replay, matrices, and fixture cleanup PASS |

No replay continued after a manual database correction. Every schema/security change was made in the repository and verified by a new replay from zero.

## 5. Final Replay Result

PASS. The final clean replay applied these versions in order:

1. `20260712120002`
2. `20260712120004`
3. `20260712120006`
4. `20260712120008`
5. `20260712120010`
6. `20260713221836`
7. `20260713222445`
8. `20260713222818`

Static verification: `PASS active_migrations=8 legacy_sql=237 duplicate_versions=0 secret_indicators=0`.

## 6. Structural Assertions

- Application tables: 64 (`public` + `app`)
- Compatibility views: 7
- Application functions observed through catalog: 193
- Application tables with RLS enabled: 64/64
- Application policies after final repairs: catalog verified
- Migration ledger: all 8 active versions present
- Required private buckets: `case-files`, `media-uploads`
- Baseline ordering, duplicate versions, manifest completeness, legacy archive exclusion, and secret-indicator scan: PASS

## 7. Production Baseline Comparison

The versioned baseline remains the catalog-derived production structural snapshot documented by Prompt 16. Final replay matched the manifest object groups. The three additional forward migrations are deliberate `FORWARD_FEATURE_DIFFERENCE` repairs: cases compatibility INSERT, legacy media read isolation, and transcription member-read alignment. Production was not queried or changed during behavioral execution.

## 8. Auth Bootstrap

PASS on synthetic local identities:

- Auth identity creation created exactly one profile.
- Missing `full_name` metadata produced the safe `User` default.
- Default role was `client`; `is_active=true`.
- Direct profile role elevation did not change the persisted role.
- Forged `user_roles` insertion was denied.
- Test identity and profile cleanup completed.

## 9. Authorization Matrix

PASS:

| Actor | Operation | Result |
| ----- | --------- | ------ |
| anon | read protected case | DENY |
| client A | read member case | ALLOW |
| client A | read foreign case | DENY |
| lawyer A | read assigned case | ALLOW |
| lawyer B | read unrelated case | DENY |
| client | persist privileged profile role | DENY |
| client | insert forged role | DENY |
| user A | read/write user B profile | DENY |
| admin | read both synthetic cases | ALLOW |
| service | scoped audit/error-log verification path | ALLOW |

The local matrix never used a service key to impersonate an authenticated user.

## 10. Storage Matrix

PASS:

- anonymous private-object download: DENY
- own-case member upload/read: ALLOW
- foreign-case download and signed URL: DENY
- arbitrary non-case path upload: DENY
- own-case signed URL: ALLOW
- legacy `media-uploads` cross-user read: DENY after forward repair
- cross-user transcription read: DENY
- explicit case-member transcription read: ALLOW after forward repair

## 11. Backfill Tests

No backfill is part of the active migration path. The guarded synthetic-only audio deduplication script remains separate and was not required because the final empty replay contained no backfill fixtures.

## 12. Generated Contract Readiness

`src/integrations/supabase/types.ts` was regenerated strictly from the final local replay with:

```text
supabase gen types typescript --local --schema public
```

No linked project or production project ID was used. Post-generation verification passed:

- `npx tsc --noEmit`: PASS
- unit tests: 89/89 PASS
- Edge tests: 34/34 PASS
- production build: PASS
- static migration verifier: PASS

## 13. Cleanup Evidence

Fixture cleanup PASS after the final matrices:

- synthetic Auth users: 0
- synthetic profiles: 0
- cases and memberships: 0
- client documents and transcriptions: 0
- Storage objects: 0
- synthetic audit rows: 0

No paid resource or temporary external credential was created. The local Docker stack remains running only until scoped commit evidence is captured, then will be stopped without production interaction.

## 14. Remaining Blockers

1. Local Docker shutdown is scheduled after scoped commit evidence is captured.
2. `DEEP-001` credential rotation/revocation remains a manual production blocker.
3. Production release remains prohibited.

## 15. Decision

`LOCAL_DISPOSABLE_REPLAY_VERIFIED — PRODUCTION_RELEASE_BLOCKED_BY_DEEP-001`

Clean replay, structural gates, Auth bootstrap, authorization matrix, Storage matrix, generated types, typecheck, tests, build, and synthetic fixture cleanup all pass. This is local disposable evidence only and does not authorize any production operation.

## 16. Prompt 18 Handoff

```text
VERIFIED_BASELINE_VERSION = 20260712120002 + 7 FORWARD MIGRATIONS
REPLAY_CYCLES = 18
SCHEMA_ASSERTIONS = PASS
AUTH_MATRIX = PASS
STORAGE_MATRIX = PASS
BACKFILL_STATUS = NOT_REQUIRED_EMPTY_REPLAY; GUARDED_SCRIPT_SEPARATE
DISPOSABLE_ENVIRONMENT_DELETED = PENDING_POST_COMMIT_LOCAL_SHUTDOWN
GENERATED_TYPE_SOURCE = FINAL_LOCAL_EIGHT_MIGRATION_REPLAY_PUBLIC_SCHEMA
NEXT_PROMPT = 18_AFTER_LOCAL_SHUTDOWN_EVIDENCE
```
