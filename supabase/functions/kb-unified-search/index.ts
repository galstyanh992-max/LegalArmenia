import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.91.1";
import { log, err } from "../_shared/safe-logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_KB_DOCS = 10;
const MAX_KB_CHUNKS = Number(Deno.env.get("MAX_KB_CHUNKS_RETURNED")) || 40;
const MAX_PRACTICE_DOCS = 20;
const MAX_PRACTICE_CHUNKS = Number(Deno.env.get("MAX_PRACTICE_CHUNKS_RETURNED")) || 40;
const MAX_PREVIEW_CHARS = 500;
const MAX_QUERY_LENGTH = Number(Deno.env.get("MAX_QUERY_LENGTH")) || 2000;

interface CorpusRow {
  chunk_id: string;
  document_id: string;
  doc_id: string | null;
  title: string | null;
  text_snippet: string | null;
  source_url: string | null;
  citation_anchor: string | null;
  source: string | null;
  content_domain: "knowledge_base" | "practice" | "unknown";
  score: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const requestId = crypto.randomUUID().slice(0, 8);

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return jsonRes({ error: "Unauthorized" }, 401);

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: userErr } = await sb.auth.getUser();
    if (userErr || !userData?.user?.id) return jsonRes({ error: "Unauthorized" }, 401);
    if (req.method !== "POST") return jsonRes({ error: "Method not allowed" }, 405);

    const body = await req.json();
    const rawQuery = body.query;
    const statusScope = normalizeStatusScope(body.statusScope);
    if (!rawQuery || typeof rawQuery !== "string") return jsonRes({ error: "Query is required" }, 400);

    const query = normalizeQuery(rawQuery);
    if (query.length < 2) return jsonRes({ error: "Query too short" }, 400);

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const rpcLimit = Math.min(MAX_KB_CHUNKS + MAX_PRACTICE_CHUNKS, 50);
    const { data, error } = await serviceClient.rpc("search_legal_corpus_metric", {
      p_query_text: query,
      p_metric_embedding: null,
      p_content_domain: null,
      p_status_scope: statusScope,
      p_limit: rpcLimit,
      p_ann_limit: Math.max(rpcLimit, 100),
      p_fts_limit: Math.min(Math.max(rpcLimit, 50), 100),
      p_effective_at: null,
    });

    if (error) throw new Error(error.message);

    const rows = (Array.isArray(data) ? data : []) as CorpusRow[];
    const kbRows = rows.filter((row) => row.content_domain === "knowledge_base").slice(0, MAX_KB_CHUNKS);
    const practiceRows = rows.filter((row) => row.content_domain === "practice").slice(0, MAX_PRACTICE_CHUNKS);

    const kb = buildKbPayload(kbRows);
    const practice = buildPracticePayload(practiceRows);
    const merged = [
      ...kb.documents.map((doc) => ({
        source: "kb",
        id: doc.id,
        title: doc.title,
        normalized_score: doc.max_score,
        raw_score: doc.max_score,
        preview: kb.chunks.find((chunk) => chunk.doc_id === doc.id)?.excerpt || "",
        meta: { category: doc.category, source_name: doc.source_name },
      })),
      ...practice.map((doc) => ({
        source: "practice",
        id: doc.id,
        title: doc.title,
        normalized_score: doc.max_score,
        raw_score: doc.max_score,
        preview: doc.preview,
        meta: { category: doc.practice_category, court_type: doc.court_type },
      })),
    ].sort((a, b) => b.normalized_score - a.normalized_score);

    log("kb-unified-search", "Corpus search done", {
      requestId,
      kbDocs: kb.documents.length,
      practiceDocs: practice.length,
    });

    return jsonRes({
      kb,
      practice,
      merged,
      requestId,
      retrieval_mode: "keyword_only",
      semantic_ok: false,
      semantic_error: "SEMANTIC_EMBEDDING_NOT_REQUESTED",
      metric_semantic_ok: false,
      metric_semantic_error: "SEMANTIC_EMBEDDING_NOT_REQUESTED",
      embedding_model: "armenian-text-embeddings-2-large",
      embedding_dimension: 1024,
      identifier_ok: true,
      metric_ann_ok: false,
      fts_ok: true,
      fusion_ok: true,
      reranker_ok: false,
      legacy_qwen_used: false,
      degraded: false,
      degraded_reason: null,
      retrieval_route: "identifier+fts",
      threshold_applied: false,
      reranker_applied: false,
      rerank_ok: false,
      rerank_error: "RERANKER_NOT_CONFIGURED",
      status_scope: statusScope,
    }, 200);
  } catch (error) {
    err("kb-unified-search", "Search failed", error, { requestId });
    return jsonRes({ error: "Search failed", kb: { documents: [], chunks: [] }, practice: [], merged: [] }, 500);
  }
});

function buildKbPayload(rows: CorpusRow[]) {
  const docs = new Map<string, {
    id: string;
    title: string;
    category: string;
    source_name: string | null;
    article_number: string | null;
    source_url: string | null;
    max_score: number;
  }>();
  const chunks: Array<{
    doc_id: string;
    chunk_index: number;
    chunk_type: string;
    label: string | null;
    char_start: number;
    excerpt: string;
    full_text: string | null;
    score: number;
  }> = [];

  for (const row of rows) {
    if (!docs.has(row.document_id)) {
      docs.set(row.document_id, {
        id: row.document_id,
        title: row.title || row.doc_id || "Untitled",
        category: row.source || "legal",
        source_name: row.source || null,
        article_number: row.citation_anchor,
        source_url: row.source_url,
        max_score: Number(row.score) || 0,
      });
    }
    const chunkIndex = chunks.filter((chunk) => chunk.doc_id === row.document_id).length;
    chunks.push({
      doc_id: row.document_id,
      chunk_index: chunkIndex,
      chunk_type: "text",
      label: row.citation_anchor,
      char_start: 0,
      excerpt: (row.text_snippet || "").substring(0, MAX_PREVIEW_CHARS),
      full_text: row.text_snippet,
      score: Number(row.score) || 0,
    });
  }

  return { documents: [...docs.values()].slice(0, MAX_KB_DOCS), chunks };
}

function buildPracticePayload(rows: CorpusRow[]) {
  const docs = new Map<string, {
    id: string;
    title: string;
    practice_category: string;
    court_type: string;
    outcome: string;
    decision_date: string | null;
    source_url: string | null;
    max_score: number;
    top_chunks: Array<{ chunkIndex: number; text: string }>;
    returnedChunks: number;
    totalChunks: number;
    preview: string;
  }>();

  for (const row of rows) {
    const doc = docs.get(row.document_id) ?? {
      id: row.document_id,
      title: row.title || row.doc_id || "Untitled",
      practice_category: row.source === "echr" ? "echr" : "civil",
      court_type: row.source || "",
      outcome: "",
      decision_date: null,
      source_url: row.source_url,
      max_score: Number(row.score) || 0,
      top_chunks: [],
      returnedChunks: 0,
      totalChunks: 0,
      preview: "",
    };
    doc.top_chunks.push({
      chunkIndex: doc.top_chunks.length,
      text: (row.text_snippet || "").substring(0, MAX_PREVIEW_CHARS),
    });
    doc.returnedChunks = doc.top_chunks.length;
    doc.totalChunks = doc.top_chunks.length;
    doc.preview = doc.top_chunks[0]?.text || "";
    doc.max_score = Math.max(doc.max_score, Number(row.score) || 0);
    docs.set(row.document_id, doc);
  }

  return [...docs.values()].slice(0, MAX_PRACTICE_DOCS);
}

function normalizeQuery(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, MAX_QUERY_LENGTH);
}

function normalizeStatusScope(value: unknown): "current" | "extended" | "historical" {
  return value === "current" || value === "historical" ? value : "extended";
}

function jsonRes(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
