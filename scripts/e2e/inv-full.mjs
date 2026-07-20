import { serviceApp, servicePublic, stagingUrl, serviceRoleKey } from "./staging-client.mjs";
import { writeFileSync, mkdirSync } from "node:fs";

const lu = await serviceApp.auth.admin.listUsers({ page: 1, perPage: 200 });
const e2e = (lu.data?.users||[]).filter(u => (u.email||"").endsWith("@legalarmenia-e2e.test"));
const uid = e2e[0].id;

const specR = await fetch(stagingUrl + "/rest/v1/", { headers: { apikey: serviceRoleKey, Authorization: "Bearer " + serviceRoleKey } });
const spec = await specR.json();
const tables = Object.keys(spec.paths||{}).filter(p=>!p.startsWith("/rpc/")).map(p=>p.replace(/^\//,"")).filter(t=>t && /^[a-z_][a-z0-9_]*$/i.test(t));
const userCols = ["user_id","author_id","created_by","client_id","lawyer_id","owner_id","assigned_to","sender_id","recipient_id","profile_id","uploaded_by","generated_by","actor_id","member_id","reviewer_id","assignee_id","requester_id"];

// Build all (table,col) probes with a per-probe timeout via Promise.race.
const probe = (table, col) => Promise.race([
  servicePublic.from(table).select("*", { count: "exact", head: true }).eq(col, uid)
    .then(r => ({ table, col, count: r.count, error: r.error ? r.error.message : null }))
    .catch(e => ({ table, col, count: null, error: String(e).slice(0,60) })),
  new Promise(resolve => setTimeout(() => resolve({ table, col, count: null, error: "timeout" }), 8000)),
]);

const tasks = [];
for (const table of tables) for (const col of userCols) tasks.push(probe(table, col));
// Run in chunks of 24 to avoid overwhelming the client.
const results = [];
for (let i = 0; i < tasks.length; i += 24) {
  const chunk = tasks.slice(i, i + 24);
  const res = await Promise.all(chunk);
  results.push(...res);
  process.stdout.write(".");
}
console.log("\nprobes done:", results.length);
const hits = results.filter(r => r.count && r.count > 0);
const errs = results.filter(r => r.error && r.error !== "timeout");
const timeouts = results.filter(r => r.error === "timeout");
console.log("=== HITS (count>0) ===");
console.log(JSON.stringify(hits, null, 2));
console.log("timeouts:", timeouts.length, "errors:", errs.length);

mkdirSync("e2e_final_audit", { recursive: true });
writeFileSync("e2e_final_audit/07c_FULL_DEPENDENCY_INVENTORY.json", JSON.stringify({
  generatedAt: new Date().toISOString(), loop: "LOOP_4", orphanIdPrefix: uid.slice(0,8),
  tablesProbed: tables.length, probes: results.length, referencingRows: hits,
  timeouts: timeouts.map(t=>({table:t.table,col:t.col})),
}, null, 2));
console.log("written 07c_FULL_DEPENDENCY_INVENTORY.json");
