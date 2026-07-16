// =============================================================================
// Prompt 19.7 Phase 16: Deterministic Scorer V4
// Additive — extends V3 with structured metadata, PDF page mapping, version
// validity, authority taxonomy, canonical source, and duplicate grouping.
// Does NOT modify deterministic-search-v2.ts or deterministic-search-v3.ts.
// =============================================================================

import type { MetricCorpusRow } from "./metric-search.ts";
import type { MetricV3CorpusRow } from "./metric-search-v3.ts";
import type { StatusScope } from "./rag-types.ts";
import { buildTrustedCitationMetadata } from "./legal-citation-metadata.ts";
import { sanitizeRankingText, type RankingSanitizationResult } from "./injection-sanitizer.ts";
import { matchProvisionLane, type ProvisionLaneMatch } from "./provision-retrieval-lane.ts";
import { parseLegalProvision, provisionSpecificity } from "./legal-provision-parser.ts";
import { rankDeterministicV3 } from "./deterministic-search-v3.ts";

export interface DeterministicV4Options {
  statusScope: StatusScope;
  effectiveAt?: string | null;
  limit?: number;
  exactProvisionLane?: boolean;
  metadataConfidence?: boolean;
  injectionSanitization?: boolean;
  instructionPenalty?: boolean;
  specificity?: boolean;
  authority?: boolean;
  duplicateCollapse?: boolean;
  trustedMetadataRestrictions?: boolean;
  // V4-specific options
  pageMappingBoost?: boolean;
  versionValidityGuard?: boolean;
  authorityTaxonomyBoost?: boolean;
  canonicalSourcePreference?: boolean;
}

export interface DeterministicV4Row {
  row: MetricCorpusRow | MetricV3CorpusRow;
  ranking_text: string;
  display_text: string;
  final_score: number;
  provision_match: ProvisionLaneMatch;
  sanitization: RankingSanitizationResult;
  reason_codes: string[];
  // V4-specific fields
  page_mapping_score: number;
  version_validity_score: number;
  authority_score: number;
  canonical_source_score: number;
  metadata_confidence_level: string;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function effectiveValid(row: MetricCorpusRow | MetricV3CorpusRow, at?: string | null): boolean {
  if (!at) return true;
  const target = Date.parse(at);
  if (!Number.isFinite(target)) return false;
  const from = row.effective_from ? Date.parse(row.effective_from) : -Infinity;
  const to = row.effective_to ? Date.parse(row.effective_to) : Infinity;
  return target >= from && target < to;
}

function statusEligible(row: MetricCorpusRow | MetricV3CorpusRow, scope: StatusScope): boolean {
  if ((row as any).status_eligible !== true) return false;
  const status = row.norm_status;
  if (scope === "current") return status === "active";
  if (scope === "extended") return status === "active" || status === "unknown";
  return ["active", "unknown", "repealed"].includes(status);
}

function getMetadataConfidence(row: MetricCorpusRow | MetricV3CorpusRow): "high" | "medium" | "low" {
  const v3 = row as MetricV3CorpusRow;
  if (v3.metadata_confidence) {
    return v3.metadata_confidence as "high" | "medium" | "low";
  }
  const trusted = buildTrustedCitationMetadata(row as MetricCorpusRow);
  return trusted.metadataConfidence;
}

function getAuthorityType(row: MetricCorpusRow | MetricV3CorpusRow): string {
  const v3 = row as MetricV3CorpusRow;
  if (v3.authority_type) return v3.authority_type;
  const trusted = buildTrustedCitationMetadata(row as MetricCorpusRow);
  return String(trusted.authority ?? "").toLocaleLowerCase();
}

function authorityScore(authority: string): number {
  const a = authority.toLocaleLowerCase();
  if (a.includes("constitution") || a.includes("constitutional")) return 1.0;
  if (a.includes("code") || a.includes("law")) return 0.85;
  if (a.includes("government") || a.includes("ministerial")) return 0.70;
  if (a.includes("court") || a.includes("cassation")) return 0.75;
  if (a.includes("echr") || a.includes("european")) return 0.65;
  if (a.includes("municipal") || a.includes("council")) return 0.50;
  return 0.30;
}

function canonicalSourceScore(row: MetricCorpusRow | MetricV3CorpusRow): number {
  const source = (row as any).source ?? "";
  const sourceUrl = (row as any).source_url ?? "";
  // Prefer official ARLIS source
  if (source === "arlis" || sourceUrl?.includes("arlis.am")) return 1.0;
  if (source === "echr") return 0.80;
  if (source === "armenian_legal") return 0.70;
  return 0.50;
}

function pageMappingScore(row: MetricCorpusRow | MetricV3CorpusRow): number {
  const v3 = row as MetricV3CorpusRow;
  if (v3.page_from_physical != null) return 1.0;
  // Fall back to search_chunks page_from
  const sc = row as any;
  if (sc.page_from != null || sc.page_to != null) return 0.50;
  return 0.0;
}

function versionValidityScore(row: MetricCorpusRow | MetricV3CorpusRow, at?: string | null): number {
  if (!at) return 0.5; // neutral when no reference date
  if (effectiveValid(row, at)) return 1.0;
  return 0.0;
}

function metadataConfidenceNumeric(value: "high" | "medium" | "low"): number {
  return value === "high" ? 1.0 : value === "medium" ? 0.55 : 0.2;
}

function collapseV4(rows: DeterministicV4Row[], limit: number): DeterministicV4Row[] {
  const result: DeterministicV4Row[] = [];
  const exactText = new Set<string>();
  const provisions = new Set<string>();
  const perDocument = new Map<string, number>();
  for (const item of rows) {
    if (result.length >= limit) break;
    const textKey = item.ranking_text.normalize("NFKC").replace(/[^\p{L}\p{N}]+/gu, "").toLocaleLowerCase();
    const provisionKey = item.provision_match.provision_key
      ? `${item.row.document_id}:${item.provision_match.provision_key}`
      : "";
    if (exactText.has(textKey) || (provisionKey && provisions.has(provisionKey))) continue;
    if ((perDocument.get(item.row.document_id) ?? 0) >= 2) continue;
    exactText.add(textKey);
    if (provisionKey) provisions.add(provisionKey);
    perDocument.set(item.row.document_id, (perDocument.get(item.row.document_id) ?? 0) + 1);
    result.push(item);
  }
  return result;
}

export function rankDeterministicV4(
  query: string,
  rows: (MetricCorpusRow | MetricV3CorpusRow)[],
  options: DeterministicV4Options,
): DeterministicV4Row[] {
  const eligibleRows = rows.filter((row) => statusEligible(row, options.statusScope) && effectiveValid(row, options.effectiveAt));

  // Use V3 as base ranking
  const v3Rows = eligibleRows as MetricCorpusRow[];
  const v3Ranked = rankDeterministicV3(query, v3Rows, {
    statusScope: options.statusScope,
    effectiveAt: options.effectiveAt,
    limit: Math.max(20, eligibleRows.length),
    exactProvisionLane: options.exactProvisionLane,
    metadataConfidence: options.metadataConfidence,
    injectionSanitization: options.injectionSanitization,
    instructionPenalty: options.instructionPenalty,
    specificity: options.specificity,
    authority: options.authority,
    duplicateCollapse: false,
    trustedMetadataRestrictions: options.trustedMetadataRestrictions,
  });

  const v3Map = new Map(v3Ranked.map((r) => [r.row.chunk_id, r]));

  const ranked = eligibleRows.map((row) => {
    const v3Base = v3Map.get(row.chunk_id);
    const baseScore = v3Base?.final_score ?? 0;

    const sanitization = v3Base?.sanitization ?? {
      instruction_like_score: 0,
      sanitized_ranking_text: (row as any).chunk_text ?? "",
      removed_segments: [],
      legal_imperative_preserved: true,
      sanitizer_version: "legal-ranking-sanitizer-v3" as const,
    };

    const provision = v3Base?.provision_match ?? matchProvisionLane(query, row as MetricCorpusRow);
    const trusted = buildTrustedCitationMetadata(row as MetricCorpusRow);
    const metaConfidence = getMetadataConfidence(row);
    const authType = getAuthorityType(row);

    // V4-specific scores
    const pageScore = options.pageMappingBoost === false ? 0 : pageMappingScore(row) * 0.02;
    const versionScore = options.versionValidityGuard === false ? 0 : versionValidityScore(row, options.effectiveAt) * 0.03;
    const authScore = options.authorityTaxonomyBoost === false ? 0 : authorityScore(authType) * 0.015;
    const canonicalScore = options.canonicalSourcePreference === false ? 0 : canonicalSourceScore(row) * 0.01;
    const metaBoost = metadataConfidenceNumeric(metaConfidence) * 0.005;

    const finalScore = clamp(baseScore + pageScore + versionScore + authScore + canonicalScore + metaBoost);

    return {
      row,
      ranking_text: sanitization.sanitized_ranking_text,
      display_text: (row as any).chunk_text ?? "",
      final_score: finalScore,
      provision_match: provision,
      sanitization,
      reason_codes: [
        ...(v3Base?.reason_codes ?? []),
        `PAGE_MAPPING_${pageScore > 0 ? "PRESENT" : "ABSENT"}`,
        `VERSION_VALIDITY_${versionScore > 0.02 ? "CONFIRMED" : "NEUTRAL"}`,
        `AUTHORITY_${authType || "UNKNOWN"}`,
        `CANONICAL_SOURCE_${canonicalScore > 0.008 ? "PREFERRED" : "NEUTRAL"}`,
        `METADATA_V4_${metaConfidence.toUpperCase()}`,
      ],
      page_mapping_score: pageScore,
      version_validity_score: versionScore,
      authority_score: authScore,
      canonical_source_score: canonicalScore,
      metadata_confidence_level: metaConfidence,
    };
  }).sort((a, b) => {
    const laneA = options.exactProvisionLane === false ? 0 : a.provision_match.identifier_match_score;
    const laneB = options.exactProvisionLane === false ? 0 : b.provision_match.identifier_match_score;
    return laneB - laneA || b.final_score - a.final_score || a.row.chunk_id.localeCompare(b.row.chunk_id);
  });

  return options.duplicateCollapse === false
    ? ranked.slice(0, options.limit ?? 20)
    : collapseV4(ranked, options.limit ?? 20);
}

export function decideNoAnswerV4(query: string, rows: DeterministicV4Row[]) {
  const top = rows[0];
  const supported = rows.slice(0, 5).filter((row) => row.final_score >= 0.2).length;
  const reasons: string[] = [];
  if (!top) reasons.push("NO_ELIGIBLE_EVIDENCE");
  if (top && top.final_score < 0.2) reasons.push("WEAK_EVIDENCE");
  if (!supported) reasons.push("NO_TOP_K_SUPPORT");
  if (
    /(?:^|[^\p{L}\p{N}])[\p{L}]{2,}-\d[\p{L}\p{N}-]*/iu.test(query) &&
    !rows.some((row) => row.provision_match.identifier_match_type !== "NONE")
  ) reasons.push("EXACT_IDENTIFIER_ABSENT");
  // V4: check version validity
  if (top && top.version_validity_score === 0) reasons.push("VERSION_NOT_EFFECTIVE");
  return {
    answerable: reasons.length === 0,
    reasons,
    support_score: top?.final_score ?? 0,
    support_count: supported,
  };
}
