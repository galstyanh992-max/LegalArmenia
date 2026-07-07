export const LEGAL_UNIT_CHUNK_VERSION = "legal_unit_v1";

const CHARS_PER_TOKEN = 4;
const TARGET_CHARS = 4500;
const MAX_CHARS = 7200;
const MIN_CONTEXT_CHARS = 280;

export type LegalUnitDocKind =
  | "legislation"
  | "court_practice"
  | "echr"
  | "unknown";

export interface LegalUnitDocumentInput {
  document_id: string;
  version_id: string;
  title?: string | null;
  text: string;
  language?: string | null;
  content_domain?: string | null;
  norm_status?: string | null;
  effective_from?: string | null;
  effective_to?: string | null;
  source_date?: string | null;
  source_url?: string | null;
  arlis_doc_id?: string | null;
  canonical_key?: string | null;
}

export interface LegalUnitChunk {
  chunk_key: string;
  source_document_id: string;
  document_id: string;
  version_id: string;
  legal_unit_id: string | null;
  legal_unit_type: string | null;
  legal_unit_number: string | null;
  parent_legal_unit_id: string | null;
  article_number: string | null;
  part_number: string | null;
  point_number: string | null;
  paragraph_number: string | null;
  text: string;
  token_count: number;
  page_from: number | null;
  page_to: number | null;
  char_start: number;
  char_end: number;
  language: string;
  language_code: string;
  content_domain: string;
  normalized_domain: string;
  norm_status: string;
  legal_status: string;
  effective_from: string | null;
  effective_to: string | null;
  source_date: string | null;
  source_url: string | null;
  citation_anchor: string | null;
  normalized_title: string | null;
  chunk_quality_flags: Record<string, boolean>;
  chunk_text_sha256: string;
  chunk_version: string;
}

interface Segment {
  start: number;
  end: number;
  label: string;
  type: string;
  number: string | null;
  parentId?: string | null;
  articleNumber?: string | null;
  partNumber?: string | null;
  pointNumber?: string | null;
  paragraphNumber?: string | null;
}

export interface ChunkQualitySummary {
  total_chunks: number;
  legal_unit_id_coverage: number;
  citation_anchor_coverage: number;
  effective_date_coverage: number;
  unknown_domain_count: number;
  mid_word_starts: number;
  duplicate_hashes: number;
  bad_chunk_samples: Array<
    Pick<
      LegalUnitChunk,
      "chunk_key" | "citation_anchor" | "chunk_quality_flags" | "text"
    >
  >;
}

export function estimateLegalUnitTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / CHARS_PER_TOKEN));
}

export function normalizeLegalTitle(
  title: string | null | undefined,
): string | null {
  const normalized = String(title ?? "").replace(/\s+/g, " ").trim();
  return normalized || null;
}

export function cleanLegalSourceText(raw: string): string {
  const lines = String(raw ?? "")
    .normalize("NFC")
    // eslint-disable-next-line no-control-regex -- intentional: strip NUL bytes from ingested legal source text
    .replace(/\u0000/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim());

  const frequencies = new Map<string, number>();
  for (const line of lines) {
    const key = normalizeNoiseLine(line);
    if (key.length >= 8) frequencies.set(key, (frequencies.get(key) ?? 0) + 1);
  }

  const cleaned: string[] = [];
  for (const line of lines) {
    const next = line
      .replace(/https?:\/\/\S+/gi, " ")
      .replace(/\bwww\.\S+/gi, " ")
      .replace(/^\s*\d{1,4}\s*\/\s*\d{1,4}\s*$/, " ")
      .replace(/^\s*\d{1,4}\s*\/\s*\d{1,4}\s+/, " ")
      .replace(/\s+\d{1,4}\s*\/\s*\d{1,4}\s*$/, " ")
      .replace(/\[(?:էջ|page)\s+\d+\]/gi, " ")
      .replace(/_{5,}/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!next) {
      cleaned.push("");
      continue;
    }

    const key = normalizeNoiseLine(next);
    const repeated = (frequencies.get(key) ?? 0) >= 3;
    const mostlyFormNoise = countChar(next, "_") > next.length * 0.2 ||
      countChar(next, "|") > 12;
    const amendmentIndexNoise = /(փոփ|լրաց)/i.test(next) &&
      (next.match(/\d{2}\.\d{2}\.\d{2,4}/g)?.length ?? 0) >= 3;
    const onlyPageNumber = /^\d{1,4}$/.test(next);
    if (repeated || mostlyFormNoise || amendmentIndexNoise || onlyPageNumber) {
      continue;
    }
    cleaned.push(next);
  }

  return cleaned.join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function classifyLegalDocumentDomain(
  input: LegalUnitDocumentInput,
  cleanedText = input.text,
): {
  kind: LegalUnitDocKind;
  content_domain: string;
  normalized_domain: string;
} {
  const title = `${input.title ?? ""} ${input.canonical_key ?? ""}`
    .toLowerCase();
  const sample = `${title}\n${cleanedText.slice(0, 4000)}`;
  if (isEchr(sample)) {
    return {
      kind: "echr",
      content_domain: "practice",
      normalized_domain: "echr",
    };
  }
  if (isCourtPractice(sample)) {
    return {
      kind: "court_practice",
      content_domain: "practice",
      normalized_domain: "court_practice",
    };
  }
  if (
    hasArmenianArticleMarkers(sample) ||
    /օրենք|օրենսգիրք|որոշում|հրաման/i.test(sample)
  ) {
    return {
      kind: "legislation",
      content_domain: "knowledge_base",
      normalized_domain: "armenian_legislation",
    };
  }
  return {
    kind: "unknown",
    content_domain: input.content_domain && input.content_domain !== "unknown"
      ? input.content_domain
      : "unknown",
    normalized_domain: "unknown",
  };
}

export async function chunkLegalDocument(
  input: LegalUnitDocumentInput,
): Promise<LegalUnitChunk[]> {
  const cleaned = cleanLegalSourceText(input.text);
  const title = normalizeLegalTitle(input.title) ?? inferTitle(cleaned) ??
    "Untitled legal source";
  const classification = classifyLegalDocumentDomain(input, cleaned);
  const base = { ...input, text: cleaned, title };

  let chunks: LegalUnitChunk[];
  if (classification.kind === "echr") {
    chunks = await chunkEchr(base, classification.normalized_domain);
  } else if (classification.kind === "court_practice") {
    chunks = await chunkCourtPractice(base, classification.normalized_domain);
  } else if (classification.kind === "legislation") {
    chunks = await chunkArmenianLegislation(
      base,
      classification.normalized_domain,
    );
  } else chunks = await chunkFallback(base, classification.normalized_domain);

  const hashCounts = new Map<string, number>();
  for (const chunk of chunks) {
    hashCounts.set(
      chunk.chunk_text_sha256,
      (hashCounts.get(chunk.chunk_text_sha256) ?? 0) + 1,
    );
  }
  return chunks.map((chunk) => ({
    ...chunk,
    chunk_quality_flags: {
      ...chunk.chunk_quality_flags,
      duplicate_hash: (hashCounts.get(chunk.chunk_text_sha256) ?? 0) > 1,
    },
  }));
}

export function summarizeLegalUnitChunks(
  chunks: LegalUnitChunk[],
): ChunkQualitySummary {
  const total = chunks.length || 1;
  const duplicateHashes = new Set(
    [...groupBy(chunks, (c) => c.chunk_text_sha256).entries()]
      .filter(([, values]) => values.length > 1)
      .map(([hash]) => hash),
  );
  const bad = chunks.filter((c) =>
    c.chunk_quality_flags.starts_mid_word ||
    c.chunk_quality_flags.has_url_noise ||
    c.chunk_quality_flags.has_page_counter ||
    c.chunk_quality_flags.table_noise ||
    c.chunk_quality_flags.weak_context
  );

  return {
    total_chunks: chunks.length,
    legal_unit_id_coverage: chunks.filter((c) => c.legal_unit_id).length /
      total,
    citation_anchor_coverage: chunks.filter((c) => c.citation_anchor).length /
      total,
    effective_date_coverage:
      chunks.filter((c) => c.effective_from || c.effective_to).length / total,
    unknown_domain_count:
      chunks.filter((c) =>
        c.normalized_domain === "unknown" || c.content_domain === "unknown"
      ).length,
    mid_word_starts:
      chunks.filter((c) => c.chunk_quality_flags.starts_mid_word).length,
    duplicate_hashes: duplicateHashes.size,
    bad_chunk_samples: bad.slice(0, 10).map((c) => ({
      chunk_key: c.chunk_key,
      citation_anchor: c.citation_anchor,
      chunk_quality_flags: c.chunk_quality_flags,
      text: c.text.slice(0, 700),
    })),
  };
}

async function chunkArmenianLegislation(
  input: LegalUnitDocumentInput,
  normalizedDomain: string,
): Promise<LegalUnitChunk[]> {
  const articleMatches = findArticleMatches(input.text);
  if (articleMatches.length === 0) {
    return chunkNormativeAct(input, normalizedDomain);
  }

  const segments: Segment[] = [];
  if (articleMatches[0].start > MIN_CONTEXT_CHARS) {
    segments.push({
      start: 0,
      end: articleMatches[0].start,
      label: "Preamble",
      type: "preamble",
      number: null,
    });
  }

  for (let i = 0; i < articleMatches.length; i++) {
    const current = articleMatches[i];
    const end = articleMatches[i + 1]?.start ?? input.text.length;
    const articleId = deterministicUuid(
      `${input.version_id}|article|${current.number}`,
    );
    const articleSegment: Segment = {
      start: current.start,
      end,
      label: `Հոդված ${current.number}`,
      type: "article",
      number: current.number,
      articleNumber: current.number,
      parentId: null,
    };
    if (end - current.start <= MAX_CHARS) {
      segments.push(articleSegment);
    } else {
      segments.push(
        ...splitLongLegalUnit(input.text, articleSegment, articleId),
      );
    }
  }

  return materializeSegments(input, segments, normalizedDomain);
}

async function chunkNormativeAct(
  input: LegalUnitDocumentInput,
  normalizedDomain: string,
): Promise<LegalUnitChunk[]> {
  const numbered = findNumberedUnitBreakpoints(
    input.text,
    0,
    input.text.length,
  );
  if (numbered.length < 2) return chunkFallback(input, normalizedDomain);

  const segments: Segment[] = [];
  if (numbered[0].start > MIN_CONTEXT_CHARS) {
    segments.push({
      start: 0,
      end: numbered[0].start,
      label: "Preamble",
      type: "preamble",
      number: null,
    });
  }

  for (let i = 0; i < numbered.length; i++) {
    const current = numbered[i];
    const end = numbered[i + 1]?.start ?? input.text.length;
    if (end - current.start <= MAX_CHARS) {
      segments.push({
        start: current.start,
        end,
        label: `կետ ${current.number}`,
        type: "normative_point",
        number: current.number,
        pointNumber: current.number,
      });
      continue;
    }

    const parentId = deterministicUuid(
      `${input.version_id}|normative_point|${current.number}`,
    );
    segments.push(
      ...splitLongLegalUnit(
        input.text,
        {
          start: current.start,
          end,
          label: `կետ ${current.number}`,
          type: "normative_point",
          number: current.number,
          pointNumber: current.number,
        },
        parentId,
      ),
    );
  }

  return materializeSegments(input, segments, normalizedDomain);
}

async function chunkCourtPractice(
  input: LegalUnitDocumentInput,
  normalizedDomain: string,
): Promise<LegalUnitChunk[]> {
  const markers = findCourtSectionMarkers(input.text);
  const caseNumber = extractCaseNumber(input.text);
  const decisionDate = extractDecisionDate(input.text);
  const segments = markers.length > 0
    ? markers.map((marker, i) => ({
      start: marker.start,
      end: markers[i + 1]?.start ?? input.text.length,
      label: marker.label,
      type: marker.type,
      number: String(i + 1),
    }))
    : numberedOrFixedSegments(input.text, "court_section");

  return materializeSegments(input, segments, normalizedDomain, {
    anchorSuffix: [caseNumber, decisionDate].filter(Boolean).join(" | "),
  });
}

async function chunkEchr(
  input: LegalUnitDocumentInput,
  normalizedDomain: string,
): Promise<LegalUnitChunk[]> {
  const caseTitle = normalizeLegalTitle(input.title) ??
    extractEchrCaseTitle(input.text) ?? "ECHR case";
  const appNo = extractEchrApplicationNo(input.text);
  const judgmentDate = extractEchrJudgmentDate(input.text);
  const judgmentDateIso = normalizeEnglishDate(judgmentDate);
  const paragraphSegments = findEchrParagraphSegments(input.text);
  const segments = paragraphSegments.length > 0
    ? groupEchrParagraphs(input.text, paragraphSegments)
    : fixedSegments(input.text, "echr_section");
  const chunks = await materializeSegments(
    {
      ...input,
      effective_from: input.effective_from ?? judgmentDateIso,
      source_date: input.source_date ?? judgmentDateIso,
    },
    segments,
    normalizedDomain,
    {
      anchorPrefix: "ECHR",
      anchorSuffix: [caseTitle, appNo, judgmentDate].filter(Boolean).join(
        " | ",
      ),
    },
  );

  return chunks.map((chunk) => {
    const article = extractEchrArticle(chunk.text);
    const para = chunk.paragraph_number;
    return {
      ...chunk,
      citation_anchor: [
        "ECHR",
        caseTitle,
        appNo,
        judgmentDate,
        article ? `Article ${article}` : null,
        para ? `para ${para}` : null,
      ].filter(Boolean).join(" | "),
    };
  });
}

async function chunkFallback(
  input: LegalUnitDocumentInput,
  normalizedDomain: string,
): Promise<LegalUnitChunk[]> {
  return materializeSegments(
    input,
    fixedSegments(input.text, "section"),
    normalizedDomain,
  );
}

function splitLongLegalUnit(
  text: string,
  article: Segment,
  articleId: string,
): Segment[] {
  const breakpoints = findPartPointBreakpoints(
    text,
    article.start,
    article.end,
  );
  if (breakpoints.length < 2) {
    return fixedSegments(
      text.slice(article.start, article.end),
      "article_part",
      article.start,
    )
      .map((segment, i) => ({
        ...segment,
        label: `${article.label}, մաս ${i + 1}`,
        articleNumber: article.articleNumber,
        partNumber: String(i + 1),
        parentId: articleId,
      }));
  }

  const segments: Segment[] = [];
  let groupStart = breakpoints[0].start;
  let currentNumber = breakpoints[0].number;
  for (let i = 1; i <= breakpoints.length; i++) {
    const nextStart = breakpoints[i]?.start ?? article.end;
    if (nextStart - groupStart >= TARGET_CHARS || i === breakpoints.length) {
      segments.push({
        start: groupStart,
        end: nextStart,
        label: `${article.label}, մաս/կետ ${currentNumber}`,
        type: "article_part",
        number: currentNumber,
        articleNumber: article.articleNumber,
        partNumber: currentNumber,
        parentId: articleId,
      });
      groupStart = nextStart;
      currentNumber = breakpoints[i]?.number ?? currentNumber;
    }
  }
  return segments.filter((segment) => segment.end > segment.start);
}

async function materializeSegments(
  input: LegalUnitDocumentInput,
  segments: Segment[],
  normalizedDomain: string,
  opts: { anchorPrefix?: string; anchorSuffix?: string } = {},
): Promise<LegalUnitChunk[]> {
  const title = normalizeLegalTitle(input.title) ?? inferTitle(input.text);
  const classified = classifyLegalDocumentDomain(input, input.text);
  const contentDomain = classified.content_domain;
  const normStatus = normalizeStatus(input.norm_status, input.text);
  const legalStatus = normStatus;
  const sourceUrl = input.source_url ?? extractArlisUrl(input.text);
  const arlisId = input.arlis_doc_id ??
    extractArlisDocId(sourceUrl ?? input.canonical_key ?? input.text);
  const effectiveFrom = input.effective_from ??
    extractEffectiveFrom(input.text);
  const effectiveTo = input.effective_to ?? extractEffectiveTo(input.text);
  const sourceDate = input.source_date ?? effectiveFrom;
  const language = normalizeLanguage(input.language, input.text);
  const chunks: LegalUnitChunk[] = [];

  for (const segment of segments) {
    const rawUnitText = input.text.slice(segment.start, segment.end).trim();
    if (!rawUnitText) continue;
    const header = buildContextHeader(title, segment);
    const chunkText = `${header}\n\n${rawUnitText}`.trim();
    const legalUnitId = deterministicUuid(
      `${input.version_id}|${segment.type}|${segment.number ?? segment.start}|${
        segment.articleNumber ?? ""
      }`,
    );
    const hash = await sha256Hex(chunkText);
    const flags = qualityFlags(rawUnitText, chunkText, normStatus);
    const article = segment.articleNumber ??
      (segment.type === "article" ? segment.number : null);
    const baseAnchor = opts.anchorPrefix === "ECHR"
      ? null
      : buildCitationAnchor({
        arlisId,
        title,
        segment,
        sourceUrl,
        suffix: opts.anchorSuffix,
      });

    chunks.push({
      chunk_key: await sha256Hex(
        `${LEGAL_UNIT_CHUNK_VERSION}|${input.version_id}|${segment.start}|${segment.end}|${hash}`,
      ),
      source_document_id: input.document_id,
      document_id: input.document_id,
      version_id: input.version_id,
      legal_unit_id: legalUnitId,
      legal_unit_type: segment.type,
      legal_unit_number: segment.number,
      parent_legal_unit_id: segment.parentId ?? null,
      article_number: article,
      part_number: segment.partNumber ?? null,
      point_number: segment.pointNumber ?? null,
      paragraph_number: segment.paragraphNumber ??
        extractFirstParagraphNumber(rawUnitText),
      text: chunkText,
      token_count: estimateLegalUnitTokens(chunkText),
      page_from: extractPageNear(input.text, segment.start),
      page_to: extractPageNear(input.text, segment.end),
      char_start: segment.start,
      char_end: segment.end,
      language,
      language_code: language,
      content_domain: contentDomain,
      normalized_domain: normalizedDomain,
      norm_status: normStatus,
      legal_status: legalStatus,
      effective_from: effectiveFrom,
      effective_to: effectiveTo,
      source_date: sourceDate,
      source_url: sourceUrl,
      citation_anchor: baseAnchor,
      normalized_title: title,
      chunk_quality_flags: flags,
      chunk_text_sha256: hash,
      chunk_version: LEGAL_UNIT_CHUNK_VERSION,
    });
  }

  return chunks;
}

function findArticleMatches(
  text: string,
): Array<{ start: number; number: string }> {
  const matches: Array<{ start: number; number: string }> = [];
  const re =
    /(?:^|\n)\s*(?:Հոդված|ՀՈԴՎԱԾ)\s+([0-9]+(?:\.[0-9]+)*|[Ա-ՖԱ-ֆ]+)\.?\s*/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    matches.push({
      start: match.index + (match[0].startsWith("\n") ? 1 : 0),
      number: match[1],
    });
  }
  return matches;
}

function findPartPointBreakpoints(
  text: string,
  start: number,
  end: number,
): Array<{ start: number; number: string }> {
  const slice = text.slice(start, end);
  const re = /(?:^|\n)\s*((?:\d+|[ա-ֆ])[.)])\s+/g;
  const points: Array<{ start: number; number: string }> = [{
    start,
    number: "1",
  }];
  let match: RegExpExecArray | null;
  while ((match = re.exec(slice)) !== null) {
    points.push({
      start: start + match.index + (match[0].startsWith("\n") ? 1 : 0),
      number: match[1].replace(/[.)]/g, ""),
    });
  }
  return [...new Map(points.map((point) => [point.start, point])).values()]
    .sort((a, b) => a.start - b.start);
}

function findNumberedUnitBreakpoints(
  text: string,
  start: number,
  end: number,
): Array<{ start: number; number: string }> {
  const slice = text.slice(start, end);
  const re = /(?:^|\n)\s*(\d{1,3})\.\s+/g;
  const points: Array<{ start: number; number: string }> = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(slice)) !== null) {
    points.push({
      start: start + match.index + (match[0].startsWith("\n") ? 1 : 0),
      number: match[1],
    });
  }
  return points.sort((a, b) => a.start - b.start);
}

function findCourtSectionMarkers(text: string): Segment[] {
  const patterns: Array<{ re: RegExp; type: string; label: string }> = [
    { re: /(?:^|\n)\s*(ՊԱՐԶԵՑ|Պարզեց)\s*/g, type: "facts", label: "Պարզեց" },
    {
      re: /(?:^|\n)\s*(ՎՃՌԵՑ|ՈՐՈՇԵՑ|Վճռեց|Որոշեց)\s*/g,
      type: "resolution",
      label: "Որոշեց",
    },
    {
      re:
        /(?:^|\n)\s*(Վճռաբեկ դատարանի պատճառաբանությունները|Դատարանի պատճառաբանությունները)\s*/g,
      type: "reasoning",
      label: "Պատճառաբանություններ",
    },
  ];
  const markers: Segment[] = [];
  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.re.exec(text)) !== null) {
      markers.push({
        start: match.index + (match[0].startsWith("\n") ? 1 : 0),
        end: match.index,
        label: pattern.label,
        type: pattern.type,
        number: null,
      });
    }
  }
  return markers.sort((a, b) => a.start - b.start);
}

function findEchrParagraphSegments(text: string): Segment[] {
  const re = /(?:^|\n)\s*(\d{1,3})\.\s+/g;
  const segments: Segment[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    segments.push({
      start: match.index + (match[0].startsWith("\n") ? 1 : 0),
      end: match.index,
      label: `para ${match[1]}`,
      type: "echr_paragraph",
      number: match[1],
      paragraphNumber: match[1],
    });
  }
  return segments;
}

function groupEchrParagraphs(text: string, paragraphs: Segment[]): Segment[] {
  const grouped: Segment[] = [];
  let groupStart = paragraphs[0].start;
  let firstPara = paragraphs[0].paragraphNumber ?? paragraphs[0].number ?? "1";
  for (let i = 1; i <= paragraphs.length; i++) {
    const nextStart = paragraphs[i]?.start ?? text.length;
    if (nextStart - groupStart >= TARGET_CHARS || i === paragraphs.length) {
      grouped.push({
        start: groupStart,
        end: nextStart,
        label: `paras ${firstPara}-${
          paragraphs[i - 1].paragraphNumber ?? paragraphs[i - 1].number
        }`,
        type: "echr_paragraph_group",
        number: firstPara,
        paragraphNumber: firstPara,
      });
      groupStart = nextStart;
      firstPara = paragraphs[i]?.paragraphNumber ?? paragraphs[i]?.number ??
        firstPara;
    }
  }
  return grouped;
}

function fixedSegments(text: string, type: string, offset = 0): Segment[] {
  const segments: Segment[] = [];
  let pos = 0;
  let index = 1;
  while (pos < text.length) {
    const end = findSafeBreak(
      text,
      pos,
      Math.min(pos + MAX_CHARS, text.length),
    );
    segments.push({
      start: offset + pos,
      end: offset + end,
      label: `${type} ${index}`,
      type,
      number: String(index),
    });
    pos = end;
    index++;
  }
  return segments;
}

function numberedOrFixedSegments(text: string, type: string): Segment[] {
  const numbered = findNumberedUnitBreakpoints(text, 0, text.length);
  if (numbered.length < 2) return fixedSegments(text, type);
  return numbered.map((point, index) => ({
    start: point.start,
    end: numbered[index + 1]?.start ?? text.length,
    label: `${type} ${point.number}`,
    type,
    number: point.number,
    pointNumber: point.number,
  }));
}

function findSafeBreak(text: string, start: number, maxEnd: number): number {
  if (maxEnd >= text.length) return text.length;
  const slice = text.slice(start, maxEnd);
  const candidates = ["\n\n", "\n", "։ ", ". ", "; "];
  for (const marker of candidates) {
    const idx = slice.lastIndexOf(marker);
    if (idx > TARGET_CHARS * 0.5) return start + idx + marker.length;
  }
  const ws = slice.lastIndexOf(" ");
  return ws > 0 ? start + ws : maxEnd;
}

function buildContextHeader(title: string | null, segment: Segment): string {
  return [
    title,
    segment.articleNumber ? `Հոդված ${segment.articleNumber}` : null,
    segment.partNumber ? `Մաս/կետ ${segment.partNumber}` : null,
    segment.label && !segment.articleNumber ? segment.label : null,
  ].filter(Boolean).join(" -> ");
}

function buildCitationAnchor(opts: {
  arlisId: string | null;
  title: string | null;
  segment: Segment;
  sourceUrl: string | null;
  suffix?: string;
}): string | null {
  const parts = [
    opts.arlisId ? `ARLIS DocID ${opts.arlisId}` : null,
    opts.title,
    opts.segment.articleNumber
      ? `Հոդված ${opts.segment.articleNumber}`
      : opts.segment.label,
    opts.segment.partNumber ? `մաս/կետ ${opts.segment.partNumber}` : null,
    opts.suffix || null,
  ].filter(Boolean);
  return parts.length ? parts.join(" | ") : opts.sourceUrl;
}

function qualityFlags(
  rawUnitText: string,
  chunkText: string,
  normStatus: string,
): Record<string, boolean> {
  return {
    starts_mid_word: startsMidWord(chunkText),
    has_url_noise: /https?:\/\/|DocumentView\.aspx/i.test(chunkText),
    has_page_counter: /(?:^|\s)\d{1,4}\s*\/\s*\d{1,4}(?:\s|$)/.test(
      chunkText,
    ),
    table_noise: countChar(rawUnitText, "|") > 12 ||
      countChar(rawUnitText, "_") > rawUnitText.length * 0.1,
    weak_context: chunkText.length < MIN_CONTEXT_CHARS,
    repealed_source: normStatus !== "active",
  };
}

function startsMidWord(text: string): boolean {
  const trimmed = text.trimStart();
  if (trimmed.split("\n", 1)[0].includes("->")) return false;
  if (/^[ա-ֆ][).]/.test(trimmed)) return false;
  return /^[ա-ֆa-z]/.test(trimmed);
}

function normalizeStatus(
  status: string | null | undefined,
  text: string,
): string {
  const raw = String(status ?? "").toLowerCase();
  if (raw === "active" || raw === "repealed" || raw === "inactive") return raw;
  if (/չի գործում|ուժը կորցրել/i.test(text)) return "repealed";
  if (/գործում է/i.test(text)) return "active";
  return raw || "active";
}

function normalizeLanguage(
  language: string | null | undefined,
  text: string,
): string {
  if (language) return language;
  if (/[ա-ֆԱ-Ֆ]/.test(text)) return "hy";
  if (/\b(le|la|des|une|cour)\b/i.test(text)) return "fr";
  return "en";
}

function hasArmenianArticleMarkers(text: string): boolean {
  return /(?:Հոդված|ՀՈԴՎԱԾ)\s+\d/.test(text);
}

function isCourtPractice(text: string): boolean {
  return /Վճռաբեկ դատարան|Սահմանադրական դատարան|դատական ակտ|քաղաքացիական գործ թիվ|քրեական գործ թիվ|վարչական գործ թիվ/i
    .test(text);
}

function isEchr(text: string): boolean {
  return /case of .+ v\.|european court of human rights|echr|մարդու իրավունքների եվրոպական դատարան/i
    .test(text);
}

function inferTitle(text: string): string | null {
  return text.split("\n").map((line) => line.trim()).find((line) =>
    line.length >= 12 && line.length <= 240
  ) ?? null;
}

function extractArlisUrl(text: string): string | null {
  return text.match(
    /https?:\/\/(?:www\.)?arlis\.am\/DocumentView\.aspx\?DocID=\d+/i,
  )?.[0] ?? null;
}

function extractArlisDocId(text: string): string | null {
  return text.match(/DocID=(\d+)/i)?.[1] ?? text.match(/arlis:?(\d+)/i)?.[1] ??
    null;
}

function extractEffectiveFrom(text: string): string | null {
  return extractDateAfter(text, /Ուժի մեջ մտնելու ամսաթիվը/i);
}

function extractEffectiveTo(text: string): string | null {
  return extractDateAfter(text, /Ուժը կորցնելու ամսաթիվը/i);
}

function extractDateAfter(text: string, label: RegExp): string | null {
  const idx = text.search(label);
  if (idx < 0) return null;
  const slice = text.slice(idx, idx + 160);
  return normalizeDate(
    slice.match(/(\d{2})\.(\d{2})\.(\d{4})/) ??
      slice.match(/(\d{4})-(\d{2})-(\d{2})/),
  );
}

function normalizeDate(match: RegExpMatchArray | null): string | null {
  if (!match) return null;
  if (match[1].length === 4) return `${match[1]}-${match[2]}-${match[3]}`;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function extractCaseNumber(text: string): string | null {
  return text.match(/[Ա-Ֆ]{1,4}\d?\/\d{4}\/\d{2}\/\d{2}/)?.[0] ??
    text.match(/թիվ\s+([Ա-ՖA-Z0-9/-]+)/i)?.[1] ?? null;
}

function extractDecisionDate(text: string): string | null {
  return normalizeDate(text.slice(0, 2500).match(/(\d{2})\.(\d{2})\.(\d{4})/));
}

function extractEchrCaseTitle(text: string): string | null {
  return text.match(/CASE OF [^\n]+/i)?.[0].replace(/\s+/g, " ").trim() ?? null;
}

function extractEchrApplicationNo(text: string): string | null {
  return text.match(/\b(?:no\.|application no\.)\s*([0-9]+\/[0-9]+)/i)?.[1] ??
    null;
}

function extractEchrJudgmentDate(text: string): string | null {
  return text.match(/\b(\d{1,2}\s+[A-Z][a-z]+\s+\d{4})\b/)?.[1] ?? null;
}

function normalizeEnglishDate(date: string | null): string | null {
  if (!date) return null;
  const match = date.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (!match) return null;
  const month = ENGLISH_MONTHS[match[2].toLowerCase()];
  if (!month) return null;
  return `${match[3]}-${month}-${match[1].padStart(2, "0")}`;
}

const ENGLISH_MONTHS: Record<string, string> = {
  january: "01",
  february: "02",
  march: "03",
  april: "04",
  may: "05",
  june: "06",
  july: "07",
  august: "08",
  september: "09",
  october: "10",
  november: "11",
  december: "12",
};

function extractEchrArticle(text: string): string | null {
  return text.match(/Article\s+(\d+[A-Z]?)/i)?.[1] ?? null;
}

function extractFirstParagraphNumber(text: string): string | null {
  return text.match(/^\s*(\d{1,3})\.\s/)?.[1] ?? null;
}

function extractPageNear(text: string, pos: number): number | null {
  const slice = text.slice(
    Math.max(0, pos - 120),
    Math.min(text.length, pos + 120),
  );
  const match = slice.match(/\b(\d{1,4})\s*\/\s*\d{1,4}\b/);
  return match ? Number(match[1]) : null;
}

function normalizeNoiseLine(line: string): string {
  return line.toLowerCase()
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\bwww\.\S+/g, "")
    .replace(/(?:^|\s)\d{1,4}\s*\/\s*\d{1,4}(?:\s|$)/g, "")
    .replace(/\[(?:էջ|page)\s+\d+\]/gi, "")
    .replace(/\d+/g, "#")
    .replace(/\s+/g, " ")
    .trim();
}

function countChar(text: string, char: string): number {
  return text.split(char).length - 1;
}

function groupBy<T>(items: T[], keyFn: (item: T) => string): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const values = grouped.get(key) ?? [];
    values.push(item);
    grouped.set(key, values);
  }
  return grouped;
}

async function sha256Hex(text: string): Promise<string> {
  const buffer = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function deterministicUuid(input: string): string {
  const hex = syncHash128(input);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${
    ((parseInt(hex.slice(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(
      2,
      "0",
    )
  }${hex.slice(18, 20)}-${hex.slice(20, 32)}`;
}

function syncHash128(input: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  let h3 = 0x9e3779b9;
  let h4 = 0x85ebca6b;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
    h3 = Math.imul(h3 ^ ch, 2246822507);
    h4 = Math.imul(h4 ^ ch, 3266489909);
  }
  const words = [h1, h2, h3, h4].map((h) =>
    (h >>> 0).toString(16).padStart(8, "0")
  );
  return words.join("");
}
