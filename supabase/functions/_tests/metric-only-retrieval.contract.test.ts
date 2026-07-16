import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const ROOT = Deno.cwd();
const read = (path: string) => Deno.readTextFile(`${ROOT}/${path}`);

Deno.test("metric-only contract: RPC is additive, static, scoped, and service-only", async () => {
  const sql = await read("supabase/migrations/20260714165009_metric_only_rpc_unknown_scope.sql");
  const start = sql.indexOf("create or replace function public.search_legal_corpus_metric");
  const end = sql.indexOf("comment on function public.search_legal_corpus_metric");
  const body = sql.slice(start, end).toLowerCase();

  assert(start >= 0, "new Metric RPC must exist");
  assert(body.includes("p_metric_embedding vector(1024)"));
  assert(!body.includes("qwen"), "new RPC body must not contain Qwen");
  assert(!body.includes("return query execute"), "new RPC must not use dynamic SQL");
  assert(body.includes("security invoker"));
  assert(body.includes("set search_path = public, extensions, pg_temp"));
  assert(body.includes("v_limit > 50"));
  assert(body.includes("v_ann_limit > 200"));
  assert(body.includes("v_fts_limit > 100"));
  assert(sql.includes("from public, anon, authenticated"));
  assert(sql.includes("to service_role"));
  assert(!sql.includes("drop function public.search_legal_corpus_dual"));
});

Deno.test("metric-only contract: active Edge callers use new RPC and truthful telemetry", async () => {
  const files = [
    "supabase/functions/vector-search/index.ts",
    "supabase/functions/kb-search/index.ts",
    "supabase/functions/kb-search-assistant/index.ts",
    "supabase/functions/kb-unified-search/index.ts",
  ];
  for (const file of files) {
    const source = await read(file);
    assert(source.includes('"search_legal_corpus_metric"'), `${file} must use Metric RPC`);
    assert(!source.includes("search_legal_corpus_dual"), `${file} must not use dual RPC`);
    assert(!source.includes("p_qwen_embedding"), `${file} must not send Qwen vector`);
    assert(!source.includes("p_qwen_limit"), `${file} must not send Qwen limit`);
    assert(source.includes("reranker_ok: false"), `${file} must report reranker truthfully`);
    assert(source.includes("legacy_qwen_used: false"), `${file} must explicitly report legacy path unused`);
    assert(source.includes('embedding_model: "armenian-text-embeddings-2-large"'));
    assert(source.includes("embedding_dimension: 1024"));
  }
});

Deno.test("metric-only contract: consumer defaults and browser privilege boundary", async () => {
  const rag = await read("supabase/functions/_shared/rag-search.ts");
  assert(rag.includes('status_scope: "current"'), "legal RAG must request current scope");

  for (const file of [
    "supabase/functions/kb-search/index.ts",
    "supabase/functions/kb-search-assistant/index.ts",
    "supabase/functions/kb-unified-search/index.ts",
  ]) {
    const source = await read(file);
    assert(source.includes('"extended"'), `${file} research default must be extended`);
  }

  for (const file of [
    "src/hooks/useKnowledgeBase.ts",
    "src/hooks/useLegalPracticeKB.ts",
    "src/components/kb/KBSearchPanel.tsx",
  ]) {
    const source = await read(file);
    assert(!source.includes("search_legal_corpus_dual"), `${file} must not call dual RPC`);
    assert(!source.includes("search_legal_corpus_metric"), `${file} must not call service-only RPC directly`);
    assert(source.includes("functions.invoke"), `${file} must use an Edge-mediated route`);
  }
});

Deno.test("metric-only contract: generated types expose approved signature", async () => {
  const types = await read("src/integrations/supabase/types.ts");
  const start = types.indexOf("search_legal_corpus_metric:");
  const end = types.indexOf("search_legal_unit_chunks_preview:", start);
  const block = types.slice(start, end);
  assert(start >= 0);
  assert(block.includes("p_metric_embedding: string | null"));
  assert(block.includes("p_status_scope?: string"));
  assert(block.includes("vector_similarity: number | null"));
  assert(block.includes("route_sources: string[]"));
  assertEquals(block.includes("qwen"), false);
});
