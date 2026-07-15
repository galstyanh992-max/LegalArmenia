import type { MetricCorpusRow } from "../../supabase/functions/_shared/metric-search.ts";
import type { StatusScope } from "../../supabase/functions/_shared/rag-types.ts";
import {
  decideNoAnswerV2,
  rankDeterministicV2,
} from "../../supabase/functions/_shared/deterministic-search-v2.ts";
import { scoreLegalCandidates } from "../../supabase/functions/_shared/legal-feature-scorer.ts";

type Gold = {
  query_id: string;
  query: string;
  intent: string;
  status_scope: StatusScope;
  effective_at: string | null;
  expected_document_ids: string[];
  expected_chunk_ids: string[];
  expected_provisions: string[];
  graded_relevance: Record<string, number>;
  answerable: boolean;
  split: string;
};
type Candidate = {
  candidate_id: string;
  chunk_id: string;
  document_id: string;
  text: string;
  title: string;
  source?: string | null;
  source_url?: string | null;
  citation_anchor?: string | null;
  content_domain: "knowledge_base" | "practice" | "unknown";
  norm_status: string;
  effective_from: string | null;
  effective_to: string | null;
  metric_cosine_similarity: number;
  fts_score: number;
  fts_rank: number | null;
  identifier_match: number;
  identifier_rank: number | null;
  ann_rank: number | null;
  rrf_score: number;
  duplicate_group: string;
  citation_metadata: Record<string, unknown>;
};
type Pool = { query_id: string; candidates: Candidate[] };

function args() {
  const out: Record<string, string> = {};
  for (let i = 0; i < Deno.args.length; i++) {
    if (Deno.args[i].startsWith("--")) {
      out[Deno.args[i].slice(2)] = Deno.args[++i];
    }
  }
  return out;
}
async function jsonl<T>(path: string): Promise<T[]> {
  return (await Deno.readTextFile(path)).split(/\r?\n/).filter(Boolean).map((
    line,
  ) => JSON.parse(line));
}
function eligible(status: string, scope: StatusScope) {
  return scope === "current"
    ? status === "active"
    : scope === "extended"
    ? ["active", "unknown"].includes(status)
    : ["active", "unknown", "repealed"].includes(status);
}
function metric(c: Candidate, scope: StatusScope): MetricCorpusRow {
  return {
    chunk_id: c.chunk_id,
    document_id: c.document_id,
    version_id: c.document_id,
    chunk_text: c.text,
    title: c.title,
    source: c.source ?? null,
    language: "hy",
    content_domain: c.content_domain,
    norm_status: c.norm_status,
    effective_from: c.effective_from,
    effective_to: c.effective_to,
    status_scope: scope,
    status_eligible: eligible(c.norm_status, scope),
    legal_status_warning: c.norm_status === "unknown"
      ? "UNCONFIRMED_STATUS"
      : c.norm_status === "repealed"
      ? "REPEALED_HISTORICAL"
      : null,
    status_reason_code: c.norm_status,
    vector_similarity: c.metric_cosine_similarity,
    fts_rank: c.fts_score,
    identifier_match: c.identifier_match,
    identifier_rank: c.identifier_rank,
    ann_rank: c.ann_rank,
    fts_rank_position: c.fts_rank,
    rrf_score: c.rrf_score,
    duplicate_group: c.duplicate_group,
    source_url: c.source_url ?? null,
    citation_anchor: c.citation_anchor ?? null,
    citation_metadata: c.citation_metadata,
  };
}
function pct(values: number[], q: number) {
  const s = [...values].sort((a, b) => a - b);
  if (!s.length) return 0;
  return s[Math.min(s.length - 1, Math.floor((s.length - 1) * q))];
}
function dcg(v: number[]) {
  return v.reduce((s, r, i) => s + (2 ** r - 1) / Math.log2(i + 2), 0);
}

const o = args();
const golds = (await jsonl<Gold>(o.gold)).filter((g) =>
  !o.split || o.split === "all" || g.split === o.split
);
const pools = new Map((await jsonl<Pool>(o.pools)).map((p) => [p.query_id, p]));
const variant = o.variant ?? "v2";
let r5 = 0,
  r10 = 0,
  r20 = 0,
  p5 = 0,
  mrr = 0,
  ndcg = 0,
  citDoc = 0,
  citProv = 0,
  contam = 0,
  warning = 0,
  warningN = 0,
  naFp = 0,
  naFn = 0,
  injection = 0,
  injectionN = 0,
  diversity = 0;
const lat: number[] = [];
const failed: Array<Record<string, unknown>> = [];
const runs: Array<Record<string, unknown>> = [];
const answerable = golds.filter((g) => g.answerable);
for (const g of golds) {
  const pool = pools.get(g.query_id)!;
  const rows = pool.candidates.map((c) => metric(c, g.status_scope)).filter(
    (r) => variant === "without_status_temporal" || r.status_eligible,
  );
  const start = performance.now();
  let ranked: MetricCorpusRow[];
  if (variant === "v1") {
    ranked = scoreLegalCandidates(g.query, rows, {
      statusScope: g.status_scope,
      effectiveAt: g.effective_at,
    }).sort((a, b) => b.deterministic_score - a.deterministic_score).slice(
      0,
      20,
    ).map((x) => x.row);
  } else {ranked = rankDeterministicV2(g.query, rows, {
      statusScope: g.status_scope,
      effectiveAt: g.effective_at,
      limit: 20,
      injectionDefense: variant !== "without_injection",
      specificityAuthority: variant !== "without_specificity_authority",
      identifierFeatures: variant !== "without_identifier",
      duplicateCollapse: variant !== "without_duplicate_collapse",
    }).map((x) => x.row);}
  const decision = variant === "v1"
    ? { answerable: ranked.length > 0, reasons: [] }
    : decideNoAnswerV2(
      g.query,
      rankDeterministicV2(g.query, rows, {
        statusScope: g.status_scope,
        limit: 20,
        injectionDefense: variant !== "without_injection",
        specificityAuthority: variant !== "without_specificity_authority",
        identifierFeatures: variant !== "without_identifier",
        duplicateCollapse: variant !== "without_duplicate_collapse",
      }),
      g.status_scope,
    );
  if (!decision.answerable) ranked = [];
  lat.push(performance.now() - start);
  if (g.answerable && !ranked.length) naFn++;
  if (!g.answerable && ranked.length) naFp++;
  const docs = new Set(g.expected_document_ids);
  const hit = (k: number) =>
    ranked.slice(0, k).some((c) => docs.has(c.document_id)) ? 1 : 0;
  if (g.answerable) {
    r5 += hit(5);
    r10 += hit(10);
    r20 += hit(20);
    p5 += ranked.slice(0, 5).filter((c) => docs.has(c.document_id)).length / 5;
    const first = ranked.findIndex((c) => docs.has(c.document_id));
    if (first >= 0) mrr += 1 / (first + 1);
    const rel = ranked.slice(0, 10).map((c) =>
      g.graded_relevance[c.chunk_id] ?? (docs.has(c.document_id) ? 3 : 0)
    );
    const ideal = Object.values(g.graded_relevance).sort((a, b) => b - a).slice(
      0,
      10,
    );
    ndcg += ideal.length ? dcg(rel) / Math.max(dcg(ideal), Number.EPSILON) : 0;
    const top = ranked[0];
    const docOk = !!top && docs.has(top.document_id);
    citDoc += docOk ? 1 : 0;
    const citation = `${top?.citation_anchor ?? ""} ${
      top?.citation_metadata?.document_number ?? ""
    }`.toLocaleLowerCase();
    const provOk = !g.expected_provisions.length ||
      g.expected_provisions.some((p) =>
        citation.includes(p.toLocaleLowerCase())
      );
    citProv += provOk ? 1 : 0;
    if (!docOk || !provOk) {
      failed.push({
        query_id: g.query_id,
        top_chunk_id: top?.chunk_id ?? null,
        document_correct: docOk,
        provision_correct: provOk,
      });
    }
    if (
      g.status_scope === "current" &&
      ranked.slice(0, 10).some((c) => c.norm_status !== "active")
    ) contam++;
    const noncurrent = ranked.find((c) =>
      docs.has(c.document_id) && c.norm_status !== "active"
    );
    if (noncurrent) {
      warningN++;
      if (["unknown", "repealed"].includes(noncurrent.norm_status)) warning++;
    }
    diversity += new Set(ranked.slice(0, 10).map((c) => c.document_id)).size /
      Math.max(1, Math.min(10, ranked.length));
  }
  if (g.query_id.startsWith("INJECTION-")) {
    injectionN++;
    if (ranked[0] && docs.has(ranked[0].document_id)) injection++;
  }
  runs.push({
    query_id: g.query_id,
    ranking: ranked.map((r) => r.chunk_id),
    no_answer: !decision.answerable,
    reasons: decision.reasons,
    support_score: "support_score" in decision ? decision.support_score : null,
  });
}
const n = Math.max(1, answerable.length),
  noN = Math.max(1, golds.filter((g) => !g.answerable).length);
const metrics = {
  query_count: golds.length,
  recall_at_5: r5 / n,
  recall_at_10: r10 / n,
  recall_at_20: r20 / n,
  precision_at_5: p5 / n,
  mrr: mrr / n,
  ndcg_at_10: ndcg / n,
  citation_document_accuracy: citDoc / n,
  citation_provision_accuracy: citProv / n,
  current_law_contamination: contam / n,
  unknown_repealed_warning_accuracy: warningN ? warning / warningN : 1,
  no_answer_false_answer_rate: naFp / noN,
  no_answer_false_noanswer_rate: naFn / n,
  injection_pass_rate: injectionN ? injection / injectionN : 1,
  duplicate_diversity: diversity / n,
  latency_ms: { p50: pct(lat, .5), p95: pct(lat, .95), p99: pct(lat, .99) },
  cross_tenant_leakage: null,
};
await Deno.writeTextFile(
  o.output,
  JSON.stringify(
    { variant, split: o.split ?? "all", metrics, failed_queries: failed, runs },
    null,
    2,
  ) + "\n",
);
console.log(JSON.stringify({ variant, split: o.split, metrics }, null, 2));
