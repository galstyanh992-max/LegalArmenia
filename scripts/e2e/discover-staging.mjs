import { serviceClient, anonClient, stagingUrl } from "./staging-client.mjs";

const out = { url: stagingUrl, projectRefGuess: stagingUrl.match(/https:\/\/([a-z0-9]+)\.supabase/i)?.[1] || null };

// 1. Reachability: anon health via REST root.
try {
  const r = await fetch(stagingUrl + "/rest/v1/", { headers: { apikey: anonClient.supabaseKey } });
  out.restRootStatus = r.status;
} catch (e) { out.restRootError = String(e); }

// 2. List user tables + RLS status via service-role pg introspection (PostgREST: pg_catalog not exposed).
//    Use supabase introspection RPC if available; else fall back to a curated table probe.
const CANDIDATE_TABLES = [
  "profiles","app_profiles","cases","case_documents","case_comments","tasks","messages","message_templates",
  "support_tickets","ticket_comments","sales_scripts","lead_stage_history","ai_history","generated_documents",
  "ocr_jobs","case_members","users","lawyers","clients","leads","documents","files","uploads","bucket_files",
];

async function probeTable(name) {
  // service-role count
  let srCount = null, srErr = null;
  try {
    const { count, error } = await serviceClient.from(name).select("*", { count: "exact", head: true });
    srCount = error ? null : count;
    if (error) srErr = error.message;
  } catch (e) { srErr = String(e); }
  // anon (RLS) count
  let anonCount = null, anonErr = null;
  try {
    const { count, error } = await anonClient.from(name).select("*", { count: "exact", head: true });
    anonCount = error ? null : count;
    if (error) anonErr = error.message;
  } catch (e) { anonErr = String(e); }
  return { table: name, serviceRole: srCount, serviceRoleErr: srErr ?? null, anonRls: anonCount, anonErr: anonErr ?? null, rlsEnforced: (srErr === null && anonErr !== null && /permission|denied|rls|policy/i.test(anonErr || "")) || (srCount !== null && anonCount === 0 && !anonErr) };
}

const probes = [];
for (const t of CANDIDATE_TABLES) probes.push(await probeTable(t));
out.tables = probes.filter((p) => p.serviceRole !== null || p.serviceRoleErr === null || !/relation .* does not exist/i.test(p.serviceRoleErr || ""));

// 3. Edge functions list (requires management API / functions endpoint). Try the functions invoke list path.
try {
  const fnr = await fetch(stagingUrl + "/functions/v1/", { headers: { Authorization: "Bearer " + serviceClient.supabaseKey } });
  out.functionsRootStatus = fnr.status;
} catch (e) { out.functionsRootError = String(e); }

console.log(JSON.stringify(out, null, 2));
