// =============================================================================
// LEGAL RERANKER — deterministic feature-weighted reranker for the RA legal
// corpus, with an optional cross-encoder endpoint hook.
//
// Why: the retrieval RPC returns hybrid candidates (metric vector + BM25/FTS +
// identifier) in raw RPC order. Without a reranker the LLM context is assembled
// in that order, which buries high-authority, temporally-valid sources under
// loosely-related keyword hits. This module re-orders candidates using a
// transparent, auditable feature vector before context assembly.
//
// Design:
//   * Deterministic scorer (default): combines semantic similarity, keyword
//     score, legal authority rank, temporal validity, exact citation/identifier
//     match and language match into a single [0,1] score. All weights are
//     env-configurable and emitted in metadata for the audit.
//   * Cross-encoder hook (optional): if RERANKER_ENDPOINT is set and reachable,
//     the endpoint may re-score the shortlist; on any failure the reranker
//     fails closed to the deterministic score (never to "no rerank").
//   * Diversification: cap results per document, de-duplicate near-identical
//     passages so one source cannot monopolize the context window.
//
// Used by: vector-search (shortlist rerank before slicing to limit),
//          rag-search (KB + practice rerank), legal-chat (via rag-search).
// =============================================================================

import { classifyLegalSource, LEGAL_SOURCE_LEVELS } from "./source-hierarchy-engine.ts";

// ─── Candidate interface ────────────────────────────────────────────────────
// Intentionally permissive: both `CorpusRow` (vector-search) and
// `KBSearchResult`/`PracticeSearchResult` (rag-search) satisfy it without mapping.

export interface RerankCandidate {
  chunk_id?: string | null;
  document_id?: string | null;
  id?: string;
  title?: string | null;
  content_text?: string;
  text_snippet?: string | null;
  content_snippet?: string | null;
  category?: string | null;
  source?: string | null;
  source_name?: string | null;
  practice_category?: string | null;
  court_type?: string | null;
  citation_anchor?: string | null;
  norm_status?: string;
  effective_from?: string | null;
  effective_to?: string | null;
  language?: string | null;
  vector_score?: number;
  fts_score?: number;
  score?: number;
  retrieval_route?: string;
  content_domain?: string;
}

export interface RerankFeatures {
  semantic: number;
  keyword: number;
  authority: number;
  temporal: number;
  identifier: number;
  language: number;
}

export interface RerankedRow<T extends RerankCandidate = RerankCandidate> {
  row: T;
  rerank_score: number;
  rerank_features: RerankFeatures;
}

export interface RerankMetadata {
  rerank_ok: boolean;
  /** "cross_encoder" if the optional endpoint scored the list, else deterministic */
  rerank_mode: "cross_encoder" | "deterministic_legal_v1";
  reranker_model: string | null;
  latency_ms: number;
  weights: RerankWeights;
  candidates_in: number;
  candidates_out: number;
  endpoint_used: boolean;
  endpoint_error?: string;
  diversification: { max_per_document: number; dedup_window: number; removed_duplicates: number };
}

export interface RerankWeights {
  semantic: number;
  keyword: number;
  authority: number;
  temporal: number;
  identifier: number;
  language: number;
}

export interface RerankOptions {
  query: string;
  /** ISO date or null; used for temporal validity scoring */
  referenceDate?: string | null;
  /** Final number of results to keep (default: input length) */
  limit?: number;
  /** Override weights (default: env or built-in defaults) */
  weights?: Partial<RerankWeights>;
  /** Cap results per document_id (default 3) */
  maxPerDocument?: number;
  /** De-duplicate near-identical passages by a normalized prefix hash */
  dedup?: boolean;
  /** Disable the optional cross-encoder even if RERANKER_ENDPOINT is set */
  disableCrossEncoder?: boolean;
}

// ─── Defaults ───────────────────────────────────────────────────────────────

const DEFAULT_WEIGHTS: RerankWeights = {
  semantic: 0.40,
  keyword: 0.20,
  authority: 0.15,
  temporal: 0.10,
  identifier: 0.10,
  language: 0.05,
};

const MAX_AUTHORITY_RANK = Math.max(...LEGAL_SOURCE_LEVELS.map((l) => l.rank).filter((r) => r < 99)) || 16;

function envNumber(name: string, fallback: number): number {
  try {
    const raw = Number(Deno.env.get(name));
    return Number.isFinite(raw) && raw >= 0 ? raw : fallback;
  } catch {
    return fallback;
  }
}

function resolveWeights(override?: Partial<RerankWeights>): RerankWeights {
  const w: RerankWeights = { ...DEFAULT_WEIGHTS };
  w.semantic = envNumber("RERANK_W_SEMANTIC", w.semantic);
  w.keyword = envNumber("RERANK_W_KEYWORD", w.keyword);
  w.authority = envNumber("RERANK_W_AUTHORITY", w.authority);
  w.temporal = envNumber("RERANK_W_TEMPORAL", w.temporal);
  w.identifier = envNumber("RERANK_W_IDENTIFIER", w.identifier);
  w.language = envNumber("RERANK_W_LANGUAGE", w.language);
  if (override) for (const k of Object.keys(override) as (keyof RerankWeights)[]) {
    const v = override[k];
    if (typeof v === "number" && Number.isFinite(v)) w[k] = v;
  }
  // Renormalize so the composite stays in [0,1] regardless of user tuning.
  const sum = w.semantic + w.keyword + w.authority + w.temporal + w.identifier + w.language;
  if (sum <= 0) return DEFAULT_WEIGHTS;
  if (Math.abs(sum - 1) > 1e-6) {
    for (const k of Object.keys(w) as (keyof RerankWeights)[]) w[k] = w[k] / sum;
  }
  return w;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const ARMENIAN_RE = /[\u0530-\u058F\uFB13-\uFB17]/;
const CYRILLIC_RE = /[\u0400-\u04FF]/;
const LATIN_RE = /[A-Za-z]/;

// Armenian / Russian case-number and statute-identifier patterns.
// Covers RA court formats (ԵԿԴ/...), ECHR (application numbers), and statute
// article references like "հ. 5", "ст. 10", "Article 3".
const CASE_NUMBER_RE = /(?:\b[Ա-ՖA-Z]{2,5}[-/]\d{2,5}(?:[-/]\d{1,4}){0,3}\b)|(?:\b\d{2,5}[-/]\d{2,5}\b)|(?:application\s+(?:no\.?|n°)?\s*\d{2,5}[-/]\d{2,6})/iu;

function detectQueryLanguage(text: string): "hy" | "ru" | "en" | "mixed" | "unknown" {
  if (!text) return "unknown";
  const hy = ARMENIAN_RE.test(text);
  const ru = CYRILLIC_RE.test(text);
  const en = LATIN_RE.test(text);
  const set = [hy, ru, en].filter(Boolean).length;
  if (set >= 2) return "mixed";
  if (hy) return "hy";
  if (ru) return "ru";
  if (en) return "en";
  return "unknown";
}

function normalizeIdentifier(s: string | null | undefined): string {
  return String(s ?? "").replace(/\s+/g, "").toLowerCase();
}

function textOf(c: RerankCandidate): string {
  return [c.title, c.content_text, c.text_snippet, c.content_snippet].filter(Boolean).join(" ").toLowerCase();
}

function clamp01(x: number): number {
  return Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0;
}

// ─── Feature scorers ────────────────────────────────────────────────────────

function semanticScore(c: RerankCandidate): number {
  const v = Number(c.vector_score);
  if (Number.isFinite(v) && v > 0) return clamp01(v);
  const s = Number(c.score);
  if (Number.isFinite(s) && s > 0) return clamp01(s);
  return 0;
}

function keywordScore(c: RerankCandidate): number {
  const v = Number(c.fts_score);
  if (!Number.isFinite(v) || v <= 0) return 0;
  // ts_rank_cd values are small and heavy-tailed; tanh compresses them to [0,1).
  return clamp01(Math.tanh(v * 5));
}

function authorityScore(c: RerankCandidate): number {
  try {
    const ranked = classifyLegalSource({
      id: c.id ?? undefined,
      document_id: c.document_id ?? undefined,
      chunk_id: c.chunk_id ?? undefined,
      title: c.title ?? undefined,
      category: c.category ?? undefined,
      practice_category: c.practice_category ?? undefined,
      court_type: c.court_type ?? undefined,
      source_name: c.source_name ?? undefined,
      citation_anchor: c.citation_anchor ?? undefined,
      content_text: c.content_text ?? undefined,
      content_snippet: c.content_snippet ?? undefined,
      norm_status: c.norm_status ?? undefined,
      effective_from: c.effective_from ?? undefined,
      effective_to: c.effective_to ?? undefined,
    });
    const rank = ranked.authority_rank;
    if (!Number.isFinite(rank) || rank >= 99) return 0;
    return clamp01(1 - (rank - 1) / (MAX_AUTHORITY_RANK - 1));
  } catch {
    return 0;
  }
}

function temporalScore(c: RerankCandidate, referenceDate?: string | null): number {
  const status = String(c.norm_status || "").toLowerCase();
  let base: number;
  if (status === "active" || status === "current") base = 1.0;
  else if (status === "unknown" || status === "") base = 0.6;
  else if (["repealed", "inactive", "expired", "superseded", "not_current"].includes(status)) base = 0.2;
  else base = 0.6;

  if (!referenceDate) return base;
  const at = Date.parse(referenceDate);
  if (!Number.isFinite(at)) return base;
  const from = c.effective_from ? Date.parse(c.effective_from) : Number.NEGATIVE_INFINITY;
  const to = c.effective_to ? Date.parse(c.effective_to) : Number.POSITIVE_INFINITY;
  const fromOk = !Number.isFinite(from) || from <= at;
  const toOk = !Number.isFinite(to) || at < to;
  if (!fromOk) return Math.min(base, 0.3); // not yet in force
  if (!toOk) return Math.min(base, 0.1); // no longer in force
  return base;
}

function identifierScore(c: RerankCandidate, query: string): number {
  const anchor = normalizeIdentifier(c.citation_anchor);
  if (!anchor || anchor.length < 3) return 0;
  const m = query.match(CASE_NUMBER_RE);
  if (!m) return 0;
  for (const g of m) {
    if (anchor.includes(normalizeIdentifier(g))) return 1.0;
  }
  return 0;
}

function languageScore(c: RerankCandidate, queryLang: string): number {
  if (queryLang === "unknown") return 0.7;
  const chunkLang = String(c.language || c.category || c.source || "").toLowerCase();
  if (!chunkLang) return 0.7;
  const isHy = /hy|arm|հայ/i.test(chunkLang) || ARMENIAN_RE.test(textOf(c));
  const isRu = /ru|rus|рус/i.test(chunkLang);
  const isEn = /en|eng|echr/i.test(chunkLang);
  const wants = (l: string) => (queryLang === "mixed" ? true : queryLang === l);
  if (wants("hy") && isHy) return 1.0;
  if (wants("ru") && isRu) return 1.0;
  if (wants("en") && isEn) return 1.0;
  if (queryLang === "mixed") {
    if (isHy || isRu || isEn) return 0.9;
  }
  return 0.3;
}

function computeFeatures(c: RerankCandidate, query: string, queryLang: string, referenceDate?: string | null): RerankFeatures {
  return {
    semantic: semanticScore(c),
    keyword: keywordScore(c),
    authority: authorityScore(c),
    temporal: temporalScore(c, referenceDate),
    identifier: identifierScore(c, query),
    language: languageScore(c, queryLang),
  };
}

function composite(features: RerankFeatures, w: RerankWeights): number {
  return clamp01(
    w.semantic * features.semantic +
      w.keyword * features.keyword +
      w.authority * features.authority +
      w.temporal * features.temporal +
      w.identifier * features.identifier +
      w.language * features.language,
  );
}

// ─── Diversification ────────────────────────────────────────────────────────

function dedupHash(c: RerankCandidate): string {
  const t = (c.content_text || c.text_snippet || c.content_snippet || "").replace(/\s+/g, " ").trim().toLowerCase();
  return t.slice(0, 200);
}

interface DiversifyResult<T extends RerankCandidate> { out: RerankedRow<T>[]; removedDuplicates: number; }
function diversify<T extends RerankCandidate>(scored: RerankedRow<T>[], limit: number, maxPerDoc: number, dedup: boolean): DiversifyResult<T> {
  const out: RerankedRow<T>[] = [];
  const perDoc = new Map<string, number>();
  const seenHashes = new Set<string>();
  let removedDuplicates = 0;
  for (const item of scored) {
    if (out.length >= limit) break;
    const docId = String(item.row.document_id || item.row.id || item.row.chunk_id || "");
    if (maxPerDoc > 0 && docId && (perDoc.get(docId) ?? 0) >= maxPerDoc) continue;
    if (dedup) {
      const h = dedupHash(item.row);
      if (h) {
        if (seenHashes.has(h)) { removedDuplicates++; continue; }
        seenHashes.add(h);
      }
    }
    out.push(item);
    if (docId) perDoc.set(docId, (perDoc.get(docId) ?? 0) + 1);
  }
  return { out, removedDuplicates };
}

// ─── Optional cross-encoder hook ───────────────────────────────────────────

async function tryCrossEncoder(
  query: string,
  shortlist: RerankedRow[],
  requestId?: string,
): Promise<{ ok: boolean; model?: string; scores?: number[]; error?: string }> {
  const endpoint = Deno.env.get("RERANKER_ENDPOINT");
  if (!endpoint) return { ok: false };
  const apiKey = Deno.env.get("RERANKER_API_KEY");
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Number(Deno.env.get("RERANKER_TIMEOUT_MS")) || 5000);
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (apiKey) headers["X-API-Key"] = apiKey;
    const res = await fetch(`${endpoint.replace(/\/+$/, "")}/rerank`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        query,
        documents: shortlist.map((s) => ({
          id: s.row.chunk_id || s.row.id,
          text: s.row.content_text || s.row.text_snippet || s.row.content_snippet || s.row.title || "",
        })),
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return { ok: false, error: `reranker_${res.status}` };
    const payload = await res.json() as { model?: string; scores?: number[] };
    if (!Array.isArray(payload.scores) || payload.scores.length !== shortlist.length) {
      return { ok: false, error: "reranker_score_shape" };
    }
    return { ok: true, model: payload.model ?? "cross-encoder", scores: payload.scores };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "reranker_unreachable" };
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

export interface RerankResult<T extends RerankCandidate = RerankCandidate> {
  rows: RerankedRow<T>[];
  metadata: RerankMetadata;
}

export async function rerankLegalCandidates<T extends RerankCandidate = RerankCandidate>(
  candidates: T[],
  opts: RerankOptions,
  requestId?: string,
): Promise<RerankResult<T>> {
  const started = Date.now();
  const weights = resolveWeights(opts.weights);
  const queryLang = detectQueryLanguage(opts.query);
  const limit = opts.limit && opts.limit > 0 ? opts.limit : candidates.length;
  const maxPerDoc = (opts.maxPerDocument ?? Number(Deno.env.get("RERANK_MAX_PER_DOC"))) || 3;
  const dedup = opts.dedup ?? true;

  // 1) Deterministic scoring for every candidate.
  let scored: RerankedRow<T>[] = candidates.map((row) => {
    const features = computeFeatures(row, opts.query, queryLang, opts.referenceDate);
    return { row, rerank_score: composite(features, weights), rerank_features: features };
  });
  scored.sort((a, b) => b.rerank_score - a.rerank_score);

  let rerankMode: "cross_encoder" | "deterministic_legal_v1" = "deterministic_legal_v1";
  let rerankerModel: string | null = "deterministic-legal-v1";
  let endpointUsed = false;
  let endpointError: string | undefined;

  // 2) Optional cross-encoder refinement on the shortlist (top min(limit*3, 60)).
  if (!opts.disableCrossEncoder && Deno.env.get("RERANKER_ENDPOINT")) {
    const shortlistSize = Math.min(Math.max(limit * 3, 20), 60);
    const shortlist = scored.slice(0, Math.min(shortlistSize, scored.length));
    const ce = await tryCrossEncoder(opts.query, shortlist as unknown as RerankedRow[], requestId);
    endpointUsed = true;
    if (ce.ok && ce.scores) {
      // Blend: keep deterministic score as a tiebreaker/authority floor, but
      // let the cross-encoder dominate ordering within the shortlist.
      const blended = shortlist.map((s, i) => ({
        ...s,
        rerank_score: clamp01(0.7 * Number(ce.scores![i]) + 0.3 * s.rerank_score),
      }));
      blended.sort((a, b) => b.rerank_score - a.rerank_score);
      const tail = scored.slice(shortlist.length);
      scored = [...blended, ...tail];
      rerankMode = "cross_encoder";
      rerankerModel = ce.model ?? "cross-encoder";
    } else {
      endpointError = ce.error;
    }
  }

  // 3) Diversification + final cap.
  const { out, removedDuplicates } = diversify(scored, limit, maxPerDoc, dedup);

  const metadata: RerankMetadata = {
    rerank_ok: true,
    rerank_mode: rerankMode,
    reranker_model: rerankerModel,
    latency_ms: Date.now() - started,
    weights,
    candidates_in: candidates.length,
    candidates_out: out.length,
    endpoint_used: endpointUsed,
    endpoint_error: endpointError,
    diversification: {
      max_per_document: maxPerDoc,
      dedup_window: 200,
      removed_duplicates: removedDuplicates,
    },
  };

  return { rows: out, metadata };
}

// Convenience: rerank and return the original row objects (augmented with
// `rerank_score`) in reranked order. Keeps call sites that just want reordered
// rows simple.
export async function rerankRows<T extends RerankCandidate = RerankCandidate>(
  candidates: T[],
  opts: RerankOptions,
  requestId?: string,
): Promise<{ rows: T[]; metadata: RerankMetadata }> {
  const { rows, metadata } = await rerankLegalCandidates<T>(candidates, opts, requestId);
  const augmented = rows.map((r) => ({ ...r.row, rerank_score: r.rerank_score })) as T[];
  return { rows: augmented, metadata };
}