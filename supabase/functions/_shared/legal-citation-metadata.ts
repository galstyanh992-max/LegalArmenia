import type { MetricCorpusRow } from "./metric-search.ts";
import { parseLegalProvision } from "./legal-provision-parser.ts";

export type MetadataConfidence = "high" | "medium" | "low";

export interface LegalCitationMetadata {
  documentId: string;
  documentVersionId?: string;
  canonicalTitle?: string;
  documentNumber?: string;
  article?: string;
  part?: string;
  point?: string;
  subpoint?: string;
  chapter?: string;
  section?: string;
  provisionKey?: string;
  canonicalCitation?: string;
  sourceUrl?: string;
  normStatus: "active" | "unknown" | "repealed";
  effectiveFrom?: string;
  effectiveTo?: string;
  authority?: string;
  metadataConfidence: MetadataConfidence;
  metadataSource: string[];
  parserVersion?: string;
}

function clean(value: unknown): string | undefined {
  const result = String(value ?? "").normalize("NFKC").trim();
  return result || undefined;
}

function status(value: string): LegalCitationMetadata["normStatus"] {
  return value === "active" || value === "repealed" ? value : "unknown";
}

function safeUrl(value: unknown): string | undefined {
  const candidate = clean(value);
  if (!candidate) return undefined;
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

function documentNumber(value: unknown): string | undefined {
  const candidate = clean(value);
  if (!candidate || !/\d/u.test(candidate)) return undefined;
  return candidate;
}

export function buildTrustedCitationMetadata(
  row: MetricCorpusRow,
): LegalCitationMetadata {
  const raw = row.citation_metadata ?? {};
  const structured = {
    article: clean(raw.article_number ?? raw.article),
    part: clean(raw.part_number ?? raw.part),
    point: clean(raw.point_number ?? raw.point),
    subpoint: clean(raw.subpoint_number ?? raw.subpoint),
    chapter: clean(raw.chapter_number ?? raw.chapter),
    section: clean(raw.section_number ?? raw.section),
  };
  const anchor = parseLegalProvision(row.citation_anchor ?? "", {
    trustedStructure: true,
  });
  const article = structured.article ?? (anchor.article || undefined);
  const part = structured.part ?? (anchor.part || undefined);
  const point = structured.point ?? (anchor.point || undefined);
  const subpoint = structured.subpoint ?? (anchor.subpoint || undefined);
  const chapter = structured.chapter ?? (anchor.chapter || undefined);
  const section = structured.section ?? (anchor.section || undefined);
  const provisionKey = [
    article && `article:${article}`,
    part && `part:${part}`,
    point && `point:${point}`,
    subpoint && `subpoint:${subpoint}`,
    chapter && `chapter:${chapter}`,
    section && `section:${section}`,
  ].filter(Boolean).join("|") || undefined;
  const title = clean(raw.canonical_title) ?? clean(row.title);
  const trustedDocumentNumber = documentNumber(raw.document_number);
  const sourceUrl = safeUrl(row.source_url ?? raw.source_url);
  const authority = clean(raw.authority);
  const sources = [
    "document_id",
    title && "structured_title",
    trustedDocumentNumber && "structured_document_number",
    provisionKey && (Object.values(structured).some(Boolean)
      ? "structured_provision"
      : "validated_citation_anchor"),
    sourceUrl && "validated_source_url",
    authority && "structured_authority",
  ].filter(Boolean) as string[];
  const confidence: MetadataConfidence = provisionKey || trustedDocumentNumber ||
      clean(raw.arlis_doc_id)
    ? "high"
    : title
    ? "medium"
    : "low";
  const meta: LegalCitationMetadata = {
    documentId: row.document_id,
    documentVersionId: clean(row.version_id),
    canonicalTitle: title,
    documentNumber: trustedDocumentNumber,
    article,
    part,
    point,
    subpoint,
    chapter,
    section,
    provisionKey,
    sourceUrl,
    normStatus: status(row.norm_status),
    effectiveFrom: clean(row.effective_from),
    effectiveTo: clean(row.effective_to),
    authority,
    metadataConfidence: confidence,
    metadataSource: sources,
    parserVersion: provisionKey ? "armenian-provision-parser-v2" : undefined,
  };
  meta.canonicalCitation = formatCanonicalCitation(meta).formatted;
  return meta;
}

export interface StructuredCitation {
  formatted: string;
  documentId: string;
  documentVersionId?: string;
  sourceUrl?: string;
  provisionKey?: string;
  metadataConfidence: MetadataConfidence;
  warning: string | null;
}

export function formatCanonicalCitation(
  metadata: LegalCitationMetadata,
  fallbackChunkId?: string,
): StructuredCitation {
  const fields = [
    metadata.canonicalTitle,
    metadata.documentNumber,
    metadata.article && `հոդված ${metadata.article}`,
    metadata.part && `մաս ${metadata.part}`,
    metadata.point && `կետ ${metadata.point}`,
    metadata.subpoint && `ենթակետ ${metadata.subpoint}`,
    metadata.section && `բաժին ${metadata.section}`,
    metadata.chapter && `գլուխ ${metadata.chapter}`,
  ].filter(Boolean);
  if (fields.length === 1 && fallbackChunkId) fields.push(`chunk ${fallbackChunkId}`);
  const warning = metadata.normStatus === "unknown"
    ? "UNCONFIRMED_STATUS"
    : metadata.normStatus === "repealed"
    ? "REPEALED_HISTORICAL"
    : null;
  return {
    formatted: `[${fields.join(", ")}]`,
    documentId: metadata.documentId,
    documentVersionId: metadata.documentVersionId,
    sourceUrl: metadata.sourceUrl,
    provisionKey: metadata.provisionKey,
    metadataConfidence: metadata.metadataConfidence,
    warning,
  };
}
