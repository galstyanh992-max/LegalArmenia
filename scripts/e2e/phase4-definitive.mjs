import { servicePublic, anonPublic, stagingUrl, anonKey } from "./staging-client.mjs";
const TABS = ["support_tickets","ticket_comments","tasks","messages","message_templates","sales_scripts","lead_stage_history","ai_history","reminders","notifications"];
async function probe(client, label) {
  const out = [];
  for (const t of TABS) {
    const r = await client.from(t).select("*").limit(1);
    out.push({ t, label, rows: r.data?.length ?? null, err: r.error ? (r.error.code + ": " + String(r.error.message).slice(0,70)) : null });
  }
  return out;
}
// direct REST call without supabase-js to see raw status (anon, no session)
async function rawAnon(t) {
  const r = await fetch(stagingUrl + "/rest/v1/" + t + "?select=*&limit=1", { headers: { apikey: anonKey } });
  const body = await r.text();
  return { t, status: r.status, bodyHead: body.slice(0, 100) };
}
console.log("anon (supabase-js): " + JSON.stringify(await probe(anonPublic, "anon")));
console.log("service (supabase-js): " + JSON.stringify(await probe(servicePublic, "service")));
console.log("anon raw REST: " + JSON.stringify(await Promise.all(TABS.map(rawAnon))));
