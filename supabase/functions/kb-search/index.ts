import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.91.1";
import { log, err } from "../_shared/safe-logger.ts";

import { handleCors } from "../_shared/edge-security.ts";
import { searchPractice } from "../_shared/rag-search.ts";
import type { PracticeSearchResult } from "../_shared/rag-types.ts";

// ─── Types ────────────────────────────────────────────────────────────────

interface SearchRequest {
  query: string;
  category?: "criminal" | "civil" | "administrative" | "echr" | "constitutional" | null;
  limitDocs?: number;
  limitChunksPerDoc?: number;
}

interface TopChunk {
  chunkIndex: number;
  text: string;
}

interface SearchResultDocument {
  id: string;
  title: string;
  practice_category: string;
  court_type: string;
  outcome: string;
  applied_articles: unknown[];
  key_violations: string[];
  legal_reasoning_summary: string | null;
  decision_map: unknown | null;
  key_paragraphs: unknown[];
  top_chunks: TopChunk[];
  totalChunks: number;
  max_score?: number;
}

// ─── Constants ────────────────────────────────────────────────────────────

const ALLOWED_CATEGORIES = new Set([
  "criminal", "civil", "administrative", "echr", "constitutional",
]);

const defaultCorsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/** Decode the minimal safe set of HTML entities that may appear in user input */
const HTML_ENTITY_MAP: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#34;": '"',
  "&#39;": "'",
  "&apos;": "'",
};
const HTML_ENTITY_RE = /&(?:amp|lt|gt|quot|apos|#34|#39);/gi;

// ─── Handler ────────────────────────────────────────────────────────────────

serve(async (req) => {
  const cors = handleCors(req);
  if (cors.errorResponse) return cors.errorResponse;
  const corsHeaders = cors.corsHeaders!;

  // Preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const requestId = crypto.randomUUID().slice(0, 8);

  try {
    // === AUTH GUARD (getUser via Authorization header) ===
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return jsonRes({ error: "Unauthorized" }, 401);
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: authError } = await sb.auth.getUser();
    if (authError || !userData?.user?.id) {
      return jsonRes({ error: "Unauthorized" }, 401);
    }

    // === Rate limiting ===
    const supabaseServiceUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const serviceClient = createClient(supabaseServiceUrl, supabaseServiceRoleKey);
    const { checkRateLimits } = await import("../_shared/rate-limiter.ts");
    const rateCheck = await checkRateLimits(serviceClient, userData.user.id, "kb-search");
    if (!rateCheck.allowed) {
      return new Response(
        JSON.stringify({ error: rateCheck.reason, message: rateCheck.message }),
        { status: rateCheck.status || 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    // === End rate limiting ===

    // === Method check ===
    if (req.method !== "POST") {
      return jsonRes({ error: "Method not allowed" }, 405);
    }

    // === Parse & validate ===
    const body: SearchRequest = await req.json();
    const { category = null, limitDocs = 20, limitChunksPerDoc = 4 } = body;
    const rawQuery = body.query;

    if (!rawQuery || typeof rawQuery !== "string") {
      return jsonRes({ error: "Query is required" }, 400);
    }

    const query = normalizeSearchQuery(rawQuery);
    if (query.length < 2) {
      return jsonRes({ error: "Query too short" }, 400);
    }

    if (category != null && !ALLOWED_CATEGORIES.has(category)) {
      return jsonRes({ error: "Invalid category" }, 400);
    }

    const safeLimitDocs = Math.max(1, Math.min(Number(limitDocs) || 20, 20));
    const safeChunksPerDoc = Math.max(1, Math.min(Number(limitChunksPerDoc) || 4, 6));

    log("kb-search", "Search start", { requestId, qLen: query.length, category });

    // ── Canonical retrieval: same searchPractice() used inside dualSearch()
    // by legal-chat / ai-analyze / multi-agent-analyze / generate-document /
    // generate-complaint, and now by kb-unified-search (Prompt 4). Replaces
    // the prior two-tier (chunks RPC + flat-fallback RPC) null-vector calls —
    // searchPractice() already does semantic + FTS hybrid in one call, so the
    // fallback tier is no longer structurally necessary.
    const rag = await searchPractice({
      supabase: sb,
      supabaseUrl: supabaseServiceUrl,
      supabaseKey: supabaseServiceRoleKey,
      query,
      category,
      requestId,
      limit: Math.max(safeLimitDocs, 1),
    });

    const results = groupIntoDocuments(rag.results, category, safeLimitDocs, safeChunksPerDoc);

    log("kb-search", "Search done", {
      requestId,
      docs: results.length,
      retrieval_mode: rag.retrieval_mode,
      semantic_ok: rag.semantic_ok,
    });

    return new Response(
      JSON.stringify({
        documents: results,
        retrieval_mode: rag.retrieval_mode,
        semantic_ok: rag.semantic_ok,
        semantic_error: rag.semantic_error,
        // Qwen ECHR route is disabled repo-wide (F-4, artifact 06) — unrelated
        // to this fix; kept as an explicit, truthful field rather than removed.
        qwen_semantic_ok: false,
        qwen_semantic_error: "QWEN_OPTIONAL_FALLBACK_DISABLED",
        threshold_applied: rag.semantic_ok,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    err("kb-search", "Unhandled error", error, { requestId });
    return jsonRes({ error: "Search failed" }, 500);
  }
});

// ─── Grouping: PracticeSearchResult[] (flat chunks) → SearchResultDocument[] (per-doc) ──

function groupIntoDocuments(
  rows: PracticeSearchResult[],
  category: string | null,
  limitDocs: number,
  chunksPerDoc: number,
): SearchResultDocument[] {
  const docOrder: string[] = [];
  const docsById = new Map<string, {
    id: string;
    title: string;
    practice_category: string;
    court_type: string;
    max_score: number;
    key_paragraphs: unknown[];
    chunks: TopChunk[];
  }>();

  for (const row of rows) {
    // document_id is optional on PracticeSearchResult; fall back to a
    // non-optional identifier so rows never collapse under "undefined".
    const docId = row.document_id || row.chunk_id || row.id;
    let doc = docsById.get(docId);
    if (!doc) {
      doc = {
        id: docId,
        title: row.title || "Untitled",
        practice_category: row.practice_category || (row.court_type === "echr" ? "echr" : (category || "")),
        court_type: row.court_type || "",
        max_score: Number(row.score) || 0,
        key_paragraphs: row.key_paragraphs || [],
        chunks: [],
      };
      docsById.set(docId, doc);
      docOrder.push(docId);
    }
    if (doc.chunks.length < chunksPerDoc) {
      const text = (row.content_text || row.content_snippet || "").substring(0, 500);
      doc.chunks.push({ chunkIndex: doc.chunks.length, text });
    }
    doc.max_score = Math.max(doc.max_score, Number(row.score) || 0);
  }

  return docOrder.slice(0, limitDocs).map((id) => {
    const doc = docsById.get(id)!;
    return {
      id: doc.id,
      title: doc.title,
      practice_category: doc.practice_category,
      court_type: doc.court_type,
      outcome: "",
      applied_articles: [],
      key_violations: [],
      legal_reasoning_summary: doc.chunks[0]?.text || null,
      decision_map: null,
      key_paragraphs: doc.key_paragraphs,
      top_chunks: doc.chunks,
      totalChunks: doc.chunks.length,
      max_score: doc.max_score,
    };
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────

/**
 * Normalize search query:
 * - Strip HTML tags
 * - Decode safe HTML entities (&quot; → ", &amp; → &, etc.)
 * - Remove control chars (keep \n \r \t)
 * - Collapse whitespace, cap at 200 chars
 * - Preserves Armenian (U+0531–U+058F), Cyrillic, and quotes for phrase-mode
 */
function normalizeSearchQuery(raw: string): string {
  let q = raw
    .replace(/<[^>]*>/g, "")                     // strip HTML tags
    .replace(HTML_ENTITY_RE, (m) => HTML_ENTITY_MAP[m.toLowerCase()] ?? m) // decode safe entities
    // deno-lint-ignore no-control-regex
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "") // control chars (keep \n \r \t)
    .replace(/\s+/g, " ")                         // collapse whitespace
    .trim();

  if (q.length > 200) q = q.substring(0, 200);
  return q;
}

function jsonRes(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...defaultCorsHeaders, "Content-Type": "application/json" },
  });
}
