import { servicePublic, anonPublic, serviceApp, stagingUrl, anonKey, serviceRoleKey } from "./staging-client.mjs";
import { createIdentity, signInAs, deleteUser, cleanupOrphans } from "./harness-lib.mjs";

// Tables in scope for Phase 4 (comments, tasks, messages, CRM). Check live RLS behavior.
const TABLES = ["case_comments","support_tickets","ticket_comments","tasks","messages","message_templates","sales_scripts","lead_stage_history","ai_history","chats","chat_messages","generated_documents"];

async function rlsProbe(table, client, label) {
  const r = await client.from(table).select("*", { count: "exact", head: true });
  return { table, label, count: r.count, error: r.error?.message?.slice(0,80) || null };
}

const out = { anon: [], service: [] };
for (const t of TABLES) {
  out.anon.push(await rlsProbe(t, anonPublic, "anon"));
  out.service.push(await rlsProbe(t, servicePublic, "service"));
}
console.log("RLS probe (row counts visible):");
console.log("anon:    " + JSON.stringify(out.anon));
console.log("service: " + JSON.stringify(out.service));

// Authenticated non-member: create a fresh client, sign in, see how many rows of each CRM table they can read (should be 0 or only own).
await cleanupOrphans();
const me = await createIdentity("client", { fullName: "Phase4 Client" });
const s = await signInAs(me.email, me.password);
const authed = [];
for (const t of TABLES) {
  const r = await s.public.from(t).select("*", { count: "exact", head: true });
  authed.push({ table: t, count: r.count, error: r.error?.message?.slice(0,60) || null });
}
console.log("authed-newclient: " + JSON.stringify(authed));

// Storage buckets
const sb = await fetch(stagingUrl + "/storage/v1/bucket", { headers: { apikey: serviceRoleKey, Authorization: "Bearer " + serviceRoleKey } });
const sbj = await sb.json().catch(()=>null);
console.log("buckets status:", sb.status, "count:", Array.isArray(sbj) ? sbj.length : null);
console.log("bucket names: " + (Array.isArray(sbj) ? sbj.map(b=>b.id+"(public="+(b.public===true)+")").join(", ") : JSON.stringify(sbj)?.slice(0,200)));

await deleteUser(me.userId);
