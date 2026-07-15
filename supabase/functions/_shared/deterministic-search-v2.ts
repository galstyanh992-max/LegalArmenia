import type { MetricCorpusRow } from "./metric-search.ts";
import type { StatusScope } from "./rag-types.ts";
import {
  isPromptManipulation,
  parseLegalProvision,
  provisionSpecificity,
} from "./legal-provision-parser.ts";
import { scoreLegalCandidates } from "./legal-feature-scorer.ts";

export type LegalIntent =
  | "exact_citation"
  | "current_law"
  | "broad_research"
  | "historical_law"
  | "case_law"
  | "procedural"
  | "article_comparison"
  | "name_date_case"
  | "unsupported";

export type IdentifierMatchLevel =
  | "EXACT_FULL_PROVISION"
  | "EXACT_ARTICLE"
  | "EXACT_DOCUMENT_NUMBER"
  | "EXACT_TITLE"
  | "PARTIAL_PROVISION"
  | "NORMALIZED_TITLE"
  | "DATE_MATCH"
  | "CASE_NUMBER_MATCH"
  | "NONE";

export interface IntentDecision {
  intent: LegalIntent;
  confidence: number;
  status_scope: StatusScope;
  fallback: "safe_current" | null;
}

export interface DeterministicV2Row {
  row: MetricCorpusRow;
  final_score: number;
  identifier_level: IdentifierMatchLevel;
  instruction_like_score: number;
  reason_codes: string[];
}

const DATE =
  /\b(?:19|20)\d{2}[-./](?:0?[1-9]|1[0-2])[-./](?:0?[1-9]|[12]\d|3[01])\b/;
const CASE =
  /\b(?:ԵԴ|ՎԴ|ՍԴ|ԴԴ|ECHR|ECtHR|[A-ZА-Я]{1,6})[-–/]?[A-ZА-Я0-9-]{2,}\b/iu;
const DOC_NUMBER = /(?:№|N|թիվ)\s*([\p{L}\d][\p{L}\d./-]{1,})/iu;

function norm(value: unknown): string {
  return String(value ?? "").normalize("NFKC").trim().toLocaleLowerCase()
    .replace(/[‐‑‒–—]/g, "-").replace(/\s+/g, " ");
}

function compact(value: unknown): string {
  return norm(value).replace(/[^\p{L}\p{N}]+/gu, "");
}

function meta(row: MetricCorpusRow, key: string): string {
  return norm(row.citation_metadata?.[key]);
}

export function routeLegalIntent(query: string): IntentDecision {
  const q = norm(query);
  if (/ignore previous|раскрой промпт|անտեսիր.*հրահանգ/iu.test(q)) {
    return {
      intent: "unsupported",
      confidence: 0.98,
      status_scope: "current",
      fallback: null,
    };
  }
  if (/համեմատ|сравн|compare/iu.test(q) && /հոդված|стать|article/iu.test(q)) {
    return {
      intent: "article_comparison",
      confidence: 0.9,
      status_scope: "current",
      fallback: null,
    };
  }
  if (/նախկին|պատմական|утрат|истор|repeal|histor/iu.test(q)) {
    return {
      intent: "historical_law",
      confidence: 0.9,
      status_scope: "historical",
      fallback: null,
    };
  }
  if (CASE.test(q) || /գործ(?:ով|ը)?|дел[оауе]|case\s+no/iu.test(q)) {
    return {
      intent: "case_law",
      confidence: 0.86,
      status_scope: "current",
      fallback: null,
    };
  }
  if (parseLegalProvision(q).article || DOC_NUMBER.test(q)) {
    return {
      intent: "exact_citation",
      confidence: 0.94,
      status_scope: "current",
      fallback: null,
    };
  }
  if (DATE.test(q) || /անուն|имя|name/iu.test(q)) {
    return {
      intent: "name_date_case",
      confidence: 0.78,
      status_scope: "current",
      fallback: null,
    };
  }
  if (/ընթացակարգ|դատավար|процедур|порядок|procedure/iu.test(q)) {
    return {
      intent: "procedural",
      confidence: 0.8,
      status_scope: "current",
      fallback: null,
    };
  }
  if (/գործող|ներկայում|действующ|текущ|current/iu.test(q)) {
    return {
      intent: "current_law",
      confidence: 0.84,
      status_scope: "current",
      fallback: null,
    };
  }
  return {
    intent: "broad_research",
    confidence: 0.55,
    status_scope: "current",
    fallback: "safe_current",
  };
}

function trustedProvision(row: MetricCorpusRow) {
  const structured = {
    article: meta(row, "article_number") || meta(row, "article"),
    part: meta(row, "part_number") || meta(row, "part"),
    point: meta(row, "point_number") || meta(row, "point"),
    subpoint: meta(row, "subpoint_number") || meta(row, "subpoint"),
  };
  if (Object.values(structured).some(Boolean)) {
    const provision_key = [
      structured.article && `a:${structured.article}`,
      structured.part && `p:${structured.part}`,
      structured.point && `pt:${structured.point}`,
      structured.subpoint && `sp:${structured.subpoint}`,
    ].filter(Boolean).join("/");
    return {
      ...structured,
      chapter: "",
      section: "",
      range_end: "",
      provision_key,
      confidence: 1,
    };
  }
  return parseLegalProvision(`${row.citation_anchor ?? ""}`, {
    trustedStructure: true,
  });
}

export function identifierMatchLevel(
  query: string,
  row: MetricCorpusRow,
): IdentifierMatchLevel {
  const q = norm(query);
  const qp = parseLegalProvision(q);
  const rp = trustedProvision(row);
  const full = Boolean(
    qp.article && qp.article === rp.article &&
      (!qp.part || qp.part === rp.part) &&
      (!qp.point || qp.point === rp.point) &&
      (!qp.subpoint || qp.subpoint === rp.subpoint),
  );
  if (full && (qp.part || qp.point || qp.subpoint)) {
    return "EXACT_FULL_PROVISION";
  }
  if (qp.article && qp.article === rp.article) return "EXACT_ARTICLE";
  const requestedNumber = compact(DOC_NUMBER.exec(q)?.[1]);
  if (
    requestedNumber && requestedNumber === compact(meta(row, "document_number"))
  ) return "EXACT_DOCUMENT_NUMBER";
  if (q && q === norm(row.title)) return "EXACT_TITLE";
  if (qp.article && rp.article) return "PARTIAL_PROVISION";
  const title = compact(row.title);
  if (title.length >= 8 && compact(q).includes(title)) {
    return "NORMALIZED_TITLE";
  }
  const date = DATE.exec(q)?.[0];
  if (
    date &&
    [meta(row, "issued_date"), norm(row.effective_from), norm(row.effective_to)]
      .includes(norm(date))
  ) return "DATE_MATCH";
  const caseNumber = CASE.exec(q)?.[0];
  if (
    caseNumber &&
    compact([meta(row, "case_number"), meta(row, "decision_number")].join(" "))
      .includes(compact(caseNumber))
  ) return "CASE_NUMBER_MATCH";
  return "NONE";
}

const IDENTIFIER_WEIGHT: Record<IdentifierMatchLevel, number> = {
  EXACT_FULL_PROVISION: 1,
  EXACT_ARTICLE: 0.9,
  EXACT_DOCUMENT_NUMBER: 0.86,
  EXACT_TITLE: 0.82,
  PARTIAL_PROVISION: 0.42,
  NORMALIZED_TITLE: 0.7,
  DATE_MATCH: 0.45,
  CASE_NUMBER_MATCH: 0.78,
  NONE: 0,
};

function authority(row: MetricCorpusRow): number {
  const trusted = norm(meta(row, "authority"));
  const source = norm(`${row.source ?? ""} ${row.source_url ?? ""}`);
  if (/constitutional|սահմանադրական/.test(trusted)) return 1;
  if (/cassation|վճռաբեկ|echr|ecthr/.test(trusted)) return 0.9;
  if (/arlis\.am|arlis/.test(source)) return 0.82;
  if (/court|դատարան|суд/.test(trusted)) return 0.7;
  return 0.45;
}

function instructionScore(row: MetricCorpusRow): number {
  return isPromptManipulation(row.chunk_text) ? 1 : 0;
}

function collapse(
  rows: DeterministicV2Row[],
  limit: number,
): DeterministicV2Row[] {
  const output: DeterministicV2Row[] = [];
  const duplicates = new Set<string>();
  const provisions = new Set<string>();
  const documents = new Map<string, number>();
  for (const item of rows) {
    if (output.length >= limit) break;
    const duplicate = compact(item.row.chunk_text);
    const provision = `${item.row.document_id}:${
      trustedProvision(item.row).provision_key
    }`;
    if (
      duplicates.has(duplicate) ||
      (provision.endsWith(":") === false && provisions.has(provision))
    ) continue;
    if ((documents.get(item.row.document_id) ?? 0) >= 2) continue;
    duplicates.add(duplicate);
    if (!provision.endsWith(":")) provisions.add(provision);
    documents.set(
      item.row.document_id,
      (documents.get(item.row.document_id) ?? 0) + 1,
    );
    output.push(item);
  }
  return output;
}

export function rankDeterministicV2(
  query: string,
  rows: MetricCorpusRow[],
  options: {
    statusScope: StatusScope;
    effectiveAt?: string | null;
    limit?: number;
    injectionDefense?: boolean;
    specificityAuthority?: boolean;
    identifierFeatures?: boolean;
    duplicateCollapse?: boolean;
  },
): DeterministicV2Row[] {
  const intent = routeLegalIntent(query);
  const base = scoreLegalCandidates(query, rows, {
    statusScope: options.statusScope,
    effectiveAt: options.effectiveAt,
  });
  const ranked = base.map((item) => {
    const identifier = identifierMatchLevel(query, item.row);
    const instruction = instructionScore(item.row);
    const specificity = provisionSpecificity(trustedProvision(item.row));
    const authorityScore = authority(item.row);
    const official = /arlis\.am|arlis/iu.test(
        `${item.row.source ?? ""} ${item.row.source_url ?? ""}`,
      )
      ? 1
      : 0;
    const identifierBoost = (options.identifierFeatures === false
      ? 0
      : IDENTIFIER_WEIGHT[identifier]) *
      (intent.intent === "exact_citation" ? 0.34 : 0.2);
    const structureBoost = options.specificityAuthority === false
      ? 0
      : 0.1 * specificity + 0.08 * authorityScore + 0.04 * official;
    const penalty = options.injectionDefense === false ? 0 : 0.55 * instruction;
    const final = Math.max(
      0,
      Math.min(
        1,
        0.56 * item.deterministic_score + identifierBoost + structureBoost -
          penalty,
      ),
    );
    return {
      row: item.row,
      final_score: final,
      identifier_level: identifier,
      instruction_like_score: instruction,
      reason_codes: [
        identifier !== "NONE" ? identifier : "SEMANTIC_FALLBACK",
        ...(specificity ? ["SPECIFIC_PROVISION"] : []),
        ...(official ? ["OFFICIAL_SOURCE"] : []),
        ...(instruction ? ["PROMPT_MANIPULATION_PENALTY"] : []),
      ],
    };
  }).sort((a, b) =>
    b.final_score - a.final_score ||
    a.row.chunk_id.localeCompare(b.row.chunk_id)
  );
  return options.duplicateCollapse === false
    ? ranked.slice(0, options.limit ?? 20)
    : collapse(ranked, options.limit ?? 20);
}

export function decideNoAnswerV2(
  query: string,
  rows: DeterministicV2Row[],
  scope: StatusScope,
) {
  const top = rows[0];
  const exact = routeLegalIntent(query).intent === "exact_citation";
  const supportCount =
    rows.slice(0, 5).filter((row) => row.final_score >= 0.22).length;
  const identifierSupport = rows.some((row) => row.identifier_level !== "NONE");
  const eligible = rows.filter((row) =>
    scope !== "current" || row.row.norm_status === "active"
  );
  const reasons: string[] = [];
  if (!top || !eligible.length) reasons.push("NO_ELIGIBLE_EVIDENCE");
  if (top && top.final_score < 0.22) reasons.push("WEAK_EVIDENCE");
  if (exact && !identifierSupport && (!top || top.final_score < 0.22)) {
    reasons.push("EXACT_IDENTIFIER_ABSENT");
  }
  if (supportCount === 0) reasons.push("NO_TOP_K_SUPPORT");
  return {
    answerable: reasons.length === 0,
    reasons,
    support_score: top?.final_score ?? 0,
    support_count: supportCount,
    identifier_support: identifierSupport,
  };
}
