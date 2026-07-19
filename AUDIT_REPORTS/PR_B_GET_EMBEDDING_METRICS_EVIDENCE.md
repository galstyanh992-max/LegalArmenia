# SECURITY AUDIT EVIDENCE: get_embedding_metrics HOTFIX

## A. THREAT MODEL
- SECURITY DEFINER;
- prior search_path: public, app, pg_temp;
- prior broad EXECUTE grants;
- fail-open NULL behavior of: app.get_my_role() <> 'admin';
- operational information exposed.

## B. PRODUCTION SAFE OUT-OF-BAND STATE
- production project ref: avmgtsonawtzebvazgcr;
- production ledger = 49;
- target migration not yet in production ledger;
- safe function already live;
- production md5(prosrc): de1ec5a3983b9e6dc5efebeaaa865ec0;
- production md5(functiondef): b47444a0382f21eb6035b64141646902;
- service_role-only ACL;
- no production mutation during PR preparation.

## C. CALL-SITE AUDIT
- no legitimate anon caller;
- no legitimate authenticated caller;
- no direct authenticated-admin caller;
- generated types are not runtime callers.

## D. FORWARD MIGRATION
- version: 20260718230128;
- exact signature/default/result contract;
- empty search_path;
- fail-closed service_role JWT guard;
- SQLSTATE 42501;
- schema-qualified application objects;
- no writes;
- exact ACL.

## E. CONTAINMENT ROLLBACK
- safe body retained;
- safe guard retained;
- service_role EXECUTE also revoked;
- vulnerable state never restored.

## F. STAGING PRE-STATE
- project ref: vavjajwiqsdhlweggalw;
- ledger = 13;
- target migration absent;
- original hashes;
  - staging baseline md5(prosrc): 6d727abfb16f53563d1ffb06d1aebc10
  - staging baseline md5(pg_get_functiondef): e3c83767a6ab01bd85e5c03097789e7a
- original ACL/proconfig/comment/owner.

## G. EXACT HTTP MATRIX
- anon: HTTP 401, permission denied / 42501;
- authenticated: HTTP 403, permission denied / 42501;
- authenticated admin: HTTP 403, permission denied / 42501;
- service_role default: HTTP 200; exactly one row; exactly eight columns; model = armenian-text-embeddings-2-large;
- service_role explicit: HTTP 200; exactly one row; returned model = explicit-model-test-123.

## H. READ-ONLY PROOF
Before:
- search_chunks = 0;
- embeddings = 0;
- internal.ai_metrics = 0.

After:
- search_chunks = 0;
- embeddings = 0;
- internal.ai_metrics = 0.

No helper, trigger, table or metric row was created.

## I. CLEANUP
- ephemeral Auth user deleted;
- associated app.user_profiles row deleted;
- credential file deleted;
- HTTP runners deleted;
- temporary SQL deleted;
- no credential printed or committed.

## J. EXACT STAGING RESTORATION
- restored prosrc hash: 6d727abfb16f53563d1ffb06d1aebc10;
- restored functiondef hash: e3c83767a6ab01bd85e5c03097789e7a;
- original ACL restored;
- original proconfig restored;
- comment restored;
- owner restored;
- ledger remains 13;
- migration 20260718230128 absent.

## K. TEST RESULTS
Local:
- focused PR-B test: PASS, 13 steps;
- full Windows suite: 100 passed, 1 pre-existing CRLF-sensitive PR-A failure;
- the same failure reproduced on clean main.

Remote:
- Deno CI: PASS;
- Vitest CI: PASS;
- Vercel: PASS.

## L. HOLD
DO NOT MERGE UNTIL SECURITY REVIEW APPROVAL.

PRODUCTION_CHANGE_STATUS = NO_CHANGES

EXPECTED_POST_MERGE_PRODUCTION_LEDGER = 50
