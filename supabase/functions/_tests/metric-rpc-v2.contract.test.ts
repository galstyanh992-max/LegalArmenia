import { assert, assertEquals } from "jsr:@std/assert@1";

const migrationUrl = new URL(
  "../../migrations/20260715023423_metric_rpc_v2_performance.sql",
  import.meta.url,
);
const source = await Deno.readTextFile(migrationUrl);

Deno.test("Metric RPC V2 is additive, bounded, and Metric-only", () => {
  assert(source.includes("search_legal_corpus_metric_v2"));
  assert(!source.includes("drop function"));
  assert(!source.includes("search_legal_corpus_dual("));
  assert(!source.toLowerCase().includes("qwen"));
  assert(source.includes("metric_candidates as materialized"));
  assert(source.includes("limit v_ann_candidate_limit"));
  assert(source.includes("chunk_fts_candidates as materialized"));
  assert(source.includes("limit v_fts_candidate_limit"));
  assert(!source.includes("lower(btrim(sc.text))"));
});

Deno.test("Metric RPC V2 preserves security and status contracts", () => {
  assert(source.includes("security invoker"));
  assert(source.includes("set search_path = public, extensions, pg_temp"));
  assert(source.includes("set statement_timeout = '15s'"));
  assert(!source.includes("set ivfflat."));
  assert(source.includes("from public, anon, authenticated"));
  assert(source.includes("to service_role"));
  assert(source.includes("('current', 'extended', 'historical')"));
  assert(source.includes("UNCONFIRMED_STATUS"));
  assert(source.includes("REPEALED_HISTORICAL"));
});

Deno.test("Metric RPC V2 creates no production index", () => {
  const creates = source.match(/create\s+(?:unique\s+)?index/gi) ?? [];
  assertEquals(creates.length, 0);
});
