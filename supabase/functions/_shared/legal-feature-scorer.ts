import type { MetricCorpusRow } from "./metric-search.ts";
import type { StatusScope } from "./rag-types.ts";

export const LEGAL_FEATURE_NAMES = [
  "metric_cosine_similarity",
  "ann_rank_score",
  "armenian_fts_score",
  "fts_rank_score",
  "identifier_match",
  "rrf_score",
  "exact_phrase_match",
  "exact_title_match",
  "document_number_match",
  "article_match",
  "part_match",
  "point_match",
  "subpoint_match",
  "case_number_match",
  "date_match",
  "canonical_key_match",
  "query_intent_match",
  "content_domain_match",
  "legal_domain_match",
  "authority_level",
  "jurisdiction_match",
  "document_type_match",
  "source_type_match",
  "current_version_signal",
  "norm_status_signal",
  "status_eligibility",
  "effective_date_validity",
  "specific_provision_bonus",
  "source_quality",
  "chunk_quality",
  "text_completeness",
  "exact_duplicate_penalty",
  "near_duplicate_penalty",
  "document_repetition_penalty",
  "source_diversity_bonus",
] as const;

export type LegalFeatureName = typeof LEGAL_FEATURE_NAMES[number];
export type LegalFeatureVector = Record<LegalFeatureName, number>;
export type LegalFeatureWeights = Record<LegalFeatureName, number>;

export interface LegalScoredRow {
  row: MetricCorpusRow;
  features: LegalFeatureVector;
  deterministic_score: number;
  status_eligible: boolean;
  legal_status_warning: string | null;
  reason_codes: string[];
}

/**
 * Safe development baseline only. The bake-off trainer replaces these values
 * from train/dev; this object is never represented as a release calibration.
 */
export const TRAINING_SEED_WEIGHTS: Readonly<LegalFeatureWeights> = Object
  .freeze({
    metric_cosine_similarity: 0.05127352339501822,
    ann_rank_score: 0.02,
    armenian_fts_score: 0.11885458574367108,
    fts_rank_score: 0.02,
    identifier_match: 0.1394294280595618,
    rrf_score: 0.03,
    exact_phrase_match: 0.17262476687504777,
    exact_title_match: 0.35100499085601994,
    document_number_match: 0.06435412989692467,
    article_match: 0.01,
    part_match: 0.01,
    point_match: 0.01,
    subpoint_match: 0.01,
    case_number_match: 0.0009682834295647333,
    date_match: 0.05740739898710854,
    canonical_key_match: 0.03,
    query_intent_match: 0.000866879029110995,
    content_domain_match: 0.01,
    legal_domain_match: 0.017824485390768342,
    authority_level: 0.001411733504464009,
    jurisdiction_match: 0.000759688861094944,
    document_type_match: 0.019795147753120808,
    source_type_match: 0.01,
    current_version_signal: 0.01,
    norm_status_signal: 0,
    status_eligibility: 0,
    effective_date_validity: 0,
    specific_provision_bonus: 0,
    source_quality: 0.0002931914192185759,
    chunk_quality: 0.0001337407053904224,
    text_completeness: 0.01,
    exact_duplicate_penalty: -0.001,
    near_duplicate_penalty: -0.001,
    document_repetition_penalty: -0.002760101942971105,
    source_diversity_bonus: 0.00009317580522119006,
  });

export const DEV_CALIBRATED_WEIGHTS: Readonly<LegalFeatureWeights> = Object
  .freeze({
    metric_cosine_similarity: 0,
    ann_rank_score: 0,
    armenian_fts_score: 0,
    fts_rank_score: 0,
    identifier_match: 0,
    rrf_score: 0,
    exact_phrase_match: 0.10860148605670827,
    exact_title_match: 0.2259827572649431,
    document_number_match: 0.038548525153593596,
    article_match: 0.0019574401075371397,
    part_match: 0.0019574401075371397,
    point_match: 0.0019574401075371397,
    subpoint_match: 0.0019574401075371397,
    case_number_match: 0.0001895356820493622,
    date_match: 0.03740788159704427,
    canonical_key_match: 0.005872320322611419,
    query_intent_match: 0,
    content_domain_match: 0.0015137629212679249,
    legal_domain_match: 0.01057395878699326,
    authority_level: 0.0007596215822369893,
    jurisdiction_match: 0.00033330351368180273,
    document_type_match: 0.009795800102063879,
    source_type_match: 0.0019574401075371397,
    current_version_signal: 0,
    norm_status_signal: 0,
    status_eligibility: 0,
    effective_date_validity: 0,
    specific_provision_bonus: 0,
    source_quality: 0.00005739046431641758,
    chunk_quality: 0,
    text_completeness: 0,
    exact_duplicate_penalty: -0.00019574401075371397,
    near_duplicate_penalty: -0.00019574401075371397,
    document_repetition_penalty: -0.0016902582498237544,
    source_diversity_bonus: 0.000018238605819202584,
  });
export const UNRELEASED_BASELINE_WEIGHTS = DEV_CALIBRATED_WEIGHTS;

export const HARD_GUARD_FEATURE_NAMES: ReadonlySet<LegalFeatureName> = new Set([
  "norm_status_signal",
  "status_eligibility",
  "effective_date_validity",
]);

const ARMENIAN_RE = /[\u0531-\u0587]/g;
const ARTICLE_RE =
  /(?:հոդված(?:ի|ը)?|стать(?:я|и|ю)|article)\s*([0-9]+(?:\.[0-9]+)?)/giu;
const PART_RE = /(?:մաս(?:ի|ը)?|част(?:ь|и)|part)\s*([0-9]+)/giu;
const POINT_RE = /(?:կետ(?:ի|ը)?|пункт(?:а)?|point)\s*([0-9]+(?:\.[0-9]+)?)/giu;
const SUBPOINT_RE =
  /(?:ենթակետ(?:ի|ը)?|подпункт(?:а)?|subpoint)\s*([0-9]+(?:\.[0-9]+)?)/giu;
const DATE_RE =
  /\b(?:19|20)\d{2}[-./](?:0?[1-9]|1[0-2])[-./](?:0?[1-9]|[12]\d|3[01])\b/g;
const CASE_RE =
  /\b(?:ԵԴ|ՎԴ|ՔԴ|ՍԴ|ECHR|ECtHR|ԴԴ|[A-ZА-Я]{1,6})[-–/]?[A-ZА-Я0-9-]{2,}\b/giu;

function clamp01(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

function normalize(value: unknown): string {
  return String(value ?? "").normalize("NFKC").trim().toLocaleLowerCase();
}

function compact(value: unknown): string {
  return normalize(value).replace(/[^\p{L}\p{N}]+/gu, "");
}

function tokens(value: string): Set<string> {
  return new Set(
    normalize(value).split(/[^\p{L}\p{N}]+/u).filter((token) =>
      token.length >= 2
    ),
  );
}

function overlap(left: string, right: string): number {
  const a = tokens(left);
  const b = tokens(right);
  if (!a.size || !b.size) return 0;
  let hits = 0;
  for (const token of a) if (b.has(token)) hits += 1;
  return hits / Math.min(a.size, b.size);
}

function values(re: RegExp, value: string): Set<string> {
  const result = new Set<string>();
  re.lastIndex = 0;
  for (const match of value.matchAll(re)) if (match[1]) result.add(match[1]);
  return result;
}

function setOverlap(a: Set<string>, b: Set<string>): number {
  if (!a.size) return 0;
  let hits = 0;
  for (const item of a) if (b.has(item)) hits += 1;
  return hits / a.size;
}

function rankScore(value: number | null): number {
  return value != null && Number.isFinite(value) && value > 0
    ? clamp01(1 / Math.log2(value + 1))
    : 0;
}

function metadataText(row: MetricCorpusRow): string {
  return [
    row.title,
    row.citation_anchor,
    row.citation_metadata?.document_number,
    row.citation_metadata?.arlis_doc_id,
    row.citation_metadata?.canonical_key,
    row.citation_metadata?.legal_unit_type,
    row.citation_metadata?.legal_unit_number,
    row.citation_metadata?.legal_unit_title,
    row.citation_metadata?.issued_date,
  ].filter(Boolean).join(" ");
}

function statusEligible(row: MetricCorpusRow, scope: StatusScope): boolean {
  if (row.status_eligible !== true) return false;
  if (scope === "current") return row.norm_status === "active";
  if (scope === "extended") {
    return row.norm_status === "active" || row.norm_status === "unknown";
  }
  return row.norm_status === "active" || row.norm_status === "unknown" ||
    row.norm_status === "repealed";
}

function effectiveAtValid(
  row: MetricCorpusRow,
  effectiveAt: string | null | undefined,
): boolean {
  if (!effectiveAt) return true;
  const at = Date.parse(effectiveAt);
  if (!Number.isFinite(at)) return false;
  const from = row.effective_from
    ? Date.parse(row.effective_from)
    : Number.NEGATIVE_INFINITY;
  const to = row.effective_to
    ? Date.parse(row.effective_to)
    : Number.POSITIVE_INFINITY;
  return (!Number.isFinite(from) || from <= at) &&
    (!Number.isFinite(to) || at < to);
}

function authority(row: MetricCorpusRow): number {
  const text = normalize([row.source, row.title, metadataText(row)].join(" "));
  if (/սահմանադրական|constitutional/.test(text)) return 1;
  if (/վճռաբեկ|cassation|echr|ecthr|մարդու իրավունքների եվրոպական/.test(text)) {
    return 0.9;
  }
  if (/arlis|օրենք|օրենսգիրք|code|law/.test(text)) return 0.82;
  if (/դատարան|court|суд/.test(text)) return 0.7;
  return 0.45;
}

function queryIntentMatch(query: string, row: MetricCorpusRow): number {
  const q = normalize(query);
  const practice = /դատարան|գործ|վճիռ|նախադեպ|court|case|суд|дело/.test(q);
  const normative =
    /օրենք|օրենսգիրք|հոդված|իրավունք|law|code|article|закон|стать/.test(q);
  if (!practice && !normative) return 0.5;
  if (practice && row.content_domain === "practice") return 1;
  if (normative && row.content_domain === "knowledge_base") return 1;
  return practice && normative ? 0.5 : 0;
}

function legalDomainMatch(query: string, row: MetricCorpusRow): number {
  const labels = [
    ["քրեական criminal уголов", /քրեական|criminal|уголов/iu],
    ["քաղաքացիական civil граждан", /քաղաքացիական|civil|граждан/iu],
    [
      "վարչական administrative административ",
      /վարչական|administrative|административ/iu,
    ],
    [
      "սահմանադրական constitutional конституц",
      /սահմանադրական|constitutional|конституц/iu,
    ],
  ] as const;
  const q = normalize(query);
  const text = normalize(
    [row.title, row.chunk_text, row.source, metadataText(row)].join(" "),
  );
  const requested = labels.find(([, re]) => re.test(q));
  return requested ? (requested[1].test(text) ? 1 : 0) : 0.5;
}

function documentTypeMatch(query: string, row: MetricCorpusRow): number {
  const q = normalize(query);
  const text = normalize([row.title, metadataText(row)].join(" "));
  const types = [
    /օրենք|law|закон/iu,
    /օրենսգիրք|code|кодекс/iu,
    /որոշում|decision|решени/iu,
    /վճիռ|judgment|постановлен/iu,
    /հոդված|article|стать/iu,
  ];
  const requested = types.find((re) => re.test(q));
  return requested ? (requested.test(text) ? 1 : 0) : 0.5;
}

export function buildLegalFeatures(
  query: string,
  row: MetricCorpusRow,
  context: {
    statusScope: StatusScope;
    effectiveAt?: string | null;
    duplicateCount?: number;
    exactDuplicateCount?: number;
    documentCount?: number;
    sourceCount?: number;
  },
): LegalFeatureVector {
  const q = normalize(query);
  const text = normalize(row.chunk_text);
  const title = normalize(row.title);
  const meta = normalize(metadataText(row));
  const queryCompact = compact(q);
  const number = compact(row.citation_metadata?.document_number);
  const caseValues = values(CASE_RE, q);
  const dateValues = new Set(q.match(DATE_RE) ?? []);
  const candidateText = `${meta} ${text}`;
  const armenianCount = (row.chunk_text.match(ARMENIAN_RE) ?? []).length;
  const letterCount = (row.chunk_text.match(/\p{L}/gu) ?? []).length || 1;
  const length = row.chunk_text.trim().length;
  const lengthQuality = length < 80
    ? length / 80
    : length > 8000
    ? 8000 / length
    : 1;
  const exactPhrase = q.length >= 4 && (text.includes(q) || title.includes(q));
  const canonicalKey = compact(row.citation_metadata?.canonical_key);
  const isOfficialSource = /^https:\/\//i.test(row.source_url ?? "") ||
    /arlis|echr|venice/iu.test(row.source ?? "");
  const endsCleanly = /[.!?։:]$/u.test(row.chunk_text.trim());

  return {
    metric_cosine_similarity: clamp01(Number(row.vector_similarity ?? 0)),
    ann_rank_score: rankScore(row.ann_rank),
    armenian_fts_score: clamp01(
      Number(row.fts_rank ?? 0) / (Number(row.fts_rank ?? 0) + 0.1),
    ),
    fts_rank_score: rankScore(row.fts_rank_position),
    identifier_match: clamp01(Number(row.identifier_match ?? 0)),
    rrf_score: clamp01(Number(row.rrf_score ?? 0) / 0.05),
    exact_phrase_match: exactPhrase ? 1 : overlap(q, `${title} ${text}`),
    exact_title_match: q === title
      ? 1
      : (q.length >= 4 && title.includes(q) ? 0.8 : overlap(q, title)),
    document_number_match: number && queryCompact.includes(number) ? 1 : 0,
    article_match: clamp01(
      setOverlap(values(ARTICLE_RE, q), values(ARTICLE_RE, candidateText)),
    ),
    part_match: clamp01(
      setOverlap(values(PART_RE, q), values(PART_RE, candidateText)),
    ),
    point_match: clamp01(
      setOverlap(values(POINT_RE, q), values(POINT_RE, candidateText)),
    ),
    subpoint_match: clamp01(
      setOverlap(values(SUBPOINT_RE, q), values(SUBPOINT_RE, candidateText)),
    ),
    case_number_match: clamp01(
      setOverlap(caseValues, values(CASE_RE, `${meta} ${text}`)),
    ),
    date_match: clamp01(
      setOverlap(dateValues, new Set(`${meta} ${text}`.match(DATE_RE) ?? [])),
    ),
    canonical_key_match: canonicalKey && queryCompact.includes(canonicalKey)
      ? 1
      : 0,
    query_intent_match: queryIntentMatch(q, row),
    content_domain_match: queryIntentMatch(q, row),
    legal_domain_match: legalDomainMatch(q, row),
    authority_level: authority(row),
    jurisdiction_match: /հայաստան|հհ|armenia|arlis|echr|ecthr/iu.test(
        `${row.source} ${row.title} ${meta}`,
      )
      ? 1
      : 0.5,
    document_type_match: documentTypeMatch(q, row),
    source_type_match: isOfficialSource ? 1 : 0.5,
    current_version_signal: row.norm_status === "active" ? 1 : 0,
    norm_status_signal: row.norm_status === "active"
      ? 1
      : row.norm_status === "unknown"
      ? 0.5
      : 0,
    status_eligibility: statusEligible(row, context.statusScope) ? 1 : 0,
    effective_date_validity: effectiveAtValid(row, context.effectiveAt) ? 1 : 0,
    specific_provision_bonus:
      row.citation_anchor || row.citation_metadata?.legal_unit_number ? 1 : 0,
    source_quality: isOfficialSource ? 1 : 0.55,
    chunk_quality: clamp01(
      lengthQuality * (0.5 + 0.5 * clamp01(armenianCount / letterCount)),
    ),
    text_completeness: clamp01(
      0.6 * lengthQuality + 0.2 * (endsCleanly ? 1 : 0) +
        0.2 * (row.title?.trim() ? 1 : 0),
    ),
    exact_duplicate_penalty: clamp01(
      ((context.exactDuplicateCount ?? 1) - 1) / 3,
    ),
    near_duplicate_penalty: clamp01(
      ((context.duplicateCount ?? 1) - 1) / 3,
    ),
    document_repetition_penalty: clamp01(
      ((context.documentCount ?? 1) - 1) / 3,
    ),
    source_diversity_bonus: (context.sourceCount ?? 1) === 1 ? 1 : 0,
  };
}

export function scoreFeatureVector(
  features: LegalFeatureVector,
  weights: LegalFeatureWeights,
): number {
  let score = 0;
  let positiveWeight = 0;
  for (const name of LEGAL_FEATURE_NAMES) {
    score += features[name] * weights[name];
    if (weights[name] > 0) positiveWeight += weights[name];
  }
  return clamp01(score / Math.max(positiveWeight, Number.EPSILON));
}

export function scoreLegalCandidates(
  query: string,
  rows: MetricCorpusRow[],
  options: {
    statusScope: StatusScope;
    effectiveAt?: string | null;
    weights?: LegalFeatureWeights;
  },
): LegalScoredRow[] {
  const duplicateCounts = new Map<string, number>();
  const exactDuplicateCounts = new Map<string, number>();
  const documentCounts = new Map<string, number>();
  const sourceCounts = new Map<string, number>();
  for (const row of rows) {
    duplicateCounts.set(
      row.duplicate_group,
      (duplicateCounts.get(row.duplicate_group) ?? 0) + 1,
    );
    const exactKey = compact(row.chunk_text);
    exactDuplicateCounts.set(
      exactKey,
      (exactDuplicateCounts.get(exactKey) ?? 0) + 1,
    );
    documentCounts.set(
      row.document_id,
      (documentCounts.get(row.document_id) ?? 0) + 1,
    );
    const source = row.source ?? "unknown";
    sourceCounts.set(source, (sourceCounts.get(source) ?? 0) + 1);
  }
  const weights = options.weights ?? DEV_CALIBRATED_WEIGHTS;
  return rows.map((row) => {
    const features = buildLegalFeatures(query, row, {
      statusScope: options.statusScope,
      effectiveAt: options.effectiveAt,
      duplicateCount: duplicateCounts.get(row.duplicate_group),
      exactDuplicateCount: exactDuplicateCounts.get(compact(row.chunk_text)),
      documentCount: documentCounts.get(row.document_id),
      sourceCount: sourceCounts.get(row.source ?? "unknown"),
    });
    return {
      row,
      features,
      deterministic_score: scoreFeatureVector(features, weights),
      status_eligible: features.status_eligibility === 1,
      legal_status_warning: row.legal_status_warning,
      reason_codes: [
        ...(features.status_eligibility === 1 ? [] : ["STATUS_INELIGIBLE"]),
        ...(features.effective_date_validity === 1
          ? []
          : ["EFFECTIVE_DATE_INVALID"]),
      ],
    };
  });
}
