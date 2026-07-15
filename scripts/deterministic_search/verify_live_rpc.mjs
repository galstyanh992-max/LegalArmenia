const base = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!base || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");

const response = await fetch(`${base.replace(/\/$/, "")}/rest/v1/rpc/search_legal_corpus_metric`, {
  method: "POST",
  headers: {
    apikey: key,
    authorization: `Bearer ${key}`,
    "content-type": "application/json",
  },
  body: JSON.stringify({
    p_query_text: "Հայաստանի Հանրապետություն",
    p_metric_embedding: null,
    p_content_domain: null,
    p_status_scope: "current",
    p_effective_at: null,
    p_limit: 5,
    p_ann_limit: 20,
    p_fts_limit: 20,
  }),
});
let data;
try { data = await response.json(); } catch { data = null; }
const rows = Array.isArray(data) ? data : [];
console.log(JSON.stringify({
  http_status: response.status,
  rpc_ok: response.ok,
  result_count: rows.length,
  all_current_results_active: rows.every((row) =>
    row.norm_status === "active" && row.status_eligible === true
  ),
  error_code: response.ok ? null : data?.code ?? "NON_JSON_ERROR",
  error_message: response.ok ? null : data?.message ?? null,
  production_writes: 0,
}, null, 2));
if (!response.ok) process.exitCode = 1;
