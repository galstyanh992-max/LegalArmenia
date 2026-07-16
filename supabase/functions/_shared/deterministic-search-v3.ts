import type { MetricCorpusRow } from "./metric-search.ts";
import type { StatusScope } from "./rag-types.ts";
import { buildTrustedCitationMetadata } from "./legal-citation-metadata.ts";
import { sanitizeRankingText, type RankingSanitizationResult } from "./injection-sanitizer.ts";
import { matchProvisionLane, type ProvisionLaneMatch } from "./provision-retrieval-lane.ts";
import { parseLegalProvision, provisionSpecificity } from "./legal-provision-parser.ts";
import { rankDeterministicV2, routeLegalIntent } from "./deterministic-search-v2.ts";

export interface DeterministicV3Options {
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
}

export interface DeterministicV3Row {
  row: MetricCorpusRow;
  ranking_text: string;
  display_text: string;
  final_score: number;
  provision_match: ProvisionLaneMatch;
  sanitization: RankingSanitizationResult;
  reason_codes: string[];
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function effectiveValid(row: MetricCorpusRow, at?: string | null): boolean {
  if (!at) return true;
  const target = Date.parse(at);
  if (!Number.isFinite(target)) return false;
  const from = row.effective_from ? Date.parse(row.effective_from) : -Infinity;
  const to = row.effective_to ? Date.parse(row.effective_to) : Infinity;
  return target >= from && target < to;
}

function statusEligible(row: MetricCorpusRow, scope: StatusScope): boolean {
  if (row.status_eligible !== true) return false;
  if (scope === "current") return row.norm_status === "active";
  if (scope === "extended") return row.norm_status === "active" || row.norm_status === "unknown";
  return ["active", "unknown", "repealed"].includes(row.norm_status);
}

function metadataConfidence(value: "high" | "medium" | "low"): number {
  return value === "high" ? 1 : value === "medium" ? 0.55 : 0.2;
}

function trustedAuthority(row: MetricCorpusRow): number {
  const metadata = buildTrustedCitationMetadata(row);
  const authority = String(metadata.authority ?? "").toLocaleLowerCase();
  if (/constitutional|սահմանադրական/.test(authority)) return 1;
  if (/cassation|վճռաբեկ|echr|ecthr/.test(authority)) return 0.9;
  if (/court|դատարան|суд/.test(authority)) return 0.72;
  return /arlis\.am/iu.test(metadata.sourceUrl ?? row.source ?? "") ? 0.82 : 0.45;
}

function collapse(rows: DeterministicV3Row[], limit: number): DeterministicV3Row[] {
  const result: DeterministicV3Row[] = [];
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

export function rankDeterministicV3(
  query: string,
  rows: MetricCorpusRow[],
  options: DeterministicV3Options,
): DeterministicV3Row[] {
  const eligible = rows.filter((row) => statusEligible(row, options.statusScope) && effectiveValid(row, options.effectiveAt));
  const prepared = eligible.map((row) => {
    const sanitization = options.injectionSanitization === false
      ? {
        instruction_like_score: 0,
        sanitized_ranking_text: row.chunk_text,
        removed_segments: [],
        legal_imperative_preserved: true,
        sanitizer_version: "legal-ranking-sanitizer-v3" as const,
      }
      : sanitizeRankingText(row.chunk_text);
    return { row, sanitization, scoringRow: { ...row, chunk_text: sanitization.sanitized_ranking_text } };
  });
  const base = new Map(rankDeterministicV2(query, prepared.map((item) => item.scoringRow), {
    statusScope: options.statusScope,
    effectiveAt: options.effectiveAt,
    limit: Math.max(20, prepared.length),
    injectionDefense: false,
    duplicateCollapse: false,
  }).map((item) => [item.row.chunk_id, item.final_score]));
  const intent = routeLegalIntent(query);
  const ranked = prepared.map(({ row, sanitization }) => {
    const trusted = buildTrustedCitationMetadata(row);
    let provision = matchProvisionLane(query, row);
    if (options.trustedMetadataRestrictions === false && provision.identifier_match_type === "NONE") {
      const queryProvision = parseLegalProvision(query);
      const forgedBodyProvision = parseLegalProvision(row.chunk_text, { trustedStructure: true });
      if (
        queryProvision.article && queryProvision.article === forgedBodyProvision.article &&
        (!queryProvision.part || queryProvision.part === forgedBodyProvision.part) &&
        (!queryProvision.point || queryProvision.point === forgedBodyProvision.point)
      ) {
        provision = {
          identifier_match_type: queryProvision.part ? "EXACT_ARTICLE_PART" : "EXACT_ARTICLE",
          identifier_match_score: 1,
          provision_key: forgedBodyProvision.provision_key,
          metadata_confidence: "low",
        };
      }
    }
    const exactBoost = options.exactProvisionLane === false ? 0 : provision.identifier_match_score * 0.48;
    const confidence = options.metadataConfidence === false ? 0 : metadataConfidence(trusted.metadataConfidence) * 0.000001;
    const specificity = options.specificity === false || !trusted.provisionKey
      ? 0
      : provisionSpecificity({
        article: trusted.article ?? "", part: trusted.part ?? "", point: trusted.point ?? "",
        subpoint: trusted.subpoint ?? "", chapter: trusted.chapter ?? "", section: trusted.section ?? "",
        range_end: "", provision_key: trusted.provisionKey, confidence: 1,
      }) * 0.000001;
    const authority = options.authority === false ? 0 : trustedAuthority(row) * 0.000001;
    const historical = intent.intent === "historical_law" && row.norm_status === "repealed" ? 0.08 : 0;
    const instructionPenalty = options.instructionPenalty === false ? 0 : sanitization.instruction_like_score * 0.72;
    const retrieval = base.get(row.chunk_id) ?? 0;
    const finalScore = clamp(retrieval + exactBoost + confidence + specificity + authority + historical - instructionPenalty);
    return {
      row,
      ranking_text: sanitization.sanitized_ranking_text,
      display_text: row.chunk_text,
      final_score: finalScore,
      provision_match: provision,
      sanitization,
      reason_codes: [
        provision.identifier_match_type !== "NONE" ? provision.identifier_match_type : "SEMANTIC_FALLBACK",
        `METADATA_${trusted.metadataConfidence.toUpperCase()}`,
        ...(sanitization.instruction_like_score ? ["INSTRUCTION_LIKE_PENALTY"] : []),
        ...(historical ? ["HISTORICAL_VERSION_PREFERENCE"] : []),
      ],
    };
  }).sort((a, b) => {
    const laneA = options.exactProvisionLane === false ? 0 : a.provision_match.identifier_match_score;
    const laneB = options.exactProvisionLane === false ? 0 : b.provision_match.identifier_match_score;
    return laneB - laneA || b.final_score - a.final_score || a.row.chunk_id.localeCompare(b.row.chunk_id);
  });
  return options.duplicateCollapse === false
    ? ranked.slice(0, options.limit ?? 20)
    : collapse(ranked, options.limit ?? 20);
}

export function decideNoAnswerV3(query: string, rows: DeterministicV3Row[]) {
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
  return {
    answerable: reasons.length === 0,
    reasons,
    support_score: top?.final_score ?? 0,
    support_count: supported,
  };
}
