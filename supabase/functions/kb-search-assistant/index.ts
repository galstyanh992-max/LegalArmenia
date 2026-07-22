import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.91.1";
import { handleCors } from "../_shared/edge-security.ts";
import { recordAiMetric } from "../_shared/ai-metrics.ts";
import { searchKB } from "../_shared/rag-search.ts";
import type { KBSearchResult, RetrievalMode } from "../_shared/rag-types.ts";

interface SearchOutput {
  results: Array<{
    title: string;
    snippet: string;
    source: string;
    category: string;
    documentId: string;
  }>;
  keywords: string[];
  totalFound: number;
  retrieval_mode: RetrievalMode;
  semantic_ok: boolean;
  semantic_error?: string;
  qwen_semantic_ok: false;
  qwen_semantic_error: string;
  threshold_applied: boolean;
}

const SEARCH_ASSISTANT_SYSTEM_PROMPT = `
Extract the most important Armenian, Russian, or English legal search keywords from the user query.
Return only a JSON array of strings. Do not include prose.
`.trim();

serve(async (req) => {
  const cors = handleCors(req);
  if (cors.errorResponse) return cors.errorResponse;
  const corsHeaders = cors.corsHeaders!;

  try {
    // === AUTH GUARD ===
    const authHeader = req.headers.get("Authorization") ?? "";
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await sb.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // === END AUTH GUARD ===

    const { query, limit = 20 } = await req.json();

    if (!query || typeof query !== "string") {
      return new Response(
        JSON.stringify({ error: "Query is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`KB Search Assistant: query="${query.substring(0, 100)}..."`);

    // Step 1: Use AI to extract keywords from the query (kept for the
    // `keywords` response field / UI affordance; retrieval itself now uses the
    // canonical hybrid path below, so semantic signal is preserved).
    let keywords: string[] = [];

    try {
      const { callText } = await import("../_shared/openai-router.ts");
      const kbResult = await callText("kb-search-assistant", [
        { role: "system", content: SEARCH_ASSISTANT_SYSTEM_PROMPT },
        { role: "user", content: query },
      ]);
      const content = kbResult.text || "";
      const jsonMatch = content.match(/\[.*\]/s);
      if (jsonMatch) {
        try {
          keywords = JSON.parse(jsonMatch[0]);
          console.log(`AI extracted keywords: ${keywords.join(", ")}`);
        } catch {
          console.log("Failed to parse AI keywords, using fallback");
        }
      }
    } catch (aiErr) {
      console.error("AI keyword extraction error:", aiErr);
    }

    if (keywords.length === 0) {
      keywords = query
        .split(/[\s,.\u054D\u057F]+/)
        .filter((w: string) => w.length > 2 && !/^[0-9]+$/.test(w))
        .slice(0, 10);
      console.log(`Fallback keywords: ${keywords.join(", ")}`);
    }

    // Step 2: Canonical hybrid retrieval — same searchKB() used by legal-chat /
    // ai-analyze / multi-agent-analyze / generate-document / generate-complaint
    // and by kb-search (see AUDIT_REPORTS/RAG/12_canonical_retrieval_contract.md).
    // Replaces the prior two direct `search_legal_corpus_dual` calls that always
    // passed p_metric_embedding: null (keyword-only). The natural-language query
    // is embedded for the semantic arm; FTS still covers the keyword arm.
    const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);
    const rag = await searchKB({
      supabase,
      supabaseUrl,
      supabaseKey: supabaseServiceKey,
      query,
      limit: safeLimit,
      snippetLength: 4000,
    });

    const searchResults: KBSearchResult[] = rag.results;

    // Step 3: Format output with truthful telemetry.
    const output: SearchOutput = {
      results: searchResults.slice(0, safeLimit).map((r) => ({
        title: r.title,
        snippet: (r.content_text || "").substring(0, 300) +
          ((r.content_text || "").length > 300 ? "..." : ""),
        source: r.source_name || `ID: ${r.id}`,
        category: r.category || "knowledge_base",
        documentId: r.id,
      })),
      keywords,
      totalFound: searchResults.length,
      retrieval_mode: rag.retrieval_mode ?? "keyword_only",
      semantic_ok: rag.semantic_ok === true,
      semantic_error: rag.semantic_error,
      qwen_semantic_ok: false,
      qwen_semantic_error: "QWEN_OPTIONAL_FALLBACK_DISABLED",
      threshold_applied: rag.semantic_ok === true,
    };

    try {
      const { getModelConfig: _getModelConfig } = await import("../_shared/openai-router.ts");
      const kbCfg = _getModelConfig("kb-search-assistant");
      await recordAiMetric(supabase, {
        fnName: "kb-search-assistant",
        model: kbCfg.model,
        costUsd: 0.0005,
        status: "success",
      });
    } catch (logErr) {
      console.error("Failed to log AI metric:", logErr);
    }

    console.log(`KB Search completed: ${output.results.length} results found`);

    return new Response(
      JSON.stringify(output),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("KB Search Assistant error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
        results: [],
        keywords: [],
        totalFound: 0
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});