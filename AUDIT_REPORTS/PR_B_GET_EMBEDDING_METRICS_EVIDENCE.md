# PR-B EVIDENCE: get_embedding_metrics service-role-only hotfix

## 1. Threat Model
- Function: public.get_embedding_metrics(text)
- Vulnerability: SECURITY DEFINER with search_path set to 'public', 'app', 'pg_temp'. This allows search path hijacking, enabling attackers to execute arbitrary code under the function owner's privileges by creating malicious objects in public or pg_temp.
- Original ACL: PUBLIC, non, uthenticated, service_role had EXECUTE.

## 2. Live Safe Out-of-band Production State
- The function was previously patched out-of-band in production.
- Current md5(prosrc): de1ec5a3983b9e6dc5efebeaaa865ec0
- Current md5(pg_get_functiondef): 47444a0382f21eb6035b64141646902
- Security Definer: true, Search Path: ''
- PUBLIC/anon/authenticated EXECUTE: false.
- Production ledger count remains: 49.
- No production database mutation occurred during PR preparation.

## 3. Caller Audit
- Result: No legitimate runtime callers requiring anon, authenticated, or authenticated-admin access exist.
- Search confirmed get_embedding_metrics only appears in Types/Migrations/Tests. All targets cleared.

## 4. Exact Forward Migration
- Timestamp: 20260718230128
- Reproduces the safe live production function exactly in behavior and authorization.
- Enforces service-role-only execution.
- Includes strict schema-qualification.

## 5. Rollback Semantics
- Retains the safe fail-closed guard.
- Revokes EXECUTE from ALL roles (including service_role) to safely disable the RPC pending review.

## 6. Local Test Results
- Deno suite hotfix-get-embedding-metrics.contract.test.ts passed (1 test, 13 assertions).
- Verified: signature, returns table, search_path empty, JWT guard 42501, no pp.get_my_role, strict ACL grants/revokes, transaction wrapping, exact rollback semantics.
- Full Deno suite result: 100 passed (75 steps), 1 unrelated legacy PR-A failure.

## 7. Staging Baseline
- Staging Project: vavjajwiqsdhlweggalw
- Ledger count: 13.
- Pre-state md5(prosrc): 6d727abfb16f53563d1ffb06d1aebc10.
- Target migration was absent.

## 8. Staging HTTP Matrix & Data Proof
- Execution of anon, authenticated, and authenticated-admin roles denied correctly by JWT guard and ACL (`42501` or permission denied).
- `service_role` default model request succeeded (returning `armenian-text-embeddings-2-large` metrics).
- Data read-only proof: No records in `search_chunks` or `embeddings` modified. `internal.ai_metrics` unmodified (not queried by this RPC).

## 9. Exact Staging Restoration & Cleanup
- Staging restored exactly to its pre-state function definition (`e3c83767a6ab01bd85e5c03097789e7a`).
- Ephemeral objects and temporary SQL scripts cleaned up.
- Staging ledger unaltered (remains 13).

## 10. DO NOT MERGE
- This PR codifies the already-live safe state.
- Expected later production ledger: 50.


