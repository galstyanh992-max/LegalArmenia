import type { MetricCorpusRow } from "./metric-search.ts";
import {
  buildTrustedCitationMetadata,
  formatCanonicalCitation,
  type StructuredCitation,
} from "./legal-citation-metadata.ts";

export interface CitationSpan {
  primaryChunkId: string;
  chunkIds: string[];
  displayText: string;
  citation: StructuredCitation;
  virtual: boolean;
}

function chunkIndex(row: MetricCorpusRow): number | null {
  const value = Number(row.citation_metadata?.chunk_index);
  return Number.isInteger(value) && value >= 0 ? value : null;
}

export function selectCitationSpan(
  primary: MetricCorpusRow,
  candidates: MetricCorpusRow[],
): CitationSpan {
  const metadata = buildTrustedCitationMetadata(primary);
  const primaryIndex = chunkIndex(primary);
  const adjacent = primaryIndex == null || !metadata.provisionKey
    ? []
    : candidates.filter((candidate) => {
      if (candidate.document_id !== primary.document_id) return false;
      const candidateMetadata = buildTrustedCitationMetadata(candidate);
      const index = chunkIndex(candidate);
      return candidateMetadata.provisionKey === metadata.provisionKey && index != null &&
        Math.abs(index - primaryIndex) === 1;
    }).sort((a, b) => (chunkIndex(a) ?? 0) - (chunkIndex(b) ?? 0));
  const selected = [primary, ...adjacent].sort((a, b) =>
    (chunkIndex(a) ?? primaryIndex ?? 0) - (chunkIndex(b) ?? primaryIndex ?? 0)
  );
  return {
    primaryChunkId: primary.chunk_id,
    chunkIds: selected.map((row) => row.chunk_id),
    displayText: selected.map((row) => row.chunk_text).join("\n"),
    citation: formatCanonicalCitation(metadata, primary.chunk_id),
    virtual: selected.length > 1,
  };
}
