import { serviceApp, servicePublic } from "./staging-client.mjs";

// Candidate (schema, table) pairs derived from migrations + task list.
const CANDIDATES = [
  ["app","user_profiles"], ["app","cases"], ["app","case_members"], ["app","case_messages"],
  ["app","client_documents"], ["app","generated_documents"], ["app","ai_analysis_runs"],
  ["app","multi_agent_analysis_runs"], ["app","legal_decisions"],
  ["public","case_comments"], ["public","chats"], ["public","chat_messages"],
  ["public","support_tickets"], ["public","ticket_comments"], ["public","tasks"],
  ["public","messages"], ["public","message_templates"], ["public","sales_scripts"],
  ["public","lead_stage_history"], ["public","ai_history"], ["public","audit_logs"],
  ["public","documents"], ["public","document_versions"], ["public","profiles"],
  ["public","app_settings"], ["public","ai_prompts"],
];

const out = [];
for (const [schema, table] of CANDIDATES) {
  const client = schema === "app" ? serviceApp : servicePublic;
  const { data, error, count } = await client.from(table).select("*", { count: "exact", head: true });
  if (error) {
    const msg = String(error.message || "");
    out.push({ schema, table, exists: !/does not exist|Could not find|relation/i.test(msg), error: msg.slice(0,120) });
  } else {
    out.push({ schema, table, exists: true, count });
  }
}
console.log(JSON.stringify(out.filter(c=>c.exists), null, 1));
console.log("--- non-existent/other ---");
for (const c of out.filter(x=>!x.exists)) console.log(c.schema + "." + c.table + " :: " + (c.error || ""));
