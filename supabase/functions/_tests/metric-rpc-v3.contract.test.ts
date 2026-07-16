// =============================================================================
// Prompt 19.7 Phase 15: Metric RPC V3 Contract Tests
// Verifies the V3 function signature and additive guarantees.
// =============================================================================
import { describe, it } from "jsr:@std/testing@0.225/bdd";
import { assertEquals, assert } from "jsr:@std/assert@0.225";

import { searchMetricCorpusV3 } from "../_shared/metric-search-v3.ts";

describe("searchMetricCorpusV3 contract", () => {
  it("exports a callable function", () => {
    assert(typeof searchMetricCorpusV3 === "function");
  });

  it("rejects empty query via RPC client mock", async () => {
    const mockClient = {
      rpc: (_fn: string, _params: Record<string, unknown>) =>
        Promise.resolve({
          data: [],
          error: { message: "METRIC_RPC_V3_QUERY_REQUIRED" },
        }),
    };
    try {
      await searchMetricCorpusV3(mockClient, {
        query: "",
        embedding: null,
        contentDomain: null,
        statusScope: "current",
        limit: 15,
        annLimit: 100,
        ftsLimit: 50,
      });
      assert(false, "should have thrown");
    } catch (e) {
      assert(String(e).includes("METRIC_RPC_V3_QUERY_REQUIRED"));
    }
  });

  it("accepts provisionQuery parameter", async () => {
    let capturedParams: Record<string, unknown> = {};
    const mockClient = {
      rpc: (_fn: string, params: Record<string, unknown>) => {
        capturedParams = params;
        return Promise.resolve({ data: [], error: null });
      },
    };
    await searchMetricCorpusV3(mockClient, {
      query: "test query",
      embedding: null,
      contentDomain: null,
      statusScope: "current",
      limit: 15,
      annLimit: 100,
      ftsLimit: 50,
      provisionQuery: "Article 5 Part 2",
    });
    assertEquals(capturedParams.p_provision_query, "Article 5 Part 2");
  });

  it("passes null provisionQuery when not provided", async () => {
    let capturedParams: Record<string, unknown> = {};
    const mockClient = {
      rpc: (_fn: string, params: Record<string, unknown>) => {
        capturedParams = params;
        return Promise.resolve({ data: [], error: null });
      },
    };
    await searchMetricCorpusV3(mockClient, {
      query: "test query",
      embedding: null,
      contentDomain: null,
      statusScope: "current",
      limit: 15,
      annLimit: 100,
      ftsLimit: 50,
    });
    assertEquals(capturedParams.p_provision_query, null);
  });
});
