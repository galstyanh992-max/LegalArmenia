import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.91.1";
import { log, warn, err } from "../_shared/safe-logger.ts";
import { handleCors, checkInternalAuth, callInternalFunction } from "../_shared/edge-security.ts";
import { applyTemporalValidation, buildTemporalWarnings, normalizeEffectiveDate } from "../_shared/temporal-validity-engine.ts";
import { runV3Shadow } from "../_shared/v3-shadow.ts";

type SearchTables = "kb" | "practice" | "both";

interface CorpusRow {
  chunk_id: string;
  document_id: string;
  version_id: string;
  doc_id: string | null;
  title: string | null;
  text_snippet: string | null;
  source_url: string | null;
  citation_anchor: string | null;
  language: string | null;
  source: string | null;
  content_domain: "knowledge_base" | "practice" | "unknown";
  norm_status: string;
  status_scope: "current" | "extended" | "historical";
  status_eligible: boolean;
  status_reason_code: string;
  legal_status_warning: string | null;
  score: number;
  vector_similarity: number | null;
  ann_rank: number | null;
  fts_score: number | null;
  fts_rank: number | null;
  identifier_match: boolean;
  route_sources: string[];
  retrieval_model: string;
  retrieval_route: string;
  match_reason: string;
}

type RetrievalMode = "hybrid" | "vector" | "keyword_only" | "rpc_fallback";

serve(async (req) => {
  const cors = handleCors(req);
  if (cors.errorResponse) return cors.errorResponse;
  const corsHeaders = cors.corsHeaders!;

  const authErr = checkInternalAuth(req, corsHeaders);
  if (authErr) return authErr;

  const requestId = req.headers.get("x-request-id") || crypto.randomUUID();

  try {
    const {
      query: rawQuery,
      tables = "both",
      limit = 10,
      threshold,
      reference_date,
      status_scope = "current",
    } = await req.json();

    if (!rawQuery || typeof rawQuery !== "string") {
      return json({ error: "Query is required", kb: [], practice: [] }, 400, corsHeaders);
    }

    const maxQueryLength = Number(Deno.env.get("MAX_QUERY_LENGTH")) || 2000;
    const maxResults = Number(Deno.env.get("MAX_RESULTS")) || 60;
    const query = rawQuery.length > maxQueryLength ? rawQuery.substring(0, maxQueryLength) : rawQuery;
    const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), maxResults);
    const searchTables = normalizeTables(tables);
    const semanticThreshold = normalizeThreshold(threshold);
    const normalizedReferenceDate = normalizeEffectiveDate(reference_date);
    const statusScope = normalizeStatusScope(status_scope);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { db: { schema: "public" }, global: { headers: { "x-statement-timeout": "8000" } } },
    );

    const metricEmbedding = await embedMetricQuery(query, requestId);
    const warnings: string[] = [];
    if (!metricEmbedding) warnings.push("METRIC_EMBEDDING_UNAVAILABLE");
    const rpcLimit = Math.min(Math.max(safeLimit * 2, 20), 50);

    const { data, error } = await supabase.rpc("search_legal_corpus_metric", {
      p_query_text: query,
      p_metric_embedding: vectorArg(metricEmbedding),
      p_content_domain: contentDomainFor(searchTables),
      p_status_scope: statusScope,
      p_effective_at: normalizedReferenceDate,
      p_limit: rpcLimit,
      p_ann_limit: Math.min(Math.max(safeLimit * 4, 100), 200),
      p_fts_limit: Math.min(Math.max(safeLimit * 3, 50), 100),
    });

    if (error) throw new Error(error.message);

    const rows = (Array.isArray(data) ? data as CorpusRow[] : [])
      .filter((row) => passesSemanticThreshold(row, semanticThreshold));
    // V3 shadow (Stage B) — OFF by default, failure-isolated, never alters the primary response.
    await runV3Shadow({
      supabaseUrl: Deno.env.get("SUPABASE_URL")!,
      serviceRoleKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      requestId,
      query,
      embedding: metricEmbedding,
      contentDomain: contentDomainFor(searchTables),
      statusScope,
      effectiveAt: normalizedReferenceDate,
      limit: rpcLimit,
      annLimit: Math.min(Math.max(safeLimit * 4, 100), 200),
      ftsLimit: Math.min(Math.max(safeLimit * 3, 50), 100),
      primaryChunkIds: rows.map((r) => r.chunk_id),
      primaryRoute: "search_legal_corpus_metric",
    });
    const hasSemanticRows = rows.some(isSemanticRow);
    const hasKeywordRows = rows.some(isKeywordRow);
    const retrievalMode = resolveRetrievalMode(hasSemanticRows, hasKeywordRows);
    const semanticOk = Boolean(metricEmbedding);
    const routeSources = ["identifier", ...(semanticOk ? ["metric_hy"] : []), "fts"];
    const kbRaw = rows
      .filter((row) => row.content_domain === "knowledge_base" && searchTables !== "practice")
      .map(mapKb)
      .slice(0, safeLimit);
    const practiceRaw = rows
      .filter((row) => row.content_domain === "practice" && searchTables !== "kb")
      .map(mapPractice)
      .slice(0, safeLimit);
    const validated = applyTemporalValidation([...kbRaw, ...practiceRaw], normalizedReferenceDate);
    const kb = validated.filter((row) => (row as { content_domain?: string }).content_domain !== "practice" && kbRaw.some((k) => k.chunk_id === row.chunk_id));
    const practice = validated.filter((row) => practiceRaw.some((p) => p.chunk_id === row.chunk_id));
    const temporalWarnings = buildTemporalWarnings(validated, normalizedReferenceDate);

    log("vector-search", "Corpus search complete", {
      requestId,
      kb_results: kb.length,
      practice_results: practice.length,
      embedding: metricEmbedding ? "metric" : "none",
      retrieval_mode: retrievalMode,
      status_scope: statusScope,
    });

    return json({
      kb,
      practice,
      retrieval_mode: retrievalMode,
      semantic_ok: semanticOk,
      semantic_error: warnings.length ? warnings.join("; ") : undefined,
      metric_semantic_ok: semanticOk,
      metric_semantic_error: warnings.length ? warnings.join("; ") : undefined,
      embedding_model: "armenian-text-embeddings-2-large",
      embedding_dimension: 1024,
      identifier_ok: true,
      metric_ann_ok: semanticOk,
      fts_ok: true,
      fusion_ok: true,
      reranker_ok: false,
      legacy_qwen_used: false,
      degraded: !semanticOk,
      degraded_reason: semanticOk ? null : "METRIC_EMBEDDING_UNAVAILABLE",
      retrieval_route: routeSources.join("+"),
      threshold_applied: semanticOk,
      threshold_value: semanticThreshold,
      reranker_applied: false,
      rerank_ok: false,
      rerank_error: "RERANKER_NOT_CONFIGURED",
      status_scope: statusScope,
      temporal_warnings: temporalWarnings,
      request_id: requestId,
    }, 200, corsHeaders);
  } catch (error) {
    err("vector-search", "Search error", { error, requestId });
    const message = error instanceof Error ? error.message : "Unknown error";
    return json({
      error: message,
      kb: [],
      practice: [],
      retrieval_mode: "rpc_fallback",
      semantic_ok: false,
      semantic_error: message,
      metric_semantic_ok: false,
      metric_semantic_error: message,
      embedding_model: "armenian-text-embeddings-2-large",
      embedding_dimension: 1024,
      identifier_ok: false,
      metric_ann_ok: false,
      fts_ok: false,
      fusion_ok: false,
      reranker_ok: false,
      legacy_qwen_used: false,
      degraded: true,
      degraded_reason: message,
      retrieval_route: "none",
      threshold_applied: false,
      reranker_applied: false,
      rerank_ok: false,
      rerank_error: "RERANKER_NOT_CONFIGURED",
      request_id: requestId,
    }, 500, corsHeaders);
  }
});

function normalizeTables(value: unknown): SearchTables {
  return value === "kb" || value === "practice" || value === "both" ? value : "both";
}

function contentDomainFor(tables: SearchTables) {
  if (tables === "kb") return "knowledge_base";
  if (tables === "practice") return "practice";
  return null;
}

function normalizeStatusScope(value: unknown): "current" | "extended" | "historical" {
  return value === "extended" || value === "historical" ? value : "current";
}

function vectorArg(vector: number[] | null) {
  return Array.isArray(vector) && vector.length === 1024 ? `[${vector.join(",")}]` : null;
}

function normalizeThreshold(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0.3;
  return Math.min(Math.max(n, 0), 1);
}

function isSemanticRow(row: CorpusRow) {
  return row.ann_rank != null || row.route_sources?.includes("metric_ann") || Number(row.vector_similarity) > 0;
}

function isKeywordRow(row: CorpusRow) {
  const route = String(row.retrieval_route || "");
  return route.includes("identifier") || route.includes("fts") || row.identifier_match || Number(row.fts_score) > 0;
}

function passesSemanticThreshold(row: CorpusRow, threshold: number) {
  return !isSemanticRow(row) || Number(row.vector_similarity) >= threshold;
}

function resolveRetrievalMode(hasSemanticRows: boolean, hasKeywordRows: boolean): RetrievalMode {
  if (hasSemanticRows && hasKeywordRows) return "hybrid";
  if (hasSemanticRows) return "vector";
  if (hasKeywordRows) return "keyword_only";
  return "keyword_only";
}

async function embedMetricQuery(text: string, requestId: string): Promise<number[] | null> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!supabaseUrl) {
    warn("vector-search", "SUPABASE_URL missing; embed-query unavailable", { requestId });
    return null;
  }

  try {
    const res = await callInternalFunction(
      `${supabaseUrl}/functions/v1/embed-query`,
      { text },
      { requestId, timeoutMs: 25_000 },
    );
    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      warn("vector-search", "embed-query failed", { requestId, status: res.status, error: errorText.substring(0, 120) });
      return null;
    }
    const payload = await res.json() as { vector?: number[] };
    const vector = payload.vector;
    return Array.isArray(vector) && vector.length === 1024 ? vector : null;
  } catch (error) {
    warn("vector-search", "embed-query unavailable", { requestId, error: String(error) });
    return null;
  }
}

function mapKb(row: CorpusRow) {
  return {
    id: row.document_id,
    chunk_id: row.chunk_id,
    document_id: row.document_id,
    title: row.title || row.doc_id || "Untitled",
    content_text: row.text_snippet || "",
    category: row.source || "legal",
    source_name: row.source || null,
    version_date: null,
    citation_anchor: row.citation_anchor,
    norm_status: row.norm_status,
    status_scope: row.status_scope,
    status_reason_code: row.status_reason_code,
    legal_status_warning: row.legal_status_warning,
    match_reason: row.match_reason,
    similarity: row.score,
    vector_score: row.vector_similarity,
    fts_score: row.fts_score,
    retrieval_model: row.retrieval_model,
    retrieval_route: row.retrieval_route,
    rank: row.fts_score,
    score: row.score,
  };
}

function mapPractice(row: CorpusRow) {
  return {
    id: row.document_id,
    chunk_id: row.chunk_id,
    document_id: row.document_id,
    title: row.title || row.doc_id || "Untitled",
    content_text: row.text_snippet || "",
    content_snippet: row.text_snippet || "",
    practice_category: row.source === "echr" ? "echr" : "court_decision",
    court_type: row.source || "",
    outcome: "",
    legal_reasoning_summary: row.text_snippet || "",
    decision_date: null,
    case_number: row.citation_anchor || undefined,
    court_name: row.source || undefined,
    citation_anchor: row.citation_anchor || undefined,
    norm_status: row.norm_status,
    status_scope: row.status_scope,
    status_reason_code: row.status_reason_code,
    legal_status_warning: row.legal_status_warning,
    match_reason: row.match_reason,
    similarity: row.score,
    vector_score: row.vector_similarity,
    fts_score: row.fts_score,
    retrieval_model: row.retrieval_model,
    retrieval_route: row.retrieval_route,
    relevance_score: row.score,
    score: row.score,
  };
}

function json(body: Record<string, unknown>, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}
