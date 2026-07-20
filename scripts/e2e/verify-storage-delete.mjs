import { servicePublic, anonPublic } from "./staging-client.mjs";
import { createIdentity, signInAs, deleteUser, createdUsers, cleanupOrphans } from "./harness-lib.mjs";

async function exists(path) {
  const r = await servicePublic.storage.from("case-files").list(path.split("/")[0] + "/");
  const name = path.split("/").slice(1).join("/");
  return !!(r.data || []).find((f) => (path.split("/").slice(1).join("/")) === f.name);
}
async function head(path) {
  // try download via service role; success => exists
  const r = await servicePublic.storage.from("case-files").download(path);
  return !r.error;
}

await cleanupOrphans();
const lawyer = await createIdentity("lawyer", { fullName: "VerLawyer" });
const sl = await signInAs(lawyer.email, lawyer.password);
const client = await createIdentity("client", { fullName: "VerClient" });
const sc = await signInAs(client.email, client.password);
const ins = await sl.public.from("cases").insert({ title: "VerCase", status: "open" }).select("id").single();
const caseId = ins.data.id;
await sl.public.from("case_members").insert({ case_id: caseId, user_id: client.userId, case_role: "client" });

// upload a file to own case as lawyer
const up = await sl.public.storage.from("case-files").upload(caseId + "/target.pdf", Buffer.alloc(16), { contentType: "application/pdf" });
console.log("lawyer upload own:", up.error ? up.error.message : "ok");
console.log("exists before anon delete (service):", await head(caseId + "/target.pdf"));

// anon tries to delete
const delAnon = await anonPublic.storage.from("case-files").remove([caseId + "/target.pdf"]);
console.log("anon remove error:", delAnon.error ? delAnon.error.message : "NONE");
console.log("exists after anon delete (service):", await head(caseId + "/target.pdf"));

// client (member) tries to delete the lawyer's file in same case
const delClient = await sc.public.storage.from("case-files").remove([caseId + "/target.pdf"]);
console.log("client remove error:", delClient.error ? delClient.error.message : "NONE");
console.log("exists after client(member) delete (service):", await head(caseId + "/target.pdf"));

// path traversal: upload caseId/..%2F..%2Fescape.pdf as lawyer, then list bucket root to see if escape.pdf landed outside caseId
const pt = await sl.public.storage.from("case-files").upload(caseId + "/..%2F..%2Fescape.pdf", Buffer.alloc(8), { contentType: "application/pdf" });
console.log("traversal upload error:", pt.error ? pt.error.message : "NONE");
const root = await servicePublic.storage.from("case-files").list("");
console.log("bucket root listing names:", JSON.stringify((root.data||[]).map(f=>f.name)));
const caseList = await servicePublic.storage.from("case-files").list(caseId + "/");
console.log("case folder listing names:", JSON.stringify((caseList.data||[]).map(f=>f.name)));

// cleanup
await servicePublic.storage.from("case-files").remove([caseId + "/target.pdf"]).catch(()=>{});
// remove any traversal object
for (const f of (caseList.data||[])) await servicePublic.storage.from("case-files").remove([caseId + "/" + f.name]).catch(()=>{});
for (const f of (root.data||[])) { if (f.name === "escape.pdf" || f.name.includes("escape")) await servicePublic.storage.from("case-files").remove([f.name]).catch(()=>{}); }
await servicePublic.from("case_members").delete().eq("case_id", caseId);
await servicePublic.from("cases").delete().eq("id", caseId);
await deleteUser(lawyer.userId); await deleteUser(client.userId);
console.log("done");
