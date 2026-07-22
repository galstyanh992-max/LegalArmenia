import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.91.1";
import { log, err } from "../_shared/safe-logger.ts";
import { dualSearch } from "../_shared/rag-search.ts";
import type { KBSearchResult, PracticeSearchResult } from "../_shared/rag-types.ts";

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
    if (!rawQuery || typeof rawQuery !== "string") return jsonRes({ error: "Query is required" }, 400);

    const query = normalizeQuery(rawQuery);
    if (query.length < 2) return jsonRes({ error: "Query too short" }, 400);

    // ── Canonical retrieval: same dualSearch() used by legal-chat / ai-analyze /
    // multi-agent-analyze / generate-document / generate-complaint (see
    // AUDIT_REPORTS/RAG/12_canonical_retrieval_contract.md). Replaces the prior
    // direct RPC call that always passed p_metric_embedding: null.
    const rag = await dualSearch({
      supabase: sb,
      supabaseUrl: Deno.env.get("SUPABASE_URL")!,
      supabaseKey: Deno.env.get("SUPABASE_ANON_KEY")!,
      query,
      requestId,
      kbLimit: MAX_KB_CHUNKS,
      practiceLimit: MAX_PRACTICE_CHUNKS,
    });

    const kb = buildKbPayload(rag.kbResults.slice(0, MAX_KB_CHUNKS));
    const practice = buildPracticePayload(rag.practiceResults.slice(0, MAX_PRACTICE_CHUNKS));
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
      retrieval_mode: rag.retrieval_mode,
      semantic_ok: rag.semantic_ok,
    });

    return jsonRes({
      kb,
      practice,
      merged,
      requestId,
      retrieval_mode: rag.retrieval_mode,
      semantic_ok: rag.semantic_ok,
      semantic_error: rag.semantic_error,
      // Qwen ECHR route is disabled repo-wide (F-4, artifact 06) — unrelated to
      // this fix; kept as an explicit, truthful field rather than removed.
      qwen_semantic_ok: false,
      qwen_semantic_error: "QWEN_OPTIONAL_FALLBACK_DISABLED",
      threshold_applied: rag.semantic_ok,
    }, 200);
  } catch (error) {
    err("kb-unified-search", "Search failed", error, { requestId });
    return jsonRes({ error: "Search failed", kb: { documents: [], chunks: [] }, practice: [], merged: [] }, 500);
  }
});

function buildKbPayload(rows: KBSearchResult[]) {
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
    // document_id is optional on KBSearchResult; fall back to a stable
    // non-optional identifier so rows never collapse under an "undefined" key.
    const docId = row.document_id || row.chunk_id || row.id;
    if (!docs.has(docId)) {
      docs.set(docId, {
        id: docId,
        title: row.title || "Untitled",
        category: row.category || "legal",
        source_name: row.source_name || null,
        article_number: row.citation_anchor ?? null,
        source_url: null,
        max_score: Number(row.score) || 0,
      });
    }
    const chunkIndex = chunks.filter((chunk) => chunk.doc_id === docId).length;
    chunks.push({
      doc_id: docId,
      chunk_index: chunkIndex,
      chunk_type: "text",
      label: row.citation_anchor ?? null,
      char_start: 0,
      excerpt: (row.content_text || "").substring(0, MAX_PREVIEW_CHARS),
      full_text: row.content_text || null,
      score: Number(row.score) || 0,
    });
  }

  return { documents: [...docs.values()].slice(0, MAX_KB_DOCS), chunks };
}

function buildPracticePayload(rows: PracticeSearchResult[]) {
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
    // document_id is optional on PracticeSearchResult; same non-optional
    // fallback identifier as buildKbPayload.
    const docId = row.document_id || row.chunk_id || row.id;
    const doc = docs.get(docId) ?? {
      id: docId,
      title: row.title || "Untitled",
      practice_category: row.practice_category || (row.court_type === "echr" ? "echr" : "civil"),
      court_type: row.court_type || "",
      outcome: row.outcome || "",
      decision_date: row.decision_date || null,
      source_url: null,
      max_score: Number(row.score) || 0,
      top_chunks: [],
      returnedChunks: 0,
      totalChunks: 0,
      preview: "",
    };
    const text = (row.content_text || row.content_snippet || "").substring(0, MAX_PREVIEW_CHARS);
    doc.top_chunks.push({ chunkIndex: doc.top_chunks.length, text });
    doc.returnedChunks = doc.top_chunks.length;
    doc.totalChunks = doc.top_chunks.length;
    doc.preview = doc.top_chunks[0]?.text || "";
    doc.max_score = Math.max(doc.max_score, Number(row.score) || 0);
    docs.set(docId, doc);
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

function jsonRes(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
