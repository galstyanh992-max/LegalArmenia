// =============================================================================
// V3 SHADOW MODE (Stage B) ? unit tests.
// Runs without network or secrets via the injected rpcCall hook.
// =============================================================================
import { describe, it } from "jsr:@std/testing@0.225/bdd";
import { assertEquals, assert, assertNotEquals } from "jsr:@std/assert@0.225";

import { runV3Shadow, readV3ShadowFlags, type V3ShadowInput } from "../_shared/v3-shadow.ts";

const baseInput = (overrides: Partial<V3ShadowInput> & { rpcCall?: V3ShadowInput["rpcCall"] } = {}): V3ShadowInput => ({
  supabaseUrl: "https://example.supabase.co",
  serviceRoleKey: "test-key-not-real",
  requestId: "req-shadow-001",
  query: "??????? ????????? ?????? 105",
  embedding: null,
  contentDomain: null,
  statusScope: "current",
  effectiveAt: null,
  limit: 10,
  annLimit: 100,
  ftsLimit: 50,
  primaryChunkIds: ["c1", "c2", "c3", "c4", "c5", "c6", "c7", "c8", "c9", "c10"],
  primaryRoute: "search_legal_corpus_metric",
  ...overrides,
});

describe("V3 shadow flags", () => {
  it("defaults to OFF and not primary with 0% traffic", () => {
    const flags = readV3ShadowFlags();
    // Defaults when env unset (other tests may set env, so only assert the safe defaults
    // are the documented Stage A state when the variables are empty).
    Deno.env.delete("LEGAL_SEARCH_V3_SHADOW");
    Deno.env.delete("LEGAL_SEARCH_V3_PRIMARY");
    Deno.env.delete("LEGAL_SEARCH_V3_TRAFFIC_PERCENT");
    Deno.env.delete("LEGAL_SEARCH_PRIMARY");
    const f = readV3ShadowFlags();
    assertEquals(f.shadowEnabled, false);
    assertEquals(f.v3Primary, false);
    assertEquals(f.trafficPercent, 0);
    assertEquals(f.primary, "metric");
  });

  it("clamps traffic percent to 0..100", () => {
    Deno.env.set("LEGAL_SEARCH_V3_TRAFFIC_PERCENT", "250");
    const f = readV3ShadowFlags();
    assertEquals(f.trafficPercent, 100);
    Deno.env.set("LEGAL_SEARCH_V3_TRAFFIC_PERCENT", "-5");
    assertEquals(readV3ShadowFlags().trafficPercent, 0);
    Deno.env.delete("LEGAL_SEARCH_V3_TRAFFIC_PERCENT");
  });
});

describe("V3 shadow runV3Shadow", () => {
  it("is skipped when shadow disabled (no RPC call)", async () => {
    Deno.env.delete("LEGAL_SEARCH_V3_SHADOW");
    let called = false;
    const t = await runV3Shadow(baseInput({
      rpcCall: () => { called = true; return Promise.resolve({ data: [], error: null }); },
    }));
    assertEquals(t.status, "skipped");
    assertEquals(called, false);
    assertEquals(t.shadow_enabled, false);
  });

  it("is skipped when enabled but traffic percent is 0", async () => {
    Deno.env.set("LEGAL_SEARCH_V3_SHADOW", "true");
    Deno.env.set("LEGAL_SEARCH_V3_TRAFFIC_PERCENT", "0");
    let called = false;
    const t = await runV3Shadow(baseInput({
      rpcCall: () => { called = true; return Promise.resolve({ data: [], error: null }); },
    }));
    assertEquals(t.status, "skipped");
    assertEquals(t.sampled, false);
    assertEquals(called, false);
    Deno.env.delete("LEGAL_SEARCH_V3_SHADOW");
    Deno.env.delete("LEGAL_SEARCH_V3_TRAFFIC_PERCENT");
  });

  it("refuses to promote V3 to primary even if flag misconfigured", async () => {
    Deno.env.set("LEGAL_SEARCH_V3_SHADOW", "true");
    Deno.env.set("LEGAL_SEARCH_V3_PRIMARY", "true");
    Deno.env.set("LEGAL_SEARCH_V3_TRAFFIC_PERCENT", "100");
    let called = false;
    const t = await runV3Shadow(baseInput({
      rpcCall: () => { called = true; return Promise.resolve({ data: [], error: null }); },
    }));
    // v3_primary guard short-circuits the shadow path.
    assertEquals(t.status, "skipped");
    assertEquals(called, false);
    Deno.env.delete("LEGAL_SEARCH_V3_SHADOW");
    Deno.env.delete("LEGAL_SEARCH_V3_PRIMARY");
    Deno.env.delete("LEGAL_SEARCH_V3_TRAFFIC_PERCENT");
  });

  it("computes overlap and telemetry on a successful shadow run", async () => {
    Deno.env.set("LEGAL_SEARCH_V3_SHADOW", "true");
    Deno.env.set("LEGAL_SEARCH_V3_TRAFFIC_PERCENT", "100");
    const v3Rows = [
      { chunk_id: "c2", score: 0.9 },
      { chunk_id: "c1", score: 0.8 },
      { chunk_id: "cX", score: 0.7 },
      { chunk_id: "c3", score: 0.6 },
      { chunk_id: "cY", score: 0.5 },
    ];
    const t = await runV3Shadow(baseInput({
      rpcCall: () => Promise.resolve({ data: v3Rows, error: null }),
    }));
    assertEquals(t.status, "ok");
    assertEquals(t.v3_result_count, 5);
    // primary top5 = [c1,c2,c3,c4,c5]; v3 top5 = [c2,c1,cX,c3,cY] -> overlap {c1,c2,c3} = 3
    assertEquals(t.overlap_at_5, 3);
    assertEquals(t.v3_error_class, null);
    assert(typeof t.latency_ms === "number");
    Deno.env.delete("LEGAL_SEARCH_V3_SHADOW");
    Deno.env.delete("LEGAL_SEARCH_V3_TRAFFIC_PERCENT");
  });

  it("classifies RPC errors and never throws into the caller", async () => {
    Deno.env.set("LEGAL_SEARCH_V3_SHADOW", "true");
    Deno.env.set("LEGAL_SEARCH_V3_TRAFFIC_PERCENT", "100");
    const t = await runV3Shadow(baseInput({
      rpcCall: () => Promise.resolve({ data: null, error: { message: "permission denied: 42501" } }),
    }));
    assertEquals(t.status, "error");
    assertEquals(t.v3_error_class, "SHADOW_PERMISSION");
    Deno.env.delete("LEGAL_SEARCH_V3_SHADOW");
    Deno.env.delete("LEGAL_SEARCH_V3_TRAFFIC_PERCENT");
  });

  it("records timeout when the RPC exceeds the hard timeout", async () => {
    Deno.env.set("LEGAL_SEARCH_V3_SHADOW", "true");
    Deno.env.set("LEGAL_SEARCH_V3_TRAFFIC_PERCENT", "100");
    // The delayed RPC must be cancellable so it doesn't leak a timer past the test.
    let timer: number | undefined;
    const t = await runV3Shadow(baseInput({
      timeoutMs: 200,
      rpcCall: () => new Promise((resolve) => { timer = setTimeout(() => resolve({ data: [], error: null }), 1500) as unknown as number; }),
    }));
    if (timer !== undefined) clearTimeout(timer);
    assertEquals(t.status, "timeout");
    assertEquals(t.v3_error_class, "SHADOW_TIMEOUT");
    Deno.env.delete("LEGAL_SEARCH_V3_SHADOW");
    Deno.env.delete("LEGAL_SEARCH_V3_TRAFFIC_PERCENT");
  });

  it("telemetry never carries tokens, keys, or query text", async () => {
    Deno.env.set("LEGAL_SEARCH_V3_SHADOW", "true");
    Deno.env.set("LEGAL_SEARCH_V3_TRAFFIC_PERCENT", "100");
    const t = await runV3Shadow(baseInput({
      rpcCall: () => Promise.resolve({ data: [{ chunk_id: "c1" }], error: null }),
    }));
    const serialized = JSON.stringify(t);
    assert(!serialized.includes("test-key-not-real"), "telemetry must not contain the service role key");
    assert(!serialized.includes("???????"), "telemetry must not contain query text");
    assert(!serialized.includes("access_token"), "telemetry must not contain token fields");
    Deno.env.delete("LEGAL_SEARCH_V3_SHADOW");
    Deno.env.delete("LEGAL_SEARCH_V3_TRAFFIC_PERCENT");
  });
});