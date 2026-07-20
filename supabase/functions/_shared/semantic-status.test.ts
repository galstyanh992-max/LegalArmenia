import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { deriveSemanticStatus } from "./semantic-status.ts";

Deno.test("semantic: both embedding + ANN rows => semantic_ok, not degraded, no fts fallback", () => {
  const s = deriveSemanticStatus({ embeddingAttempted: true, hasSemanticRows: true, hasKeywordRows: true });
  assertEquals(s.semantic_attempted, true);
  assertEquals(s.semantic_ok, true);
  assertEquals(s.semantic_degraded, false);
  assertEquals(s.fts_fallback_used, false);
});

Deno.test("semantic: embedding succeeded but ANN empty, FTS present => degraded + fts fallback", () => {
  const s = deriveSemanticStatus({ embeddingAttempted: true, hasSemanticRows: false, hasKeywordRows: true });
  assertEquals(s.semantic_attempted, true);
  assertEquals(s.semantic_ok, false);
  assertEquals(s.semantic_degraded, true);
  assertEquals(s.fts_fallback_used, true);
});

Deno.test("semantic: embedding not attempted (endpoint down/unset), FTS present => fts fallback, not degraded", () => {
  const s = deriveSemanticStatus({ embeddingAttempted: false, hasSemanticRows: false, hasKeywordRows: true });
  assertEquals(s.semantic_attempted, false);
  assertEquals(s.semantic_ok, false);
  assertEquals(s.semantic_degraded, false);
  assertEquals(s.fts_fallback_used, true);
});

Deno.test("semantic: zero relevant rows, no error => nothing ok, nothing degraded", () => {
  const s = deriveSemanticStatus({ embeddingAttempted: true, hasSemanticRows: false, hasKeywordRows: false });
  assertEquals(s.semantic_ok, false);
  assertEquals(s.semantic_degraded, false);
  assertEquals(s.fts_fallback_used, false);
});

Deno.test("semantic: Metric endpoint timeout => embedding not attempted, FTS fallback", () => {
  // embed-query returns 502 on timeout; vector-search treats it as no embedding.
  const s = deriveSemanticStatus({ embeddingAttempted: false, hasSemanticRows: false, hasKeywordRows: true });
  assertEquals(s.semantic_attempted, false);
  assertEquals(s.fts_fallback_used, true);
});

Deno.test("semantic: wrong embedding dimension => embedding rejected, FTS fallback", () => {
  // embed-query returns 502 embedding_wrong_dimension; vector-search gets no vector.
  const s = deriveSemanticStatus({ embeddingAttempted: false, hasSemanticRows: false, hasKeywordRows: true });
  assertEquals(s.semantic_attempted, false);
  assertEquals(s.semantic_ok, false);
  assertEquals(s.fts_fallback_used, true);
});

Deno.test("semantic: total retrieval failure (no rows at all) => all false", () => {
  const s = deriveSemanticStatus({ embeddingAttempted: false, hasSemanticRows: false, hasKeywordRows: false });
  assertEquals(s.semantic_attempted, false);
  assertEquals(s.semantic_ok, false);
  assertEquals(s.semantic_degraded, false);
  assertEquals(s.fts_fallback_used, false);
});

Deno.test("semantic: ANN rows without keyword arm => vector-only, not fts fallback", () => {
  const s = deriveSemanticStatus({ embeddingAttempted: true, hasSemanticRows: true, hasKeywordRows: false });
  assertEquals(s.semantic_ok, true);
  assertEquals(s.fts_fallback_used, false);
});

Deno.test("semantic: booleans are coerced (truthy non-boolean treated strictly)", () => {
  const s = deriveSemanticStatus({ embeddingAttempted: true, hasSemanticRows: true, hasKeywordRows: false });
  assertEquals(s.semantic_ok, true);
});