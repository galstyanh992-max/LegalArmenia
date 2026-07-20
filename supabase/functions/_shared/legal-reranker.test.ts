import { assertEquals, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { rerankRows, rerankLegalCandidates, type RerankCandidate, type RerankWeights } from "./legal-reranker.ts";

// Shared fixtures ----------------------------------------------------------------

const constitution: RerankCandidate = {
  chunk_id: "c1", document_id: "d1", title: "ՀՀ Սահմանադրություն",
  text_snippet: "Սահմանադրություն մարդու իրավունքներ ազատություն",
  source: "constitution", norm_status: "active", vector_score: 0.41, fts_score: 0.0008,
  score: 0.41, content_domain: "knowledge_base", citation_anchor: "հ. 5",
};
const code: RerankCandidate = {
  chunk_id: "c2", document_id: "d2", title: "Քաղաքացիական օրենսգիրք",
  text_snippet: "պայմանագրի խնդիրներ քաղաքացիական",
  source: "code", norm_status: "active", vector_score: 0.62, fts_score: 0.02,
  score: 0.62, content_domain: "knowledge_base", citation_anchor: "հ. 10",
};
const statute: RerankCandidate = {
  chunk_id: "c2b", document_id: "d2b", title: "Օրենք ընտրությունների մասին",
  text_snippet: "ընտրություններ օրենք",
  source: "statute", norm_status: "active", vector_score: 0.6, fts_score: 0.01,
  score: 0.6, content_domain: "knowledge_base",
};
const doctrine: RerankCandidate = {
  chunk_id: "c3", document_id: "d3", title: "Մեկնաբանություն (դոկտրինա)",
  text_snippet: "դոկտրինալ կարծիք մեկնաբանություն",
  source: "doctrine", norm_status: "unknown", vector_score: 0.7, fts_score: 0.05,
  score: 0.7, content_domain: "knowledge_base",
};
const codeDup: RerankCandidate = {
  chunk_id: "c4", document_id: "d2", title: "Քաղաքացիական օրենսգիրք (դուբլ)",
  text_snippet: "պայմանագրի խնդիրներ կրկնօրինակ",
  source: "code", norm_status: "active", vector_score: 0.6, fts_score: 0.02,
  score: 0.6, content_domain: "knowledge_base",
};
const echr: RerankCandidate = {
  chunk_id: "c5", document_id: "d5", title: "ECHR judgment",
  text_snippet: "european court human rights application no. 12345/2018",
  source: "echr", norm_status: "active", vector_score: 0.55, fts_score: 0.01,
  score: 0.55, content_domain: "practice", citation_anchor: "12345/2018",
};
const repealed: RerankCandidate = {
  chunk_id: "c6", document_id: "d6", title: "Հին օրենք",
  text_snippet: "հին նորմ պայմանագիր",
  source: "statute", norm_status: "repealed", vector_score: 0.8, fts_score: 0.08,
  score: 0.8, content_domain: "knowledge_base",
};
const notYet: RerankCandidate = {
  chunk_id: "c7", document_id: "d7", title: "Նոր օրենք ուժի մեջ չմտած",
  text_snippet: "պայմանագիր նորմ",
  source: "statute", norm_status: "active", vector_score: 0.66, fts_score: 0.03,
  score: 0.66, content_domain: "knowledge_base",
  effective_from: "2099-01-01",
};

const baseKB = [constitution, code, doctrine, codeDup];

// 1. authority ordering ----------------------------------------------------------

Deno.test("authority: constitution outranks doctrine despite lower vector score", async () => {
  const { rows } = await rerankRows(baseKB, { query: "մարդու իրավունքներ սահմանադրություն", disableCrossEncoder: true });
  const c1 = rows.findIndex((r) => r.chunk_id === "c1");
  const c3 = rows.findIndex((r) => r.chunk_id === "c3");
  if (c1 >= c3) throw new Error(`constitution ${c1} must precede doctrine ${c3}`);
});

Deno.test("authority: code outranks statute at equal relevance", async () => {
  const { rows } = await rerankRows([code, statute], { query: "պայմանագիր քաղաքացիական", disableCrossEncoder: true });
  assertEquals(rows[0].chunk_id, "c2");
});

Deno.test("authority: statute outranks doctrine", async () => {
  const { rows } = await rerankRows([doctrine, statute], { query: "ընտրություններ օրենք", disableCrossEncoder: true });
  assertEquals(rows[0].chunk_id, "c2b");
});

Deno.test("authority: unknown-source low confidence scores below known statute", async () => {
  const unk: RerankCandidate = { ...statute, chunk_id: "cu", document_id: "du", source: "" };
  const { rows } = await rerankRows([unk, statute], { query: "ընտրություններ", disableCrossEncoder: true });
  assertEquals(rows[0].chunk_id, "c2b");
});

// 2. identifier match ------------------------------------------------------------

Deno.test("identifier: exact article anchor boosts the matching chunk to first", async () => {
  const { rows } = await rerankRows(baseKB, { query: "քաղաքացիական օրենսգիրք հ. 10", disableCrossEncoder: true });
  assertEquals(rows[0].chunk_id, "c2");
});

Deno.test("identifier: ECHR application number matches citation_anchor", async () => {
  const { rows } = await rerankRows([code, echr], { query: "ECHR application no. 12345/2018", disableCrossEncoder: true });
  assertEquals(rows[0].chunk_id, "c5");
});

Deno.test("identifier: non-matching identifier yields no identifier boost (feature=0)", async () => {
  const { rows } = await rerankLegalCandidates([code], { query: "անկապ հարց հ. 999", disableCrossEncoder: true });
  assertEquals(rows[0].rerank_features.identifier, 0);
});

Deno.test("identifier: short anchor (<3) is ignored", async () => {
  const short: RerankCandidate = { ...code, chunk_id: "cs", citation_anchor: "հ" };
  const { rows } = await rerankLegalCandidates([short], { query: "հ. 10", disableCrossEncoder: true });
  assertEquals(rows[0].rerank_features.identifier, 0);
});

// 3. temporal scoring -------------------------------------------------------------

Deno.test("temporal: active scores above unknown scores above repealed", async () => {
  const a = await rerankLegalCandidates([constitution], { query: "x", disableCrossEncoder: true });
  const u = await rerankLegalCandidates([doctrine], { query: "x", disableCrossEncoder: true });
  const r = await rerankLegalCandidates([repealed], { query: "x", disableCrossEncoder: true });
  if (!(a.rows[0].rerank_features.temporal > u.rows[0].rerank_features.temporal)) throw new Error("active<=unknown");
  if (!(u.rows[0].rerank_features.temporal > r.rows[0].rerank_features.temporal)) throw new Error("unknown<=repealed");
});

Deno.test("temporal: not-yet-effective source is capped low against reference date", async () => {
  const { rows } = await rerankLegalCandidates([notYet], { query: "պայմանագիր", referenceDate: "2026-07-21", disableCrossEncoder: true });
  if (rows[0].rerank_features.temporal > 0.35) throw new Error("not-yet-effective temporal not capped: " + rows[0].rerank_features.temporal);
});

Deno.test("temporal: active source within effective window scores full", async () => {
  const active: RerankCandidate = { ...statute, effective_from: "2020-01-01", effective_to: "2030-12-31" };
  const { rows } = await rerankLegalCandidates([active], { query: "ընտրություններ", referenceDate: "2026-07-21", disableCrossEncoder: true });
  assertEquals(rows[0].rerank_features.temporal, 1.0);
});

Deno.test("temporal: expired source (effective_to in past) is capped low", async () => {
  const expired: RerankCandidate = { ...statute, effective_to: "2010-01-01" };
  const { rows } = await rerankLegalCandidates([expired], { query: "ընտրություններ", referenceDate: "2026-07-21", disableCrossEncoder: true });
  if (rows[0].rerank_features.temporal > 0.25) throw new Error("expired not capped: " + rows[0].rerank_features.temporal);
});

Deno.test("temporal: no reference date falls back to status-based score", async () => {
  const { rows } = await rerankLegalCandidates([repealed], { query: "պայմանագիր", referenceDate: null, disableCrossEncoder: true });
  assertEquals(rows[0].rerank_features.temporal, 0.2);
});

// 4. language matching -----------------------------------------------------------

Deno.test("language: Armenian query vs Armenian source scores high", async () => {
  const { rows } = await rerankLegalCandidates([constitution], { query: "մարդու իրավունքներ", disableCrossEncoder: true });
  if (rows[0].rerank_features.language < 0.9) throw new Error("hy-hy language score too low: " + rows[0].rerank_features.language);
});

Deno.test("language: English ECHR query prefers ECHR chunk", async () => {
  const { rows } = await rerankRows([code, echr], { query: "european court human rights violation", disableCrossEncoder: true });
  assertEquals(rows[0].chunk_id, "c5");
});

Deno.test("language: Russian query detected as ru", async () => {
  const { rows } = await rerankLegalCandidates([constitution], { query: "права человека конституция", disableCrossEncoder: true });
  // ru query against armenian-text chunk should not get the full hy match
  if (rows[0].rerank_features.language > 0.9) throw new Error("ru query wrongly scored as hy: " + rows[0].rerank_features.language);
});

// 5. numeric robustness ----------------------------------------------------------

Deno.test("features: all feature outputs clamped to [0,1]", async () => {
  const { rows } = await rerankLegalCandidates(baseKB, { query: "test", referenceDate: "2030-01-01", disableCrossEncoder: true });
  for (const r of rows) for (const v of Object.values(r.rerank_features)) {
    if (v < 0 || v > 1) throw new Error("feature out of [0,1]: " + v);
  }
});

Deno.test("features: composite rerank_score is in [0,1]", async () => {
  const { rows } = await rerankLegalCandidates(baseKB, { query: "պայմանագիր", disableCrossEncoder: true });
  for (const r of rows) if (r.rerank_score < 0 || r.rerank_score > 1) throw new Error("score out of range");
});

Deno.test("robustness: NaN vector_score does not poison the composite", async () => {
  const nanRow: RerankCandidate = { ...code, chunk_id: "cn", vector_score: NaN, fts_score: NaN };
  const { rows } = await rerankLegalCandidates([nanRow, doctrine], { query: "պայմանագիր", disableCrossEncoder: true });
  for (const r of rows) for (const v of Object.values(r.rerank_features)) {
    if (Number.isNaN(v) || !Number.isFinite(v)) throw new Error("NaN leaked into features: " + v);
  }
});

Deno.test("robustness: non-finite fts_score is rejected (keyword=0), never leaked", async () => {
  const inf: RerankCandidate = { ...code, chunk_id: "ci", fts_score: Infinity };
  const { rows } = await rerankLegalCandidates([inf], { query: "պայմանագիր", disableCrossEncoder: true });
  // Infinity is not finite -> keyword scorer fails closed to 0 (no poisoning).
  assertEquals(rows[0].rerank_features.keyword, 0);
  for (const v of Object.values(rows[0].rerank_features)) if (!Number.isFinite(v)) throw new Error("Infinity leaked");
});

// 6. weights ---------------------------------------------------------------------

Deno.test("weights: defaults sum to 1", async () => {
  const { metadata } = await rerankRows(baseKB, { query: "x", disableCrossEncoder: true });
  const w = metadata.weights;
  const sum = w.semantic + w.keyword + w.authority + w.temporal + w.identifier + w.language;
  if (Math.abs(sum - 1) > 1e-9) throw new Error("default weights not normalized: " + sum);
});

Deno.test("weights: override renormalizes to 1", async () => {
  const { metadata } = await rerankRows(baseKB, { query: "x", disableCrossEncoder: true, weights: { semantic: 10, keyword: 0, authority: 0, temporal: 0, identifier: 0, language: 0 } });
  const w = metadata.weights;
  const sum = w.semantic + w.keyword + w.authority + w.temporal + w.identifier + w.language;
  if (Math.abs(sum - 1) > 1e-9) throw new Error("override not normalized: " + sum);
  if (Math.abs(w.semantic - 1) > 1e-9) throw new Error("semantic should dominate after renorm");
});

Deno.test("weights: all-zero override falls back to defaults", async () => {
  const { metadata } = await rerankRows(baseKB, { query: "x", disableCrossEncoder: true, weights: { semantic: 0, keyword: 0, authority: 0, temporal: 0, identifier: 0, language: 0 } });
  const sum = Object.values(metadata.weights as RerankWeights).reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 1) > 1e-9) throw new Error("all-zero did not fall back: " + sum);
});

Deno.test("weights: negative override value is ignored", async () => {
  const { metadata } = await rerankRows(baseKB, { query: "x", disableCrossEncoder: true, weights: { semantic: -5 } });
  if (metadata.weights.semantic < 0) throw new Error("negative weight accepted");
});

// 7. diversification -------------------------------------------------------------

Deno.test("diversification: maxPerDocument caps repeats of the same document", async () => {
  const { rows, metadata } = await rerankRows([code, codeDup], { query: "պայմանագիր", disableCrossEncoder: true, maxPerDocument: 1 });
  const d2 = rows.filter((r) => r.document_id === "d2").length;
  assertEquals(d2, 1);
  assertEquals(metadata.diversification.max_per_document, 1);
});

Deno.test("diversification: dedup removes near-identical passages", async () => {
  const dupText: RerankCandidate = { ...code, chunk_id: "cdup", document_id: "dX", text_snippet: "պայմանագրի խնդիրներ քաղաքացիական" };
  const { rows, metadata } = await rerankRows([code, dupText], { query: "պայմանագիր", disableCrossEncoder: true, dedup: true });
  assertEquals(rows.length, 1);
  assertNotEquals(metadata.diversification.removed_duplicates, 0);
});

Deno.test("diversification: dedup disabled keeps near-identical passages", async () => {
  const dupText: RerankCandidate = { ...code, chunk_id: "cdup", document_id: "dX", text_snippet: "պայմանագրի խնդիրներ քաղաքացիական" };
  const { rows } = await rerankRows([code, dupText], { query: "պայմանագիր", disableCrossEncoder: true, dedup: false });
  assertEquals(rows.length, 2);
});

Deno.test("diversification: limit caps the output count", async () => {
  const many = Array.from({ length: 20 }, (_, i) => ({ ...code, chunk_id: "m" + i, document_id: "dd" + i, text_snippet: "պայմանագիր նորմ " + i }));
  const { rows } = await rerankRows(many, { query: "պայմանագիր", disableCrossEncoder: true, limit: 5 });
  assertEquals(rows.length, 5);
});

// 8. determinism & metadata ------------------------------------------------------

Deno.test("determinism: same input yields identical order across runs", async () => {
  const a = await rerankRows(baseKB, { query: "պայմանագիր քաղաքացիական", disableCrossEncoder: true });
  const b = await rerankRows(baseKB, { query: "պայմանագիր քաղաքացիական", disableCrossEncoder: true });
  assertEquals(a.rows.map((r) => r.chunk_id), b.rows.map((r) => r.chunk_id));
});

Deno.test("metadata: deterministic mode + model reported when cross-encoder disabled", async () => {
  const { metadata } = await rerankRows(baseKB, { query: "x", disableCrossEncoder: true });
  assertEquals(metadata.rerank_ok, true);
  assertEquals(metadata.rerank_mode, "deterministic_legal_v1");
  assertEquals(metadata.reranker_model, "deterministic-legal-v1");
  assertEquals(metadata.endpoint_used, false);
});

Deno.test("metadata: candidates_in/out counts are correct", async () => {
  const { metadata } = await rerankRows(baseKB, { query: "պայմանագիր", disableCrossEncoder: true, limit: 2 });
  assertEquals(metadata.candidates_in, 4);
  assertEquals(metadata.candidates_out, 2);
});

Deno.test("edge: empty candidate list returns empty with ok metadata", async () => {
  const { rows, metadata } = await rerankRows([], { query: "x", disableCrossEncoder: true });
  assertEquals(rows.length, 0);
  assertEquals(metadata.rerank_ok, true);
  assertEquals(metadata.candidates_in, 0);
});

Deno.test("edge: single candidate is returned unchanged in order", async () => {
  const { rows } = await rerankRows([code], { query: "պայմանագիր", disableCrossEncoder: true });
  assertEquals(rows.length, 1);
  assertEquals(rows[0].chunk_id, "c2");
});

Deno.test("ordering: semantic-only weights rank by vector_score when others zero", async () => {
  const { rows } = await rerankRows([constitution, doctrine], { query: "x", disableCrossEncoder: true, weights: { semantic: 1, keyword: 0, authority: 0, temporal: 0, identifier: 0, language: 0 } });
  // doctrine has higher vector_score (0.7 > 0.41) so it ranks first under pure semantic
  assertEquals(rows[0].chunk_id, "c3");
});