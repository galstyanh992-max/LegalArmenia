import { servicePublic, serviceApp } from "./staging-client.mjs";
const lu = await serviceApp.auth.admin.listUsers({ page: 1, perPage: 200 });
const e2e = (lu.data?.users||[]).filter(u => (u.email||"").endsWith("@legalarmenia-e2e.test"));
const del = async (p) => { try { return await p; } catch (e) { return { error: { message: String(e) } }; } };
for (const u of e2e) {
  await del(servicePublic.from("case_comments").delete().eq("author_id", u.id));
  await del(servicePublic.from("generated_documents").delete().eq("user_id", u.id));
  await del(servicePublic.from("case_members").delete().eq("user_id", u.id));
  await del(servicePublic.from("case_members").delete().eq("case_id", u.id)); // if user_id used as case id? no
  // cases where this user is lawyer/created_by/client
  const myCases = await servicePublic.from("cases").select("id").or(`lawyer_id.eq.${u.id},created_by.eq.${u.id},client_id.eq.${u.id}`);
  for (const c of (myCases.data||[])) {
    await del(servicePublic.from("case_comments").delete().eq("case_id", c.id));
    await del(servicePublic.from("generated_documents").delete().eq("case_id", c.id));
    await del(servicePublic.from("case_members").delete().eq("case_id", c.id));
    await del(servicePublic.from("cases").delete().eq("id", c.id));
  }
  await del(servicePublic.from("profiles").delete().eq("id", u.id));
  const d = await del(serviceApp.auth.admin.deleteUser(u.id));
  console.log("deleted user", u.id.slice(0,8), d.error?.message || "ok");
}
const lu2 = await serviceApp.auth.admin.listUsers({ page:1, perPage:200 });
const left = (lu2.data?.users||[]).filter(u=>(u.email||"").endsWith("@legalarmenia-e2e.test")).length;
const cs = await servicePublic.from("cases").select("*",{count:"exact",head:true});
const ps = await servicePublic.from("profiles").select("*",{count:"exact",head:true});
const cm = await servicePublic.from("case_members").select("*",{count:"exact",head:true});
const cc = await servicePublic.from("case_comments").select("*",{count:"exact",head:true});
const gd = await servicePublic.from("generated_documents").select("*",{count:"exact",head:true});
import { writeFileSync, mkdirSync } from "node:fs";
mkdirSync("e2e_final_audit", { recursive: true });
const finalBaseline = { cases: cs.count, case_members: cm.count, case_comments: cc.count, generated_documents: gd.count, profiles: ps.count, documents: (await servicePublic.from("documents").select("*",{count:"exact",head:true})).count, _authUsers: lu2.data?.users?.length, _e2eUsersRemaining: left };
writeFileSync("e2e_final_audit/07_FIXTURE_CLEANUP.json", JSON.stringify({ generatedAt: new Date().toISOString(), finalBaseline, baselineRestored: left === 0 && finalBaseline.cases === 2 && finalBaseline.profiles === 6 }, null, 2));
console.log("FINAL: " + JSON.stringify(finalBaseline));
