// =============================================================================
// Prompt 19.7 Phase 16: Deterministic Scorer V4 Tests
// =============================================================================
import { describe, it } from "jsr:@std/testing@0.225/bdd";
import { assertEquals, assert } from "jsr:@std/assert@0.225";

import { rankDeterministicV4, decideNoAnswerV4 } from "./deterministic-search-v4.ts";
import type { MetricCorpusRow } from "./metric-search.ts";

function makeRow(overrides: Partial<MetricCorpusRow> = {}): MetricCorpusRow {
  return {
    chunk_id: "chunk-001",
    document_id: "doc-001",
    version_id: "ver-001",
    chunk_text: "Sample legal text about Article 5 of the Armenian Constitution.",
    title: "Constitution of Armenia",
    source: "arlis",
    language: "hy",
    content_domain: "knowledge_base",
    norm_status: "active",
    effective_from: null,
    effective_to: null,
    status_scope: "current",
    status_eligible: true,
    status_reason_code: "CURRENT_ACTIVE",
    legal_status_warning: null,
    vector_similarity: 0.85,
    fts_rank: 1,
    identifier_match: 0,
    identifier_rank: null,
    ann_rank: 1,
    fts_rank_position: null,
    rrf_score: 0.5,
    duplicate_group: "dup-001",
    source_url: "http://www.arlis.am/DocumentView.aspx?DocID=123",
    citation_anchor: null,
    citation_metadata: {},
    ...overrides,
  } as unknown as MetricCorpusRow;
}

describe("rankDeterministicV4", () => {
  it("ranks eligible rows", () => {
    const rows = [makeRow(), makeRow({ chunk_id: "chunk-002", norm_status: "repealed" })];
    const result = rankDeterministicV4("test query", rows, {
      statusScope: "current",
      limit: 10,
    });
    assert(result.length > 0);
    assertEquals(result[0].row.chunk_id, "chunk-001");
  });

  it("filters out ineligible status", () => {
    const rows = [makeRow({ norm_status: "repealed" })];
    const result = rankDeterministicV4("test query", rows, {
      statusScope: "current",
      limit: 10,
    });
    assertEquals(result.length, 0);
  });

  it("includes V4-specific scores", () => {
    const rows = [makeRow()];
    const result = rankDeterministicV4("test query", rows, {
      statusScope: "current",
      limit: 10,
      pageMappingBoost: true,
      versionValidityGuard: true,
      authorityTaxonomyBoost: true,
      canonicalSourcePreference: true,
    });
    assertEquals(result.length, 1);
    assert(typeof result[0].page_mapping_score === "number");
    assert(typeof result[0].version_validity_score === "number");
    assert(typeof result[0].authority_score === "number");
    assert(typeof result[0].canonical_source_score === "number");
  });

  it("collapses duplicates", () => {
    const rows = [
      makeRow({ chunk_id: "c1", duplicate_group: "same" }),
      makeRow({ chunk_id: "c2", duplicate_group: "same" }),
    ];
    const result = rankDeterministicV4("test query", rows, {
      statusScope: "current",
      limit: 10,
      duplicateCollapse: true,
    });
    assertEquals(result.length, 1);
  });
});

describe("decideNoAnswerV4", () => {
  it("returns answerable when evidence is strong", () => {
    const rows = [{ row: makeRow(), final_score: 0.8, provision_match: { identifier_match_type: "NONE", identifier_match_score: 0, provision_key: "", metadata_confidence: "low" }, version_validity_score: 1, }] as any;
    const result = decideNoAnswerV4("test query", rows);
    assertEquals(result.answerable, true);
  });

  it("returns not answerable when no evidence", () => {
    const result = decideNoAnswerV4("test query", []);
    assertEquals(result.answerable, false);
    assert(result.reasons.includes("NO_ELIGIBLE_EVIDENCE"));
  });
});
