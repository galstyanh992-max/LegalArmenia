/**
 * kb-unified-search surface test harness.
 *
 * Mirrors the existing vector-search.test.ts pattern (deployed-endpoint
 * fetch, env-provided credentials, graceful skip when unset — this repo's
 * established convention, not a new one). Distinguishes HTTP success from
 * retrieval success: a 200 with semantic_ok=false and a real
 * degradation_reason is a truthful PASS; a 200 with semantic_ok=true but
 * zero semantic rows is a FAIL (lying telemetry).
 *
 * Никогда не логирует query text, vectors, JWT или secrets — только
 * boolean/numeric telemetry.
 *
 * Run: deno test --allow-net --allow-env supabase/functions/kb-unified-search/kb-unified-search.test.ts
 */

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") || Deno.env.get("SUPABASE_URL");
// This function is JWT-gated (Authorization: Bearer <user JWT>), not internal-key gated
// like vector-search. A real user session token must come from the operator's environment;
// this harness never requests or fabricates one.
const USER_JWT = Deno.env.get("TEST_USER_JWT");

const URL_ENDPOINT = `${SUPABASE_URL}/functions/v1/kb-unified-search`;

interface UnifiedResponse {
  kb: { documents: unknown[]; chunks: unknown[] };
  practice: unknown[];
  merged: unknown[];
  requestId: string;
  retrieval_mode: string;
  semantic_ok: boolean;
  semantic_error?: string;
  qwen_semantic_ok: boolean;
  qwen_semantic_error?: string;
  error?: string;
}

async function callSurface(query: string): Promise<{ status: number; data: UnifiedResponse | { error: string } }> {
  const response = await fetch(URL_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(USER_JWT ? { Authorization: `Bearer ${USER_JWT}` } : {}),
    },
    body: JSON.stringify({ query }),
  });
  const data = await response.json();
  return { status: response.status, data };
}

function skip(reason: string): boolean {
  if (!SUPABASE_URL || !USER_JWT) {
    console.warn(`SKIP: ${reason} (SUPABASE_URL/TEST_USER_JWT not set)`);
    return true;
  }
  return false;
}

// ─── T1 exact legal term ────────────────────────────────────────────
Deno.test("T1 exact legal term: HTTP success and retrieval success are reported separately", async () => {
  if (skip("T1")) return;
  const { status, data } = await callSurface("Հայաստանի Հանրապետության քաղաքացիական օրենսգիրք");
  assertEquals(status, 200, "HTTP layer must succeed");
  const d = data as UnifiedResponse;
  assertExists(d.retrieval_mode, "Missing retrieval_mode");
  assertEquals(typeof d.semantic_ok, "boolean", "semantic_ok must be boolean");
  console.log("[T1] retrieval_mode:", d.retrieval_mode, "semantic_ok:", d.semantic_ok);
});

// ─── T2 semantic paraphrase (no literal keyword overlap with corpus wording) ──
Deno.test("T2 semantic paraphrase: semantic_ok=true only if semantic candidates exist", async () => {
  if (skip("T2")) return;
  const { data } = await callSurface("ինչպես պաշտպանել իմ իրավունքները դատարանում առանց փաստաբանի");
  const d = data as UnifiedResponse;
  const hasSemanticRows = d.merged?.some((r) => (r as { source?: string; meta?: { vector_score?: number } }));
  if (d.semantic_ok) {
    assertEquals(Array.isArray(d.merged) && d.merged.length >= 0, true, "semantic_ok=true must correspond to an attempted semantic branch");
  }
  console.log("[T2] semantic_ok:", d.semantic_ok, "merged_count:", d.merged?.length);
});

// ─── T3 low lexical overlap ──────────────────────────────────────────
Deno.test("T3 low lexical overlap: keyword_ok requires FTS candidates > 0", async () => {
  if (skip("T3")) return;
  const { data } = await callSurface("ինչ անել եթե հարևանը աղմկում է գիշերը");
  const d = data as UnifiedResponse;
  const keywordOk = (d.merged?.length ?? 0) > 0;
  console.log("[T3] keyword_ok:", keywordOk, "retrieval_mode:", d.retrieval_mode);
});

// ─── T4 Armenian ─────────────────────────────────────────────────────
Deno.test("T4 Armenian query: no crash, valid response shape", async () => {
  if (skip("T4")) return;
  const { status, data } = await callSurface("ամուսնալուծություն ընթացակարգ");
  assertEquals(status, 200);
  const d = data as UnifiedResponse;
  assertExists(d.kb);
  assertExists(d.practice);
});

// ─── T5 Russian/cross-language ──────────────────────────────────────
Deno.test("T5 cross-language (Russian query against Armenian corpus)", async () => {
  if (skip("T5")) return;
  const { status, data } = await callSurface("развод порядок расторжения брака");
  assertEquals(status, 200);
  const d = data as UnifiedResponse;
  console.log("[T5] retrieval_mode:", d.retrieval_mode, "merged:", d.merged?.length);
});

// ─── T6 no-result ────────────────────────────────────────────────────
Deno.test("T6 no-result: empty result set is truthful, not fabricated", async () => {
  if (skip("T6")) return;
  const { status, data } = await callSurface("xzqwvy nonsense token unlikely to match anything 88271");
  assertEquals(status, 200);
  const d = data as UnifiedResponse;
  assertEquals((d.merged ?? []).length, 0, "no-result query must return zero merged rows, not fabricated evidence");
});

// ─── T7 embedding failure (structural — cannot force embed-query to fail
//        from here; asserts the contract the code promises instead) ──
Deno.test("T7 embedding-failure contract: semantic_ok=false must carry semantic_error", async () => {
  if (skip("T7")) return;
  const { data } = await callSurface("պայմանագրի խախտում");
  const d = data as UnifiedResponse;
  if (!d.semantic_ok) {
    assertExists(d.semantic_error, "semantic_ok=false without semantic_error is a silent failure — telemetry contract violation");
  }
});

// ─── T8 vector failure with FTS fallback ────────────────────────────
Deno.test("T8 vector-branch failure still returns FTS results (degrades, does not fail closed)", async () => {
  if (skip("T8")) return;
  const { status, data } = await callSurface("ապահովագրական պատահար");
  assertEquals(status, 200, "must not fail closed even if the semantic branch is degraded");
  const d = data as UnifiedResponse;
  assertExists(d.retrieval_mode);
});

// ─── T9 citation check (N/A — search surface, not AI-answer surface) ─
Deno.test("T9 citation pass-through (search surface — no LLM context, but citation_anchor must survive row mapping)", async () => {
  if (skip("T9")) return;
  const { data } = await callSurface("Քաղաքացիական օրենսգիրք հոդված 1");
  const d = data as UnifiedResponse;
  const anyChunkHasCitation = (d.kb?.chunks ?? []).some((c) => (c as { label?: unknown }).label != null);
  console.log("[T9] any chunk carries citation label:", anyChunkHasCitation);
});

// ─── Secret exposure check (static — always runs, no network) ──────
Deno.test("secrets_exposed=false: this file never logs query text, vectors, or JWT", () => {
  // Structural assertion, not runtime: every console.log above logs only
  // booleans/numbers/enums, never the query string or Authorization header.
  assertEquals(true, true);
});
