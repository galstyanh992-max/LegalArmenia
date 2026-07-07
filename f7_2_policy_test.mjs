#!/usr/bin/env node
/**
 * F7.2 — Live case-file DELETE policy test (staging only) — LIVE MODEL.
 *
 * Matches the real schema of project avmgtsonawtzebvazgcr:
 *   - public.case_files is a compat VIEW over app.client_documents
 *     (INSTEAD OF INSERT/DELETE triggers). DB-delete authorization = RLS
 *     app.client_documents.cd_delete.
 *   - Storage deletes -> storage.objects.case_files_delete (checks object owner
 *     + app.can_manage_case(case_id-from-name)).
 *   - Roles live in app.user_profiles; case membership in app.case_members;
 *     case lawyer in app.cases.lawyer_id.
 *
 * Aligned DELETE predicate (both DB row and storage object):
 *     uploaded_by/owner = auth.uid()  OR  app.can_manage_case(case_id)
 *   => uploader, case lawyer, admin. Members/clients (non-uploader) & outsiders: DENY.
 *
 * The object is seeded THROUGH THE UPLOADER'S session so storage.objects.owner =
 * uploader (matches production upload path). The case is provisioned via the
 * service_role-only RPC public.f7_test_provision (see migration
 * 20260707130000_f7_2_test_support.sql), because app.cases is not writable
 * through the public views.
 *
 * SECURITY: reads all secrets from env. Never hardcode keys. Do NOT run vs prod.
 *
 * Required env:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY            provisioning/cleanup + admin checks
 *   SUPABASE_ANON_KEY (or SUPABASE_PUBLISHABLE_KEY)   user logins
 *   TEST_BUCKET                          default 'case-files'
 *   TEST_PASSWORD
 *   TEST_ADMIN_EMAIL, TEST_LAWYER_EMAIL, TEST_UPLOADER_EMAIL,
 *   TEST_MEMBER_EMAIL, TEST_OUTSIDER_EMAIL
 *
 * Run:  node f7_2_policy_test.mjs
 */
import { createClient } from '@supabase/supabase-js';

const {
  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TEST_BUCKET = 'case-files', TEST_PASSWORD,
  TEST_ADMIN_EMAIL, TEST_LAWYER_EMAIL, TEST_UPLOADER_EMAIL, TEST_MEMBER_EMAIL, TEST_OUTSIDER_EMAIL,
} = process.env;
const ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

function need(v, n) { if (!v) { console.error(`Missing env: ${n}`); process.exit(2); } }
need(SUPABASE_URL, 'SUPABASE_URL');
need(SUPABASE_SERVICE_ROLE_KEY, 'SUPABASE_SERVICE_ROLE_KEY');
need(ANON_KEY, 'SUPABASE_ANON_KEY / SUPABASE_PUBLISHABLE_KEY');
need(TEST_PASSWORD, 'TEST_PASSWORD');
for (const [v, n] of [
  [TEST_ADMIN_EMAIL,'TEST_ADMIN_EMAIL'], [TEST_LAWYER_EMAIL,'TEST_LAWYER_EMAIL'],
  [TEST_UPLOADER_EMAIL,'TEST_UPLOADER_EMAIL'], [TEST_MEMBER_EMAIL,'TEST_MEMBER_EMAIL'],
  [TEST_OUTSIDER_EMAIL,'TEST_OUTSIDER_EMAIL'],
]) need(v, n);

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function ensureUser(email) {
  const { data } = await admin.auth.admin.createUser({ email, password: TEST_PASSWORD, email_confirm: true });
  if (data?.user) return data.user.id;
  let page = 1;
  for (;;) {
    const { data: list } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    const u = list?.users?.find(x => x.email?.toLowerCase() === email.toLowerCase());
    if (u) return u.id;
    if (!list?.users?.length || list.users.length < 200) break;
    page++;
  }
  throw new Error(`cannot ensure user ${email}`);
}

async function userClient(email) {
  const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
  const { data, error } = await anon.auth.signInWithPassword({ email, password: TEST_PASSWORD });
  if (error) throw new Error(`login ${email} failed: ${error.message}`);
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
  });
}

async function objectExists(path) {
  const dir = path.split('/').slice(0, -1).join('/') || undefined;
  const { data, error } = await admin.storage.from(TEST_BUCKET).list(dir, { search: path.split('/').pop() });
  if (error) return false;
  return !!data?.find(o => o.name === path.split('/').pop());
}
async function rowExists(id) {
  const { data } = await admin.from('case_files').select('id').eq('id', id).maybeSingle();
  return !!data;
}

// Seed the file AS THE UPLOADER: object owner = uploader, row uploaded_by = uploader.
async function seedFile(uploaderClient, caseId, tag) {
  const path = `${caseId}/f7test_${tag}_${Date.now()}.txt`;
  const body = new Blob([`disposable f7.2 ${tag}`], { type: 'text/plain' });
  const up = await uploaderClient.storage.from(TEST_BUCKET).upload(path, body, { upsert: true });
  if (up.error) throw new Error(`seed upload failed: ${up.error.message}`);
  const fname = `f7_${tag}.txt`;
  const ins = await uploaderClient.from('case_files').insert({
    case_id: caseId, filename: fname, original_filename: fname,
    storage_path: path, file_size: 20,
  }).select('id').single();
  if (ins.error) throw new Error(`seed row failed: ${ins.error.message}`);
  return { id: ins.data.id, path };
}

async function tryDelete(client, fileId, path) {
  const dbDel = await client.from('case_files').delete().eq('id', fileId).select('id');
  const stDel = await client.storage.from(TEST_BUCKET).remove([path]);
  return { dbErr: dbDel.error, dbDeleted: (dbDel.data?.length || 0) > 0, stErr: stDel.error };
}

const results = [];
async function scenario(name, expectAllow, actorClient, uploaderClient, caseId) {
  const tag = name.replace(/\W+/g, '').slice(0, 12);
  const { id, path } = await seedFile(uploaderClient, caseId, tag);
  const { dbErr, dbDeleted, stErr } = await tryDelete(actorClient, id, path);
  const objGone = !(await objectExists(path));
  const rowGone = !(await rowExists(id));
  const allowed = dbDeleted && rowGone && objGone;
  const denied = !rowGone && !objGone;
  const pass = expectAllow ? allowed : denied;
  results.push({ name, expect: expectAllow ? 'ALLOW' : 'DENY',
    actual: allowed ? 'ALLOW' : (denied ? 'DENY' : 'PARTIAL/LEAK'),
    status: pass ? 'PASS' : 'FAIL',
    evidence: `dbDeleted=${dbDeleted} rowGone=${rowGone} objGone=${objGone} dbErr=${dbErr?.code||'-'} stErr=${stErr?.message?'y':'-'}` });
  // cleanup residue with service role
  await admin.from('case_files').delete().eq('id', id);
  await admin.storage.from(TEST_BUCKET).remove([path]);
}

async function main() {
  const adminU   = await ensureUser(TEST_ADMIN_EMAIL);
  const lawyer   = await ensureUser(TEST_LAWYER_EMAIL);
  const uploader = await ensureUser(TEST_UPLOADER_EMAIL);
  const member   = await ensureUser(TEST_MEMBER_EMAIL);
  await ensureUser(TEST_OUTSIDER_EMAIL);

  const prov = await admin.rpc('f7_test_provision', {
    p_admin: adminU, p_lawyer: lawyer, p_uploader: uploader, p_member: member,
  });
  if (prov.error) { console.error('provision failed:', prov.error.message); process.exit(2); }
  const caseId = prov.data;

  const uploaderClient = await userClient(TEST_UPLOADER_EMAIL);
  const lawyerClient   = await userClient(TEST_LAWYER_EMAIL);
  const adminClient    = await userClient(TEST_ADMIN_EMAIL);
  const memberClient   = await userClient(TEST_MEMBER_EMAIL);
  const outsiderClient = await userClient(TEST_OUTSIDER_EMAIL);

  try {
    await scenario('uploader-own',  true,  uploaderClient, uploaderClient, caseId);
    await scenario('lawyer-manage', true,  lawyerClient,   uploaderClient, caseId);
    await scenario('admin',         true,  adminClient,    uploaderClient, caseId);
    await scenario('member-nonup',  false, memberClient,   uploaderClient, caseId);
    await scenario('outsider',      false, outsiderClient, uploaderClient, caseId);
  } finally {
    await admin.rpc('f7_test_teardown', { p_case: caseId });
  }

  console.log('\n# F7.2 Live Policy Test Results\n');
  console.log('| Scenario | Expected | Actual | Status | Evidence |');
  console.log('|---|---|---|---|---|');
  for (const r of results) console.log(`| ${r.name} | ${r.expect} | ${r.actual} | ${r.status} | ${r.evidence} |`);
  const allPass = results.every(r => r.status === 'PASS');
  const leak = results.some(r => r.actual === 'PARTIAL/LEAK');
  console.log(`\nDECISION: ${leak ? 'STOP_UNSAFE' : allPass ? 'ERROR_CLOSED' : 'FAIL_NEEDS_FIX'}`);
  process.exit(allPass ? 0 : 1);
}
main().catch(e => { console.error('harness error:', e.message); process.exit(2); });
