import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.91.1";
import { handleCors, isValidInternalCall } from "../_shared/edge-security.ts";

// AI LEGAL ARMENIA — query embedding proxy.
//
// Why: vector search needs a query vector with the SAME model/semantics as the
// indexed passages (Metric-AI/armenian-text-embeddings-2-large, 1024-dim,
// "query:" prefix). That model runs in a self-hosted FastAPI service
// (scripts/embedding_server.py), NOT in Deno. This edge function is a thin,
// authenticated server-side proxy to that service so the endpoint URL and the
// optional API key stay OFF the client.
//
// ENV (set in Supabase → Edge Functions → Secrets):
//   EMBEDDING_ENDPOINT   e.g. https://embeddings.example.com   (must be reachable from edge)
//   EMBEDDING_API_KEY    optional shared secret -> sent as X-API-Key
//   EMBEDDING_DIM        expected vector dimension (default 1024)
//
// Request : { text: string }
// Response: { vector: number[], dimension: number, model: string }
// On any failure the caller (LegalSearch) falls back to FTS — so a missing or
// unreachable endpoint degrades gracefully, never breaks search. The specific
// error string lets the caller (and the audit) distinguish failure modes.

interface EmbedBody {
  text?: string;
}

serve(async (req) => {
  const cors = handleCors(req);
  if (cors.errorResponse) return cors.errorResponse;
  const headers = { ...cors.corsHeaders, "Content-Type": "application/json" };

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !anonKey) throw new Error("Supabase env not configured");

    // Auth guard: internal edge calls use x-internal-key; browser calls require user JWT.
    if (!isValidInternalCall(req)) {
      const authHeader = req.headers.get("Authorization") ?? "";
      const authClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: authError } = await authClient.auth.getUser();
      if (authError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
      }
    }

    const endpoint = Deno.env.get("EMBEDDING_ENDPOINT");
    if (!endpoint) {
      // Not configured -> signal caller to use FTS fallback.
      return new Response(JSON.stringify({ error: "embedding_endpoint_unset" }), { status: 503, headers });
    }
    // Edge cannot reach localhost/private IPs on the VPS. A non-routable endpoint
    // here means semantic search is silently degraded — surface it instead of
    // timing out. isNonRoutableEndpoint covers dotted, octal, decimal and hex
    // forms of 127.x, the 10/172.16-31/192.168/169.254/100.64 ranges, IPv6
    // loopback, ULA (fc00::/7) and link-local (fe80::/7).
    if (isNonRoutableEndpoint(endpoint)) {
      console.warn("[embed-query] EMBEDDING_ENDPOINT is not routable from Supabase Edge (localhost/private IP); set a public HTTPS URL in Edge Secrets");
      return new Response(JSON.stringify({ error: "embedding_endpoint_unroutable" }), { status: 503, headers });
    }

    const body = (await req.json()) as EmbedBody;
    const text = (body.text ?? "").trim();
    if (!text) {
      return new Response(JSON.stringify({ error: "text is required" }), { status: 400, headers });
    }

    const apiKey = Deno.env.get("EMBEDDING_API_KEY");
    const upstreamHeaders: Record<string, string> = { "Content-Type": "application/json" };
    if (apiKey) upstreamHeaders["X-API-Key"] = apiKey;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    let upstream: Response;
    try {
      upstream = await fetch(`${endpoint.replace(/\/+$/, "")}/embed/query`, {
        method: "POST",
        headers: upstreamHeaders,
        body: JSON.stringify({ texts: text }),
        signal: controller.signal,
      });
    } catch (fetchErr) {
      // Distinguish timeout/abort from other network errors so the caller (and
      // the live audit) can tell "endpoint down" from "endpoint slow".
      const aborted = fetchErr instanceof DOMException && fetchErr.name === "AbortError";
      return new Response(
        JSON.stringify({ error: aborted ? "embedding_timeout" : "embedding_unreachable" }),
        { status: 502, headers },
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!upstream.ok) {
      return new Response(
        JSON.stringify({ error: `embedding_service_${upstream.status}` }),
        { status: 502, headers },
      );
    }

    const payload = await upstream.json() as {
      model?: string;
      dimension?: number;
      vectors?: number[][];
    };
    const vector = payload.vectors?.[0];
    if (!Array.isArray(vector) || vector.length === 0) {
      return new Response(JSON.stringify({ error: "empty_embedding" }), { status: 502, headers });
    }

    // Fail closed: dimension, finiteness and zero-norm are all validated before
    // the vector is returned. An invalid vector must never reach pgvector.
    const expectedDim = Number(Deno.env.get("EMBEDDING_DIM")) || 1024;
    if (vector.length !== expectedDim) {
      console.warn(`[embed-query] dimension mismatch: got ${vector.length}, expected ${expectedDim}`);
      return new Response(
        JSON.stringify({ error: "embedding_wrong_dimension", dimension: vector.length, expected: expectedDim }),
        { status: 502, headers },
      );
    }
    if (!vector.every((x: number) => Number.isFinite(x))) {
      return new Response(JSON.stringify({ error: "embedding_non_finite" }), { status: 502, headers });
    }
    let normSq = 0;
    for (let i = 0; i < vector.length; i++) normSq += vector[i] * vector[i];
    if (!(normSq > 1e-12)) {
      return new Response(JSON.stringify({ error: "embedding_zero_norm" }), { status: 502, headers });
    }

    return new Response(
      JSON.stringify({ vector, dimension: payload.dimension ?? vector.length, model: payload.model ?? null }),
      { status: 200, headers },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "embed-query failed" }),
      { status: 500, headers },
    );
  }
});

// Returns true if the configured EMBEDDING_ENDPOINT points at a host Supabase
// Edge cannot reach (loopback, private, link-local) in any common notation.
function isNonRoutableEndpoint(endpoint: string): boolean {
  const u = /^https?:\/\/([^/]+)/i.exec(endpoint);
  let host = u ? u[1] : endpoint;
  // strip port and brackets
  host = host.replace(/^\[/, "").replace(/\]$/, "").replace(/:\d+$/, "").toLowerCase();
  if (!host) return true;
  if (host === "localhost" || host.endsWith(".localhost") || host === "0.0.0.0") return true;
  // IPv6 loopback / unspecified / ULA fc00::/7 / link-local fe80::/7
  if (host === "::1" || host === "::" || /^f[cd][0-9a-f]{2}:/.test(host) || /^fe[89ab][0-9a-f]{2}:/.test(host)) return true;
  // IPv4 numeric forms (dotted, octal 0177.x, decimal 2130706433, hex 0x7f000001)
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(host)) {
    const parts = host.split(".").map((p) => {
      if (/^0[0-7]+$/.test(p)) return parseInt(p, 8);
      if (/^0x[0-9a-f]+$/i.test(p)) return parseInt(p, 16);
      return parseInt(p, 10);
    });
    if (parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;
    const [a, b] = parts;
    if (a === 127 || a === 0 || a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64/10
  }
  // Pure decimal integer form (e.g. 2130706433 == 127.0.0.1)
  if (/^\d+$/.test(host)) {
    const n = parseInt(host, 10);
    if (n === 0 || (n & 0xff) === 127) return true;
  }
  return false;
}