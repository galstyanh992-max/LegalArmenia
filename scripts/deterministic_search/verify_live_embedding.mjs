const base = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!base || !key) throw new Error("Supabase environment is required");
const started = performance.now();
const response = await fetch(`${base.replace(/\/$/, "")}/functions/v1/embed-query`, {
  method: "POST",
  headers: { authorization: `Bearer ${key}`, apikey: key, "content-type": "application/json" },
  body: JSON.stringify({ text: "Հայաստանի Հանրապետություն" }),
});
let data;
try { data = await response.json(); } catch { data = null; }
const vector = Array.isArray(data?.vector) ? data.vector : [];
console.log(JSON.stringify({
  http_status: response.status,
  embedding_ok: response.ok && vector.length === 1024 && vector.every(Number.isFinite),
  dimension: vector.length || data?.dimension || null,
  model: data?.model || null,
  latency_ms: Math.round((performance.now() - started) * 100) / 100,
  error_code: response.ok ? null : data?.code || data?.error || "NON_JSON_ERROR",
  production_writes: 0,
}, null, 2));
if (!response.ok || vector.length !== 1024) process.exitCode = 1;
