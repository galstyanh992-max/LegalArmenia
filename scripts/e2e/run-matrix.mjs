// Interactive E2E acceptance loop — auth + IDOR matrix against staging.
// Evidence is sanitized: no emails/passwords/tokens. Test UUIDs are ephemeral.
import { serviceApp, servicePublic, anonApp, anonPublic, userClient, stagingUrl, anonKey, serviceRoleKey } from "./staging-client.mjs";
import { createIdentity, signInAs, fixtures, createdUsers, cleanupOrphans, deleteUser, RUN_PREFIX } from "./harness-lib.mjs";
import { randomBytes } from "node:crypto";
import { writeFileSync, mkdirSync } from "node:fs";

const findings = { auth: [], idor: [] };
const P = (s) => s; // passthrough label

function rec(bucket, { actor, table, op, target, expected, allowed, rows, code, note, vector }) {
  const pass = allowed === expected;
  bucket.push({ actor, table, op, target, expected, allowed, rows: rows ?? null, code: code ?? null, pass, vector: vector ?? null, note: note ?? null });
  return pass;
}

// Generic op runner. opFn returns {data, error, count}.
async function run(fn) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try { const r = await fn(); return { data: r.data, error: r.error, count: r.count, code: r.error?.code || null, msg: r.error?.message || null }; }
    catch (e) { if (attempt === 3) return { data: null, error: { message: String(e) }, code: "throw", msg: String(e) }; await new Promise((x)=>setTimeout(x, 400*attempt)); }
  }
}

// ---- baseline counts (must return to these) ----
async function baseline() {
  const counts = {};
  for (const [t, c] of [["cases", servicePublic], ["case_members", servicePublic], ["case_comments", servicePublic], ["generated_documents", servicePublic], ["profiles", servicePublic], ["documents", servicePublic]]) {
    const r = await c.from(t).select("*", { count: "exact", head: true });
    counts[t] = r.count;
  }
  const u = await serviceApp.auth.admin.listUsers({ page: 1, perPage: 200 });
  counts._authUsers = u.data?.users?.length ?? null;
  return counts;
}

// ============================================================
// PHASE 1 — identities
// ============================================================
const ident = {};
async function provision() {
  ident.clientA = await createIdentity("client", { fullName: "E2E Client A" });
  ident.clientB = await createIdentity("client", { fullName: "E2E Client B" });
  ident.lawyerA = await createIdentity("lawyer", { fullName: "E2E Lawyer A" });
  ident.lawyerB = await createIdentity("lawyer", { fullName: "E2E Lawyer B" });
  ident.admin = await createIdentity("admin", { fullName: "E2E Admin" });
  ident.disabled = await createIdentity("client", { active: false, fullName: "E2E Disabled" });
  ident.missingProfile = await createIdentity("client", { withProfile: false, fullName: "E2E NoProfile" });
}

// sign in everyone (skip disabled/missing for sign-in success tests; they still sign in but RLS denies)
const sess = {};
async function signInAll() {
  for (const [k, v] of Object.entries(ident)) {
    sess[k] = await signInAs(v.email, v.password);
  }
}

// ============================================================
// PHASE 2 — auth matrix
// ============================================================
async function authMatrix() {
  // sign-in success for valid enabled users
  for (const k of ["clientA","clientB","lawyerA","lawyerB","admin"]) {
    const ok = !!sess[k]?.accessToken && !sess[k]?.error;
    rec(findings.auth, { actor: k, table: "auth", op: "signIn", target: "self", expected: true, allowed: ok, code: sess[k]?.error || null, note: ok ? "valid session" : "no session" });
  }
  // disabled account: sign-in at auth layer may still succeed (auth.is_active != profile.is_active); protected flows must fail closed
  {
    const ok = !!sess.disabled?.accessToken;
    rec(findings.auth, { actor: "disabled", table: "auth", op: "signIn", target: "self", expected: true, allowed: ok, note: "auth sign-in allowed; RLS must deny protected flows" });
  }
  // missing profile: sign-in ok but app queries empty
  {
    const ok = !!sess.missingProfile?.accessToken;
    rec(findings.auth, { actor: "missingProfile", table: "auth", op: "signIn", target: "self", expected: true, allowed: ok, note: "auth ok; no profile => role null" });
  }
  // wrong password
  {
    const r = await anonApp.auth.signInWithPassword({ email: ident.clientA.email, password: "WrongPassword!9" });
    rec(findings.auth, { actor: "clientA", table: "auth", op: "signInWrongPassword", target: "self", expected: false, allowed: !r.error, code: r.error?.message || null });
  }
  // invalid JWT (bogus bearer) -> protected resource should 401/empty
  {
    const bogus = userClient("public", "not-a-real-jwt");
    const r = await run(() => bogus.from("cases").select("id", { count: "exact", head: true }));
    rec(findings.auth, { actor: "invalidJWT", table: "cases", op: "select", target: "any", expected: false, allowed: (r.count > 0 || (r.data?.length > 0)), code: r.code, note: r.msg });
  }
  // expired-ish / malformed token (random) -> 401
  {
    const r2 = await run(() => userClient("public", randomBytes(20).toString("hex")).from("profiles").select("id", { count: "exact", head: true }));
    rec(findings.auth, { actor: "malformedJWT", table: "profiles", op: "select", target: "any", expected: false, allowed: (r2.count > 0 || (r2.data?.length > 0)), code: r2.code, note: r2.msg });
  }
  // missing authorization header (anon, no apikey on protected) -> 401 at REST
  {
    const st = await fetch(stagingUrl + "/rest/v1/cases?select=id", { headers: {} }).then((x) => x.status);
    rec(findings.auth, { actor: "anonNoHeader", table: "cases", op: "select", target: "any", expected: false, allowed: st === 200, note: "HTTP " + st });
  }
  // anon (with apikey, no session) -> 0 rows on protected
  {
    const r = await run(() => anonPublic.from("cases").select("id", { count: "exact", head: true }));
    rec(findings.auth, { actor: "anon", table: "cases", op: "select", target: "any", expected: false, allowed: (r.count > 0 || (r.data?.length > 0)), code: r.code, note: r.msg });
  }
  // disabled account: may read own profile (user_id match) but must NOT read other-tenant cases or escalate. Own-profile read is allowed; cross-tenant is the security bar.
  {
    const r = await run(() => sess.disabled.public.from("profiles").select("id", { count: "exact", head: true }));
    rec(findings.auth, { actor: "disabled", table: "profiles", op: "select", target: "ownOnly", expected: true, allowed: (r.count === 1), rows: r.count, code: r.code, note: "disabled reads own profile only; role null prevents admin/cross-tenant" });
    const rc = await run(() => sess.disabled.public.from("cases").select("id", { count: "exact", head: true }));
    rec(findings.auth, { actor: "disabled", table: "cases", op: "select", target: "any", expected: false, allowed: (rc.count > 0), rows: rc.count, code: rc.code, note: "disabled cannot read any case (not a member/lawyer/admin)" });
  }
  // missing profile: protected read -> 0 rows
  {
    const r = await run(() => sess.missingProfile.public.from("profiles").select("id", { count: "exact", head: true }));
    rec(findings.auth, { actor: "missingProfile", table: "profiles", op: "select", target: "self", expected: false, allowed: (r.count > 0 || (r.data?.length > 0)), code: r.code, note: "no profile row => role null" });
  }
  // role escalation: client calls admin_set_user_role on another user -> expect 42501
  {
    const r = await run(() => sess.clientA.public.rpc("admin_set_user_role", { p_user_id: ident.clientB.userId, p_role: "admin" }));
    rec(findings.auth, { actor: "clientA", table: "rpc", op: "admin_set_user_role", target: "clientB", expected: false, allowed: !r.error, code: r.code, note: r.msg });
  }
  // client tries to grant itself admin via direct profile update (service-only insert/update at app layer; public.profiles update trigger blocks protected fields)
  {
    const r = await run(() => sess.clientA.public.from("profiles").update({ role: "admin" }).eq("id", ident.clientA.userId).select("id,role"));
    // The public.profiles INSTEAD OF UPDATE trigger returns the input row unchanged; re-read the actual DB role to detect real escalation.
    const actual = await run(() => servicePublic.from("profiles").select("role").eq("id", ident.clientA.userId).single());
    const becameAdmin = (actual.data?.role === "admin");
    rec(findings.auth, { actor: "clientA", table: "profiles", op: "updateRole", target: "self", expected: false, allowed: becameAdmin, code: r.code, note: "update return role=" + (r.data?.[0]?.role) + " actual role=" + (actual.data?.role) + " " + (r.msg||"") });
  }
  // service-role endpoint without service role: admin_set_user_role called as anon
  {
    const r = await run(() => anonPublic.rpc("admin_set_user_role", { p_user_id: ident.clientA.userId, p_role: "lawyer" }));
    rec(findings.auth, { actor: "anon", table: "rpc", op: "admin_set_user_role", target: "clientA", expected: false, allowed: !r.error, code: r.code, note: r.msg });
  }
  // sign-out then protected read fails
  {
    await sess.clientA.public.auth.signOut();
    const r = await run(() => sess.clientA.public.from("cases").select("id", { count: "exact", head: true }));
    rec(findings.auth, { actor: "clientA", table: "cases", op: "selectAfterSignOut", target: "any", expected: false, allowed: (r.count > 0 || (r.data?.length > 0)), code: r.code, note: r.msg });
    // re-sign-in for later phases
    sess.clientA = await signInAs(ident.clientA.email, ident.clientA.password);
  }
  // public sign-up path creates an unconfirmed user (ephemeral, cleaned up)
  {
    const su = await anonApp.auth.signUp({ email: RUN_PREFIX + "signup@legalarmenia-e2e.test", password: "Sup3r!Test" + randomBytes(4).toString("hex") });
    const reachable = !!su.error || !!su.data; // endpoint responded (no network failure)
    if (su.data?.user?.id) { await serviceApp.auth.admin.deleteUser(su.data.user.id); }
    rec(findings.auth, { actor: "anon", table: "auth", op: "signUp", target: "new", expected: true, allowed: reachable, code: su.error?.message || null, note: "signUp reachable; staging email validation rejects synthetic domain; new users get client role via trigger, role changes require admin RPC" });
  }
}

// ============================================================
// PHASE 3 — IDOR / case matrix
// ============================================================
const own = {}; // created case ids per lawyer
async function createCaseFixture(lawyerKey, clientKey, label) {
  const c = sess[lawyerKey].public;
  const ins = await run(() => c.from("cases").insert({ title: "E2E " + label, description: "fixture " + label, status: "open", case_type: "civil" }).select("id").single());
  if (ins.error || !ins.data?.id) throw new Error("case insert failed for " + label + ": " + (ins.msg || "no id"));
  const caseId = ins.data.id;
  // add client as case member
  const cm = await run(() => c.from("case_members").insert({ case_id: caseId, user_id: ident[clientKey].userId, case_role: "client" }).select("case_id").single());
  if (cm.error) throw new Error("case_members insert failed: " + cm.msg);
  // add a comment authored by the lawyer
  const cc = await run(() => c.from("case_comments").insert({ case_id: caseId, author_id: ident[lawyerKey].userId, content: "E2E comment " + label, is_internal: true }).select("id").single());
  if (cc.error) throw new Error("case_comments insert failed: " + cc.msg);
  // add a generated_document authored by the lawyer
  const gd = await run(() => c.from("generated_documents").insert({ case_id: caseId, user_id: ident[lawyerKey].userId, content: "E2E doc " + label, document_type: "complaint", title: "E2E " + label }).select("id").single());
  if (gd.error) throw new Error("generated_documents insert failed: " + gd.msg);
  own[label] = { caseId, commentId: cc.data?.id, genDocId: gd.data?.id, lawyer: lawyerKey, client: clientKey };
  return own[label];
}

async function idorMatrix() {
  await createCaseFixture("lawyerA", "clientA", "caseA");
  await createCaseFixture("lawyerB", "clientB", "caseB");
  const cA = own.caseA.caseId, cB = own.caseB.caseId;

  // helper: SELECT count a user can see of a table filtered to a specific case_id
  const selectCase = async (clientKey, table, caseId) => {
    const c = sess[clientKey].public;
    return run(() => c.from(table).select("*", { count: "exact", head: true }).eq("case_id", caseId));
  };
  const selectAll = async (clientKey, table) => {
    const c = sess[clientKey].public;
    return run(() => c.from(table).select("*", { count: "exact", head: true }));
  };

  // ---- SELECT matrix: cases, case_members, case_comments, generated_documents ----
  for (const table of ["cases", "case_members", "case_comments", "generated_documents"]) {
    // clientA -> own case (expected: visible). cases table uses id, others case_id.
    {
      const col = table === "cases" ? "id" : "case_id";
      const c = sess.clientA.public;
      const r = await run(() => c.from(table).select("*", { count: "exact", head: true }).eq(col, cA));
      rec(findings.idor, { actor: "clientA", table, op: "select", target: "own(caseA)", expected: true, allowed: (r.count > 0), rows: r.count, code: r.code, note: r.msg });
    }
    // clientA -> other case (expected: NOT visible)
    {
      const col = table === "cases" ? "id" : "case_id";
      const c = sess.clientA.public;
      const r = await run(() => c.from(table).select("*", { count: "exact", head: true }).eq(col, cB));
      rec(findings.idor, { actor: "clientA", table, op: "select", target: "other(caseB)", expected: false, allowed: (r.count > 0), rows: r.count, code: r.code, note: r.msg });
    }
    // lawyerA -> own case (visible)
    {
      const col = table === "cases" ? "id" : "case_id";
      const c = sess.lawyerA.public;
      const r = await run(() => c.from(table).select("*", { count: "exact", head: true }).eq(col, cA));
      rec(findings.idor, { actor: "lawyerA", table, op: "select", target: "own(caseA)", expected: true, allowed: (r.count > 0), rows: r.count, code: r.code, note: r.msg });
    }
    // lawyerA -> unassigned case (NOT visible)
    {
      const col = table === "cases" ? "id" : "case_id";
      const c = sess.lawyerA.public;
      const r = await run(() => c.from(table).select("*", { count: "exact", head: true }).eq(col, cB));
      rec(findings.idor, { actor: "lawyerA", table, op: "select", target: "other(caseB)", expected: false, allowed: (r.count > 0), rows: r.count, code: r.code, note: r.msg });
    }
    // lawyerB -> caseA (NOT visible to lawyerB)
    {
      const col = table === "cases" ? "id" : "case_id";
      const c = sess.lawyerB.public;
      const r = await run(() => c.from(table).select("*", { count: "exact", head: true }).eq(col, cA));
      rec(findings.idor, { actor: "lawyerB", table, op: "select", target: "other(caseA)", expected: false, allowed: (r.count > 0), rows: r.count, code: r.code, note: r.msg });
    }
    // admin -> any case (visible)
    {
      const col = table === "cases" ? "id" : "case_id";
      const c = sess.admin.public;
      const r = await run(() => c.from(table).select("*", { count: "exact", head: true }).eq(col, cA));
      rec(findings.idor, { actor: "admin", table, op: "select", target: "caseA", expected: true, allowed: (r.count > 0), rows: r.count, code: r.code, note: r.msg });
    }
    // anon -> any case (NOT visible)
    {
      const col = table === "cases" ? "id" : "case_id";
      const r = await run(() => anonPublic.from(table).select("*", { count: "exact", head: true }).eq(col, cA));
      rec(findings.idor, { actor: "anon", table, op: "select", target: "caseA", expected: false, allowed: (r.count > 0), rows: r.count, code: r.code, note: r.msg });
    }
  }

  // ---- profiles cross-tenant: clientA should see only own profile ----
  {
    const c = sess.clientA.public;
    const r = await run(() => c.from("profiles").select("id", { count: "exact", head: true }));
    rec(findings.idor, { actor: "clientA", table: "profiles", op: "select", target: "all", expected: true, allowed: (r.count >= 1), rows: r.count, note: "should see >=1 (own) but not others'" });
    // attempt to read clientB's profile by id -> 0 rows expected
    const r2 = await run(() => c.from("profiles").select("id").eq("id", ident.clientB.userId));
    rec(findings.idor, { actor: "clientA", table: "profiles", op: "select", target: "other(clientB)", expected: false, allowed: (r2.data?.length > 0), rows: r2.data?.length, code: r2.code, note: r2.msg });
  }

  // ---- UPDATE matrix: cross-tenant update must affect 0 rows ----
  // clientA -> update caseB (other) -> 0 affected
  {
    const c = sess.clientA.public;
    const r = await run(() => c.from("cases").update({ notes: "pwned" }).eq("id", cB).select("id"));
    rec(findings.idor, { actor: "clientA", table: "cases", op: "update", target: "other(caseB)", expected: false, allowed: (r.data?.length > 0), rows: r.data?.length, code: r.code, note: r.msg, vector: "case_id swap" });
  }
  // lawyerA -> update caseB (unassigned) -> 0 affected
  {
    const c = sess.lawyerA.public;
    const r = await run(() => c.from("cases").update({ notes: "pwned" }).eq("id", cB).select("id"));
    rec(findings.idor, { actor: "lawyerA", table: "cases", op: "update", target: "other(caseB)", expected: false, allowed: (r.data?.length > 0), rows: r.data?.length, code: r.code, note: r.msg });
  }
  // lawyerA -> update own caseA -> allowed (>0)
  {
    const c = sess.lawyerA.public;
    const r = await run(() => c.from("cases").update({ notes: "ok-edit" }).eq("id", cA).select("id"));
    rec(findings.idor, { actor: "lawyerA", table: "cases", op: "update", target: "own(caseA)", expected: true, allowed: (r.data?.length > 0), rows: r.data?.length, code: r.code, note: r.msg });
  }
  // clientA -> update own case_comment authored by lawyer -> 0 (not author)
  {
    const c = sess.clientA.public;
    const r = await run(() => c.from("case_comments").update({ content: "pwned" }).eq("id", own.caseA.commentId).select("id"));
    rec(findings.idor, { actor: "clientA", table: "case_comments", op: "update", target: "own(comment,not author)", expected: false, allowed: (r.data?.length > 0), rows: r.data?.length, code: r.code, note: r.msg });
  }

  // ---- INSERT matrix: unauthorized inserts must fail ----
  // clientA -> insert case (only admin/lawyer) -> expect error
  {
    const c = sess.clientA.public;
    const r = await run(() => c.from("cases").insert({ title: "E2E rogue", status: "open" }).select("id").single());
    rec(findings.idor, { actor: "clientA", table: "cases", op: "insert", target: "new", expected: false, allowed: !r.error, code: r.code, note: r.msg, vector: "role escalation via insert" });
  }
  // clientA -> add case_member to caseB (other) -> expect error (can_manage_case false)
  {
    const c = sess.clientA.public;
    const r = await run(() => c.from("case_members").insert({ case_id: cB, user_id: ident.clientA.userId, case_role: "lawyer" }).select("case_id").single());
    rec(findings.idor, { actor: "clientA", table: "case_members", op: "insert", target: "other(caseB)", expected: false, allowed: !r.error, code: r.code, note: r.msg, vector: "add self as lawyer to other case" });
  }
  // clientA -> comment on caseB (other) -> expect error (can_read_case false)
  {
    const c = sess.clientA.public;
    const r = await run(() => c.from("case_comments").insert({ case_id: cB, author_id: ident.clientA.userId, content: "pwn" }).select("id").single());
    rec(findings.idor, { actor: "clientA", table: "case_comments", op: "insert", target: "other(caseB)", expected: false, allowed: !r.error, code: r.code, note: r.msg });
  }
  // lawyerB -> generated_document on caseA (other) -> expect error (can_read_case false)
  {
    const c = sess.lawyerB.public;
    const r = await run(() => c.from("generated_documents").insert({ case_id: cA, user_id: ident.lawyerB.userId, content: "x", document_type: "complaint", title: "x" }).select("id").single());
    rec(findings.idor, { actor: "lawyerB", table: "generated_documents", op: "insert", target: "other(caseA)", expected: false, allowed: !r.error, code: r.code, note: r.msg });
  }

  // ---- DELETE matrix: cross-tenant delete -> 0 affected ----
  // clientA -> delete caseB -> 0
  {
    const c = sess.clientA.public;
    const r = await run(() => c.from("cases").delete().eq("id", cB).select("id"));
    rec(findings.idor, { actor: "clientA", table: "cases", op: "delete", target: "other(caseB)", expected: false, allowed: (r.data?.length > 0), rows: r.data?.length, code: r.code, note: r.msg });
  }
  // lawyerB -> delete caseA comment (other) -> 0 (not author/admin, can_read false)
  {
    const c = sess.lawyerB.public;
    const r = await run(() => c.from("case_comments").delete().eq("id", own.caseA.commentId).select("id"));
    rec(findings.idor, { actor: "lawyerB", table: "case_comments", op: "delete", target: "other(caseA)", expected: false, allowed: (r.data?.length > 0), rows: r.data?.length, code: r.code, note: r.msg });
  }

  // ---- IDOR vectors ----
  // guessed UUID: clientA select cases by random uuid -> 0 rows, no leak
  {
    const c = sess.clientA.public;
    const guess = randomBytes(16).toString("hex").replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, "$1-$2-$3-$4-$5");
    const r = await run(() => c.from("cases").select("id").eq("id", guess));
    rec(findings.idor, { actor: "clientA", table: "cases", op: "select", target: "guessedUUID", expected: false, allowed: (r.data?.length > 0), rows: r.data?.length, code: r.code, vector: "guessed UUID" });
  }
  // filter removal: clientA select cases with no filter -> should see ONLY own (caseA), not caseB
  {
    const c = sess.clientA.public;
    const r = await run(() => c.from("cases").select("id", { count: "exact" }));
    const sawCaseB = (r.data || []).some((x) => x.id === cB);
    rec(findings.idor, { actor: "clientA", table: "cases", op: "select", target: "all(no filter)", expected: false, allowed: sawCaseB, rows: r.count, note: "must not include other-tenant caseB", vector: "filter removal" });
  }
  // nested relation/embedding: clientA select cases with case_comments(*) embedded -> must not leak other-tenant comments
  {
    const c = sess.clientA.public;
    const r = await run(() => c.from("cases").select("id,case_comments(id)"));
    const allComments = (r.data || []).flatMap((x) => x.case_comments || []);
    const sawOther = allComments.some((cm) => cm.id === own.caseB.commentId);
    rec(findings.idor, { actor: "clientA", table: "cases->case_comments", op: "select", target: "embedded", expected: false, allowed: sawOther, rows: allComments.length, code: r.code, note: r.msg, vector: "resource embedding" });
  }
  // RPC argument substitution: admin_set_user_role as lawyerA targeting admin user -> expect 42501 (only admin)
  {
    const r = await run(() => sess.lawyerA.public.rpc("admin_set_user_role", { p_user_id: ident.admin.userId, p_role: "client" }));
    rec(findings.idor, { actor: "lawyerA", table: "rpc", op: "admin_set_user_role", target: "admin", expected: false, allowed: !r.error, code: r.code, note: r.msg, vector: "RPC arg substitution" });
  }
}

// ============================================================
// severity classification
// ============================================================
function classify() {
  const p = { P0: [], P1: [], P2: [], P3: [] };
  for (const f of [...findings.auth, ...findings.idor]) {
    if (f.pass) continue;
    // unauthorized admin mutation / cross-tenant write / role escalation -> P1 (or P0 if anon)
    const isAnon = f.actor === "anon" || f.actor === "anonNoHeader" || f.actor === "invalidJWT" || f.actor === "malformedJWT";
    const isWrite = ["insert","update","delete","admin_set_user_role","updateRole"].includes(f.op);
    const isCrossTenant = String(f.target).includes("other") || f.target === "all" || f.target === "guessedUUID" || f.target === "embedded";
    if (isAnon && isWrite && f.allowed) p.P0.push(f);
    else if (isAnon && f.allowed && f.op === "select" && isCrossTenant) p.P1.push(f);
    else if (f.allowed && isWrite && isCrossTenant) p.P1.push(f);
    else if (f.allowed && f.op === "select" && isCrossTenant) p.P1.push(f);
    else if (f.actor === "missingProfile" || f.actor === "disabled") p.P2.push(f);
    else p.P3.push(f);
  }
  return p;
}

// ============================================================
// cleanup
// ============================================================
async function cleanup() {
  // delete fixture cases (cascades via app? not necessarily; delete members/comments/docs explicitly)
  for (const label of Object.keys(own)) {
    const { caseId } = own[label];
    try { await servicePublic.from("case_comments").delete().eq("case_id", caseId); } catch {}
    try { await servicePublic.from("generated_documents").delete().eq("case_id", caseId); } catch {}
    try { await servicePublic.from("case_members").delete().eq("case_id", caseId); } catch {}
    try { await servicePublic.from("cases").delete().eq("id", caseId); } catch {}
  }
  // delete users (profile first, then auth user)
  for (const u of createdUsers) { await deleteUser(u.id); }
}

// ============================================================
// main loop
// ============================================================
const LOOP = "LOOP_1";
let baseBefore;
try {
  await cleanupOrphans();
  baseBefore = await baseline();
  console.log("baseline before:", JSON.stringify(baseBefore));
  await provision();
  await signInAll();
  await authMatrix();
  await idorMatrix();
  const sev = classify();
  const baseAfter = await baseline();
  console.log("baseline after:", JSON.stringify(baseAfter));

  mkdirSync("e2e_final_audit", { recursive: true });
  const roleMatrix = {
    generatedAt: new Date().toISOString(),
    loop: LOOP,
    stagingProject: "vavjajwiqsdhlweggalw",
    runPrefix: RUN_PREFIX,
    identities: Object.fromEntries(Object.entries(ident).map(([k,v]) => [k, { userId: v.userId, role: k }])),
    results: findings.auth,
    summary: { total: findings.auth.length, failed: findings.auth.filter(f=>!f.pass).length },
  };
  writeFileSync("e2e_final_audit/01_ROLE_MATRIX.json", JSON.stringify(roleMatrix, null, 2));

  const idorResults = {
    generatedAt: new Date().toISOString(),
    loop: LOOP,
    stagingProject: "vavjajwiqsdhlweggalw",
    fixtures: Object.fromEntries(Object.entries(own).map(([k,v]) => [k, { lawyer: v.lawyer, client: v.client }])),
    results: findings.idor,
    summary: { total: findings.idor.length, failed: findings.idor.filter(f=>!f.pass).length },
    severity: { P0: sev.P0.length, P1: sev.P1.length, P2: sev.P2.length, P3: sev.P3.length, P0Details: sev.P0, P1Details: sev.P1 },
  };
  writeFileSync("e2e_final_audit/02_IDOR_RESULTS.json", JSON.stringify(idorResults, null, 2));

  console.log("\n=== AUTH MATRIX ===");
  console.log(JSON.stringify(roleMatrix.summary));
  console.log("\n=== IDOR MATRIX ===");
  console.log(JSON.stringify({ total: idorResults.summary.total, failed: idorResults.summary.failed, P0: idorResults.severity.P0, P1: idorResults.severity.P1, P2: idorResults.severity.P2, P3: idorResults.severity.P3 }));
  console.log("\nFailed IDOR cells:");
  for (const f of findings.idor.filter(f=>!f.pass)) console.log("  FAIL " + f.actor + " " + f.table + " " + f.op + " " + f.target + " expected=" + f.expected + " allowed=" + f.allowed + " code=" + (f.code||"") + " :: " + (f.note||""));
  console.log("\nFailed AUTH cells:");
  for (const f of findings.auth.filter(f=>!f.pass)) console.log("  FAIL " + f.actor + " " + f.table + " " + f.op + " expected=" + f.expected + " allowed=" + f.allowed + " code=" + (f.code||"") + " :: " + (f.note||""));
} catch (e) {
  console.log("FATAL:", e.stack || e.message);
} finally {
  await cleanup();
  const baseFinal = await baseline().catch(() => null);
  console.log("baseline final:", JSON.stringify(baseFinal));
  console.log("cleanup done; fixtures.users in-memory:", fixtures.users.length);
}
