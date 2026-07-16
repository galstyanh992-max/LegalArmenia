import type { MetricCorpusRow } from "./metric-search.ts";
import { buildTrustedCitationMetadata } from "./legal-citation-metadata.ts";
import { parseLegalProvision } from "./legal-provision-parser.ts";

export type ProvisionMatchType =
  | "EXACT_PROVISION"
  | "EXACT_ARTICLE_PART"
  | "EXACT_ARTICLE"
  | "EXACT_DOCUMENT_NUMBER"
  | "EXACT_CANONICAL_TITLE"
  | "NORMALIZED_TITLE"
  | "CASE_NUMBER"
  | "DATE"
  | "NONE";

export interface ProvisionLaneMatch {
  identifier_match_type: ProvisionMatchType;
  identifier_match_score: number;
  provision_key?: string;
  metadata_confidence: "high" | "medium" | "low";
}

function normalized(value: unknown): string {
  return String(value ?? "").normalize("NFKC").trim().toLocaleLowerCase()
    .replace(/[‐‑‒–—]/g, "-").replace(/\s+/g, " ");
}

function compact(value: unknown): string {
  return normalized(value).replace(/[^\p{L}\p{N}]+/gu, "");
}

function containsWhole(haystack: string, needle: string): boolean {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^\\p{L}\\p{N}])${escaped}(?=$|[^\\p{L}\\p{N}])`, "iu")
    .test(haystack);
}

function provisionMatches(
  query: ReturnType<typeof parseLegalProvision>,
  candidate: ReturnType<typeof buildTrustedCitationMetadata>,
): boolean {
  return Boolean(
    query.article && query.article === candidate.article &&
      (!query.part || query.part === candidate.part) &&
      (!query.point || query.point === candidate.point) &&
      (!query.subpoint || query.subpoint === candidate.subpoint),
  );
}

export function matchProvisionLane(
  queryText: string,
  row: MetricCorpusRow,
): ProvisionLaneMatch {
  const query = parseLegalProvision(queryText);
  const metadata = buildTrustedCitationMetadata(row);
  const base = {
    provision_key: metadata.provisionKey,
    metadata_confidence: metadata.metadataConfidence,
  };
  if (provisionMatches(query, metadata)) {
    if (query.point || query.subpoint) {
      return { ...base, identifier_match_type: "EXACT_PROVISION", identifier_match_score: 1 };
    }
    if (query.part) {
      return { ...base, identifier_match_type: "EXACT_ARTICLE_PART", identifier_match_score: 0.98 };
    }
    return { ...base, identifier_match_type: "EXACT_ARTICLE", identifier_match_score: 0.94 };
  }
  const q = compact(queryText);
  const canonicalId = normalized(
    row.citation_metadata?.arlis_doc_id ?? row.citation_metadata?.canonical_key,
  ).replace(/^arlis:/iu, "");
  if (canonicalId && containsWhole(normalized(queryText), canonicalId)) {
    return { ...base, identifier_match_type: "EXACT_DOCUMENT_NUMBER", identifier_match_score: 1 };
  }
  const documentNumber = normalized(metadata.documentNumber);
  if (documentNumber.length >= 2 && containsWhole(normalized(queryText), documentNumber)) {
    return { ...base, identifier_match_type: "EXACT_DOCUMENT_NUMBER", identifier_match_score: 0.92 };
  }
  const title = normalized(metadata.canonicalTitle);
  if (title && normalized(queryText) === title) {
    return { ...base, identifier_match_type: "EXACT_CANONICAL_TITLE", identifier_match_score: 0.9 };
  }
  const titleCompact = compact(title);
  if (titleCompact.length >= 12 && q.includes(titleCompact)) {
    return { ...base, identifier_match_type: "NORMALIZED_TITLE", identifier_match_score: 0.82 };
  }
  const caseNumber = normalized(row.citation_metadata?.case_number ?? row.citation_metadata?.decision_number);
  if (caseNumber && normalized(queryText).includes(caseNumber)) {
    return { ...base, identifier_match_type: "CASE_NUMBER", identifier_match_score: 0.78 };
  }
  const date = normalized(row.citation_metadata?.issued_date);
  if (date && normalized(queryText).includes(date)) {
    return { ...base, identifier_match_type: "DATE", identifier_match_score: 0.7 };
  }
  return { ...base, identifier_match_type: "NONE", identifier_match_score: 0 };
}

export function provisionLaneCandidates(
  query: string,
  rows: MetricCorpusRow[],
): Array<{ row: MetricCorpusRow; match: ProvisionLaneMatch }> {
  return rows.map((row) => ({ row, match: matchProvisionLane(query, row) }))
    .filter(({ match }) => match.identifier_match_type !== "NONE")
    .sort((a, b) =>
      b.match.identifier_match_score - a.match.identifier_match_score ||
      a.row.chunk_id.localeCompare(b.row.chunk_id)
    );
}
