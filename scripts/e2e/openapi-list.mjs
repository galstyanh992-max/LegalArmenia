import { stagingUrl, anonKey, serviceRoleKey } from "./staging-client.mjs";
// OpenAPI spec lists all exposed tables/views/RPCs and their schema (via x-pgrest_schema or schema property).
const r = await fetch(stagingUrl + "/rest/v1/", { headers: { apikey: serviceRoleKey, Authorization: "Bearer " + serviceRoleKey } });
console.log("status", r.status);
const spec = await r.json();
const paths = Object.keys(spec.paths || {});
// group by table name; capture schema from the path item if present
const tables = [];
for (const p of paths) {
  const item = spec.paths[p];
  const get = item.get;
  const schema = get?.["x-pgrest_schema"] || get?.schema || (get?.parameters||[]).find(x=>x?.schema)?.schema || "?";
  if (!p.includes("/") || p.startsWith("/")) tables.push({ path: p, schema });
}
// Print unique table-ish paths (skip RPCs which are under /rpc/)
const tbl = tables.filter(t=>!t.path.startsWith("/rpc/")).map(t=>t.path.replace(/^\//,"")+" ["+t.schema+"]");
console.log("TABLES/VIEWS ("+tbl.length+"):");
console.log(tbl.sort().join("\n"));
const rpcs = paths.filter(p=>p.startsWith("/rpc/")).map(p=>p.replace("/rpc/",""));
console.log("\nRPCs ("+rpcs.length+"):");
console.log(rpcs.sort().join("\n"));
