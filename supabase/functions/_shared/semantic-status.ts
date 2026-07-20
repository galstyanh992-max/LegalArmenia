// =============================================================================
// SEMANTIC STATUS CONTRACT — pure derivation of retrieval-layer status flags.
//
// Why: "semantic_ok" alone conflates several distinct outcomes that an audit
// and on-call must be able to tell apart:
//   * the query embedding was attempted at all;
//   * the embedding succeeded AND the ANN arm returned relevant rows;
//   * the embedding succeeded but the ANN arm was empty, so we fell back to FTS;
//   * the embedding was never available, so only FTS/BM25 produced rows.
//
// Collapsing these into one boolean is exactly how a dead embedding endpoint
// hid behind a "semantic retrieval OK" PASS label. This helper separates them
// so telemetry, the live audit, and the legal-chat runRAG can report the real
// state. It is pure and deterministic so it can be unit-tested directly.
// =============================================================================

export interface SemanticStatusInput {
  /** True iff the query embedding was attempted (embedding endpoint configured + called). */
  embeddingAttempted: boolean;
  /** True iff the embedding was produced AND the ANN/vector arm returned rows above threshold. */
  hasSemanticRows: boolean;
  /** True iff the FTS/BM25/identifier arm returned rows. */
  hasKeywordRows: boolean;
}

export interface SemanticStatus {
  /** We tried to embed the query (endpoint configured and called). */
  semantic_attempted: boolean;
  /** Embedding succeeded AND the vector arm delivered relevant rows. */
  semantic_ok: boolean;
  /** Embedding succeeded but the vector arm was empty; results came from FTS. */
  semantic_degraded: boolean;
  /** Results were produced by the FTS/BM25 arm because the semantic arm did not deliver. */
  fts_fallback_used: boolean;
}

export function deriveSemanticStatus(input: SemanticStatusInput): SemanticStatus {
  const embeddingAttempted = input.embeddingAttempted === true;
  const hasSemanticRows = input.hasSemanticRows === true;
  const hasKeywordRows = input.hasKeywordRows === true;
  const semantic_ok = embeddingAttempted && hasSemanticRows;
  const semantic_degraded = embeddingAttempted && !hasSemanticRows && hasKeywordRows;
  const fts_fallback_used = hasKeywordRows && !semantic_ok;
  return {
    semantic_attempted: embeddingAttempted,
    semantic_ok,
    semantic_degraded,
    fts_fallback_used,
  };
}