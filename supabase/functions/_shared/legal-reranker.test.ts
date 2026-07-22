import { assertEquals, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { rerankRows, rerankLegalCandidates, type RerankCandidate } from "./legal-reranker.ts";

const baseKB: RerankCandidate[] = [
  { chunk_id: "c1", document_id: "d1", title: "ՀՀ Սահմանադրություն", text_snippet: "Սահմանադրություն մարդու իրավունքներ", source: "constitution", norm_status: "active", vector_score: 0.41, fts_score: 0.0008, score: 0.41, content_domain: "knowledge_base", citation_anchor: "հ. 5" },
  { chunk_id: "c2", document_id: "d2", title: "Քաղաքացիական օրենսգիրք", text_snippet: "պայմանագրի խնդիրներ", source: "code", norm_status: "active", vector_score: 0.62, fts_score: 0.02, score: 0.62, content_domain: "knowledge_base", citation_anchor: "հ. 10" },
  { chunk_id: "c3", document_id: "d3", title: "Մեկնաբանություն (դոկտրինա)", text_snippet: "դոկտրինալ կարծիք", source: "doctrine", norm_status: "unknown", vector_score: 0.7, fts_score: 0.05, score: 0.7, content_domain: "knowledge_base" },
  { chunk_id: "c4", document_id: "d2", title: "Քաղաքացիական օրենսգիրք (դուբլ)", text_snippet: "պայմանագրի խնդիրներ կրկնօրինակ", source: "code", norm_status: "active", vector_score: 0.6, fts_score: 0.02, score: 0.6, content_domain: "knowledge_base" },
];

Deno.test("reranker: constitution outranks doctrine even with lower vector score", async () => {
  const { rows, metadata } = await rerankRows(baseKB, { query: "մարդու իրավունքներ սահմանադրություն", referenceDate: null, limit: 4, disableCrossEncoder: true });
  assertEquals(metadata.rerank_ok, true);
  assertEquals(metadata.rerank_mode, "deterministic_legal_v1");
  // Constitution (c1) should beat doctrine (c3) despite c3 having higher vector_score.
  const c1Idx = rows.findIndex((r) => r.chunk_id === "c1");
  const c3Idx = rows.findIndex((r) => r.chunk_id === "c3");
  assertNotEquals(c1Idx, -1);
  assertNotEquals(c3Idx, -1);
  if (c1Idx >= c3Idx) {
    throw new Error(`Expected constitution before doctrine: c1=${c1Idx} c3=${c3Idx}`);
  }
});

Deno.test("reranker: identifier match boosts exact case/article", async () => {
  const { rows } = await rerankRows(baseKB, { query: "քաղաքացիական օրենսգիրք հ. 10", referenceDate: null, limit: 4, disableCrossEncoder: true });
  // The code chunk with citation_anchor հ. 10 (c2) should rank first.
  assertEquals(rows[0].chunk_id, "c2");
});

Deno.test("reranker: diversification caps per-document and dedups near-identical", async () => {
  const { rows, metadata } = await rerankRows(baseKB, { query: "պայմանագիր", referenceDate: null, limit: 10, maxPerDocument: 1, disableCrossEncoder: true });
  // d2 appears as c2 and c4; with maxPerDocument=1 only one survives.
  const d2Count = rows.filter((r) => r.document_id === "d2").length;
  assertEquals(d2Count, 1);
  assertEquals(metadata.diversification.max_per_document, 1);
  assertEquals(metadata.candidates_out, rows.length);
});

Deno.test("reranker: features are bounded in [0,1]", async () => {
  const { rows } = await rerankLegalCandidates(baseKB, { query: "test", referenceDate: "2030-01-01", disableCrossEncoder: true });
  for (const r of rows) {
    for (const v of Object.values(r.rerank_features)) {
      if (v < 0 || v > 1) throw new Error("feature out of [0,1]: " + v);
    }
    if (r.rerank_score < 0 || r.rerank_score > 1) throw new Error("score out of [0,1]");
  }
});

Deno.test("reranker: weights renormalize when overridden", async () => {
  const { metadata } = await rerankRows(baseKB, { query: "x", disableCrossEncoder: true, weights: { semantic: 10, keyword: 0, authority: 0, temporal: 0, identifier: 0, language: 0 } });
  const wsum = metadata.weights.semantic + metadata.weights.keyword + metadata.weights.authority + metadata.weights.temporal + metadata.weights.identifier + metadata.weights.language;
  if (Math.abs(wsum - 1) > 1e-6) throw new Error("weights not normalized: " + wsum);
});