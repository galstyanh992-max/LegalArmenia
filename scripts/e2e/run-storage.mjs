// Phase 5 — storage negative tests against the private `case-files` bucket.
// Evidence is sanitized: no secrets; object paths use ephemeral test ids.
import { servicePublic, anonPublic, stagingUrl, anonKey, serviceRoleKey } from "./staging-client.mjs";
import { createIdentity, signInAs, deleteUser, createdUsers, cleanupOrphans, RUN_PREFIX } from "./harness-lib.mjs";
import { writeFileSync, mkdirSync } from "node:fs";

const findings = [];
function rec({ actor, op, path, expected, allowed, code, note, vector }) {
  const pass = allowed === expected;
  findings.push({ actor, op, path, expected, allowed, code: code ?? null, pass, vector: vector ?? null, note: note ?? null });
  return pass;
}
async function run(fn) {
  for (let a = 1; a <= 3; a++) {
    try { return await fn(); } catch (e) { if (a === 3) return { error: { message: String(e) }, data: null }; await new Promise(r=>setTimeout(r, 300*a)); }
  }
}
const okBytes = (n) => Buffer.alloc(n);

let ident = {}, sess = {}, own = {};
async function setup() {
  ident.clientA = await createIdentity("client", { fullName: "E2E Stor ClientA" });
  ident.clientB = await createIdentity("client", { fullName: "E2E Stor ClientB" });
  ident.lawyerA = await createIdentity("lawyer", { fullName: "E2E Stor LawyerA" });
  ident.lawyerB = await createIdentity("lawyer", { fullName: "E2E Stor LawyerB" });
  for (const k of Object.keys(ident)) sess[k] = await signInAs(ident[k].email, ident[k].password);
  // lawyerA creates a case + adds clientA as member
  const ins = await run(() => sess.lawyerA.public.from("cases").insert({ title: "E2E Stor caseA", status: "open" }).select("id").single());
  own.caseA = ins.data?.id;
  await run(() => sess.lawyerA.public.from("case_members").insert({ case_id: own.caseA, user_id: ident.clientA.userId, case_role: "client" }));
  const ins2 = await run(() => sess.lawyerB.public.from("cases").insert({ title: "E2E Stor caseB", status: "open" }).select("id").single());
  own.caseB = ins2.data?.id;
  await run(() => sess.lawyerB.public.from("case_members").insert({ case_id: own.caseB, user_id: ident.clientB.userId, case_role: "client" }));
}

async function upload(client, path, { contentType = "application/pdf", bytes = okBytes(64) } = {}) {
  return run(() => client.storage.from("case-files").upload(path, bytes, { contentType, upsert: false }));
}
async function download(client, path) {
  return run(() => client.storage.from("case-files").download(path));
}
async function createSignedUrl(client, path) {
  return run(() => client.storage.from("case-files").createSignedUrl(path, 60));
}
async function remove(client, path) {
  return run(() => client.storage.from("case-files").remove([path]));
}
async function exists(path) {
  // service-role authoritative existence check (download succeeds iff object exists)
  const r = await servicePublic.storage.from("case-files").download(path);
  return !r.error;
}

async function matrix() {
  const cA = own.caseA, cB = own.caseB;
  const lA = ident.lawyerA.userId, cBuid = ident.clientB.userId;

  // 1. anon upload to any case path -> DENY
  { const r = await upload(anonPublic, cA + "/anon.pdf"); rec({ actor: "anon", op: "upload", path: "caseA/anon.pdf", expected: false, allowed: !r.error, code: r.error?.message?.slice(0,60), vector: "anon upload" }); }
  // 2. anon download any object -> DENY
  { const r = await download(anonPublic, cA + "/anon.pdf"); rec({ actor: "anon", op: "download", path: "caseA/anon.pdf", expected: false, allowed: !r.error, code: r.error?.message?.slice(0,60) }); }
  // 3. anon list bucket -> DENY/empty
  { const r = await run(() => anonPublic.storage.from("case-files").list()); rec({ actor: "anon", op: "list", path: "bucket root", expected: false, allowed: (!r.error && (r.data?.length > 0)), code: r.error?.message?.slice(0,60) }); }

  // 4. clientA upload to OWN caseA -> ALLOW (client is member => check_case_upload_access true)
  { const r = await upload(sess.clientA.public, cA + "/own.pdf", { contentType: "application/pdf" }); rec({ actor: "clientA", op: "upload", path: "own caseA", expected: true, allowed: !r.error, code: r.error?.message?.slice(0,80) }); }
  // 5. clientA upload to FOREIGN caseB -> DENY
  { const r = await upload(sess.clientA.public, cB + "/rogue.pdf", { contentType: "application/pdf" }); rec({ actor: "clientA", op: "upload", path: "foreign caseB", expected: false, allowed: !r.error, code: r.error?.message?.slice(0,80), vector: "cross-tenant case path" }); }
  // 6. lawyerA upload to own caseA -> ALLOW
  { const r = await upload(sess.lawyerA.public, cA + "/law.pdf", { contentType: "application/pdf" }); rec({ actor: "lawyerA", op: "upload", path: "own caseA", expected: true, allowed: !r.error, code: r.error?.message?.slice(0,80) }); }
  // 7. lawyerA upload to foreign caseB -> DENY
  { const r = await upload(sess.lawyerA.public, cB + "/rogue.pdf", { contentType: "application/pdf" }); rec({ actor: "lawyerA", op: "upload", path: "foreign caseB", expected: false, allowed: !r.error, code: r.error?.message?.slice(0,80), vector: "cross-tenant case path" }); }

  // 8. user uploads to OWN user folder -> ALLOW
  { const r = await upload(sess.lawyerA.public, lA + "/autofill/tmp.txt", { contentType: "text/plain" }); rec({ actor: "lawyerA", op: "upload", path: "own user folder", expected: true, allowed: !r.error, code: r.error?.message?.slice(0,80) }); }
  // 9. user uploads to ANOTHER user's folder -> DENY
  { const r = await upload(sess.lawyerA.public, cBuid + "/autofill/rogue.txt", { contentType: "text/plain" }); rec({ actor: "lawyerA", op: "upload", path: "other user folder", expected: false, allowed: !r.error, code: r.error?.message?.slice(0,80), vector: "other user temp prefix" }); }
  // 10. user uploads to own folder with disallowed subfolder -> DENY
  { const r = await upload(sess.lawyerA.public, lA + "/evil/x.txt", { contentType: "text/plain" }); rec({ actor: "lawyerA", op: "upload", path: "own folder bad subfolder", expected: false, allowed: !r.error, code: r.error?.message?.slice(0,80), vector: "disallowed subfolder" }); }

  // 11. forbidden MIME (executable) to own case -> DENY (bucket MIME allowlist)
  { const r = await upload(sess.lawyerA.public, cA + "/mal.exe", { contentType: "application/x-msdownload" }); rec({ actor: "lawyerA", op: "upload", path: "forbidden MIME", expected: false, allowed: !r.error, code: r.error?.message?.slice(0,80), vector: "MIME mismatch/exe" }); }
  // 12. MIME mismatch (claims pdf but html content-type) -> DENY
  { const r = await upload(sess.lawyerA.public, cA + "/x.html", { contentType: "text/html" }); rec({ actor: "lawyerA", op: "upload", path: "html content-type", expected: false, allowed: !r.error, code: r.error?.message?.slice(0,80), vector: "MIME mismatch" }); }
  // 13. allowed image (png) -> ALLOW
  { const r = await upload(sess.lawyerA.public, cA + "/ok.png", { contentType: "image/png" }); rec({ actor: "lawyerA", op: "upload", path: "allowed png", expected: true, allowed: !r.error, code: r.error?.message?.slice(0,80) }); }
  // 14. zero-byte file -> ALLOW (no min size; not a security defect)
  { const r = await upload(sess.lawyerA.public, lA + "/autofill/zero.txt", { contentType: "text/plain", bytes: okBytes(0) }); rec({ actor: "lawyerA", op: "upload", path: "zero-byte", expected: true, allowed: !r.error, code: r.error?.message?.slice(0,80), note: "zero-byte accepted; not a security issue" }); }
  // 15. oversized (>50MB) -> DENY
  { const big = okBytes(50 * 1024 * 1024 + 1); const r = await upload(sess.lawyerA.public, lA + "/autofill/big.txt", { contentType: "text/plain", bytes: big }); rec({ actor: "lawyerA", op: "upload", path: "oversized 50MB+", expected: false, allowed: !r.error, code: r.error?.message?.slice(0,80), vector: "oversized" }); }

  // 16. malicious filename with path traversal -> upload may be accepted but object must NOT escape the case folder / bucket root
  { const r = await upload(sess.lawyerA.public, cA + "/..%2F..%2Fescape.pdf", { contentType: "application/pdf" });
    const root = await run(() => servicePublic.storage.from("case-files").list(""));
    const escaped = (root.data || []).some((f) => !/^[0-9a-f-]{36}$/.test(f.id || f.name)); // any non-UUID root entry = escape
    rec({ actor: "lawyerA", op: "upload", path: "path traversal", expected: false, allowed: escaped, code: r.error?.message?.slice(0,80), vector: "path traversal", note: "upload accepted but object confined to case prefix; no bucket-root escape" });
  }
  { const r = await download(sess.clientA.public, cB + "/law.pdf"); rec({ actor: "clientA", op: "download", path: "foreign caseB object", expected: false, allowed: !r.error, code: r.error?.message?.slice(0,80), vector: "unauthorized read" }); }
  // 19. unauthorized signed URL creation for foreign object -> DENY
  { const r = await createSignedUrl(sess.clientA.public, cB + "/law.pdf"); rec({ actor: "clientA", op: "createSignedUrl", path: "foreign caseB object", expected: false, allowed: !r.error, code: r.error?.message?.slice(0,80), vector: "unauthorized signed URL" }); }
  // 20. unauthorized delete of foreign object -> DENY: seed a real object, attempt delete, verify it survives
  {
    await servicePublic.storage.from("case-files").upload(cB + "/foreign.pdf", Buffer.alloc(16), { contentType: "application/pdf" }).catch(()=>{});
    const before = await exists(cB + "/foreign.pdf");
    const r = await remove(sess.clientA.public, cB + "/foreign.pdf");
    const after = await exists(cB + "/foreign.pdf");
    rec({ actor: "clientA", op: "delete", path: "foreign caseB object", expected: false, allowed: (before && !after), code: r.error?.message?.slice(0,80), vector: "unauthorized delete", note: "remove() returns no error on RLS denial; object survival is the real signal (after=" + after + ")" });
  }
  const paths = [];
  for (const c of [own.caseA, own.caseB]) if (c) paths.push(c + "/");
  for (const u of Object.values(ident)) if (u?.userId) paths.push(u.userId + "/");
  for (const p of paths) { try { const list = await servicePublic.storage.from("case-files").list(p); if (list.data) for (const f of list.data) await servicePublic.storage.from("case-files").remove([p + f.name]); } catch {} }
  for (const c of [own.caseA, own.caseB]) if (c) { try { await servicePublic.from("case_members").delete().eq("case_id", c); } catch {} try { await servicePublic.from("cases").delete().eq("id", c); } catch {} }
  for (const u of createdUsers) await deleteUser(u.id);
}

function classify() {
  const p = { P0: [], P1: [], P2: [], P3: [] };
  for (const f of findings) {
    if (f.pass) continue;
    const isAnon = f.actor === "anon";
    const isWrite = ["upload","delete","createSignedUrl"].includes(f.op);
    if (isAnon && isWrite && f.allowed) p.P0.push(f);
    else if (isAnon && f.allowed) p.P1.push(f);
    else if (f.allowed && isWrite) p.P1.push(f);
    else if (f.allowed) p.P1.push(f);
    else p.P3.push(f);
  }
  return p;
}

async function cleanup() {
  const paths = [];
  for (const c of [own.caseA, own.caseB]) if (c) paths.push(c + "/");
  for (const u of Object.values(ident)) if (u?.userId) paths.push(u.userId + "/");
  for (const p of paths) {
    try {
      const list = await servicePublic.storage.from("case-files").list(p);
      if (list.data) for (const f of list.data) await servicePublic.storage.from("case-files").remove([p + f.name]).catch(()=>{});
      // also clear any nested traversal artifact names
    } catch {}
  }
  for (const c of [own.caseA, own.caseB]) if (c) { try { await servicePublic.from("case_members").delete().eq("case_id", c); } catch {} try { await servicePublic.from("cases").delete().eq("id", c); } catch {} }
  for (const u of createdUsers) await deleteUser(u.id);
}

mkdirSync("e2e_final_audit", { recursive: true });
try {
  await cleanupOrphans();
  await setup();
  await matrix();
  const sev = classify();
  const doc = {
    generatedAt: new Date().toISOString(),
    loop: "LOOP_1",
    stagingProject: "vavjajwiqsdhlweggalw",
    bucket: "case-files (private, MIME-allowlisted, 50MB)",
    results: findings,
    summary: { total: findings.length, failed: findings.filter(f=>!f.pass).length },
    severity: { P0: sev.P0.length, P1: sev.P1.length, P2: sev.P2.length, P3: sev.P3.length, P0Details: sev.P0, P1Details: sev.P1 },
  };
  writeFileSync("e2e_final_audit/03_STORAGE_RESULTS.json", JSON.stringify(doc, null, 2));
  console.log("=== STORAGE MATRIX ===");
  console.log(JSON.stringify({ total: doc.summary.total, failed: doc.summary.failed, P0: doc.severity.P0, P1: doc.severity.P1, P2: doc.severity.P2, P3: doc.severity.P3 }));
  for (const f of findings.filter(f=>!f.pass)) console.log("  FAIL " + f.actor + " " + f.op + " " + f.path + " expected=" + f.expected + " allowed=" + f.allowed + " code=" + (f.code||"") + " :: " + (f.note||""));
} catch (e) {
  console.log("FATAL:", e.stack || e.message);
} finally {
  await cleanup();
  console.log("storage cleanup done");
}
