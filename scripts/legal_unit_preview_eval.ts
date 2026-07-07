/**
 * Retrieval validation for legal_unit_v1 preview.
 *
 * Compares legacy production RPC with preview lexical/vector/hybrid. Preview
 * vector reads only public.search_chunks_legal_unit_embeddings.
 */

import { Client } from "https://deno.land/x/postgres@v0.19.3/mod.ts";
import { EVAL_SET } from "./legal_unit_chunk_rebuild.ts";
import { requireEnv } from "./pipeline_common.ts";

const METRIC_MODEL = "armenian-text-embeddings-2-large";
const METRIC_ALIAS = "metric-ai-armenian";

async function main() {
  const metricEndpoint = envOptional("METRIC_EMBEDDING_ENDPOINT") ??
    envOptional("EMBEDDING_ENDPOINT") ?? "http://127.0.0.1:8088";
  const db = new Client(requireEnv("DATABASE_URL"));
  await db.connect();
  try {
    const metrics = {
      legacy_production: initMetrics(),
      legal_unit_v1_lexical: initMetrics(),
      legal_unit_v1_vector: initMetrics(),
      legal_unit_v1_hybrid: initMetrics(),
    };
    const rows = [];
    for (const [category, query, expected] of EVAL_SET) {
      const legacy = await legacySearch(db, category, query);
      const lexical = await previewLexical(db, category, query);
      const vector = await previewVector(
        db,
        category,
        query,
        metricEndpoint,
      );
      const hybrid = hybridRank(lexical, vector);
      const row = {
        category,
        query,
        legacy: score(legacy, expected),
        lexical: score(lexical, expected),
        vector: score(vector, expected),
        hybrid: score(hybrid, expected),
      };
      rows.push(row);
      add(metrics.legacy_production, category, row.legacy);
      add(metrics.legal_unit_v1_lexical, category, row.lexical);
      add(metrics.legal_unit_v1_vector, category, row.vector);
      add(metrics.legal_unit_v1_hybrid, category, row.hybrid);
    }
    const coverage = await embeddingCoverage(db);
    const armenianCoverage = await embeddingCoverage(db, true);
    console.log(JSON.stringify({
      primary_route: METRIC_ALIAS,
      qwen_optional_fallback: false,
      metrics,
      rows,
      embedding_coverage: coverage,
      armenian_embedding_coverage: armenianCoverage,
    }, null, 2));
  } finally {
    await db.end();
  }
}

function initMetrics() {
  return {
    total: 0,
    top5: 0,
    top10: 0,
    zero_hit: 0,
    by_category: {} as Record<string, { total: number; top5: number; top10: number; zero_hit: number }>,
  };
}

function add(
  metrics: ReturnType<typeof initMetrics>,
  category: string,
  result: { top5: boolean; top10: boolean; count: number },
) {
  metrics.total++;
  if (result.top5) metrics.top5++;
  if (result.top10) metrics.top10++;
  if (result.count === 0) metrics.zero_hit++;
  const bucket = metrics.by_category[category] ??
    { total: 0, top5: 0, top10: 0, zero_hit: 0 };
  bucket.total++;
  if (result.top5) bucket.top5++;
  if (result.top10) bucket.top10++;
  if (result.count === 0) bucket.zero_hit++;
  metrics.by_category[category] = bucket;
}

async function legacySearch(db: Client, category: string, query: string) {
  const domain = isPractice(category)
    ? "'practice'::public.content_domain"
    : "null::public.content_domain";
  const result = await db.queryObject<{ body: string }>(
    `
    select concat_ws(' ', title, text_snippet, citation_anchor) as body
    from public.search_legal_corpus_dual($1, null, null, ${domain},
      'active'::public.normalized_status, 10, 0, 0, 10, null)
    limit 10
    `,
    [query],
  );
  return result.rows.map((row) => row.body ?? "");
}

async function previewLexical(db: Client, category: string, query: string) {
  const result = await db.queryObject<{ body: string }>(
    `
    select concat_ws(' ', title, text_snippet, citation_anchor) as body
    from public.search_legal_unit_chunks_preview(
      $1, 10, $2::public.content_domain, null, null
    )
    `,
    [query, isPractice(category) ? "practice" : null],
  );
  return result.rows.map((row) => row.body ?? "");
}

async function previewVector(
  db: Client,
  category: string,
  query: string,
  metricEndpoint: string,
) {
  const endpoint = metricEndpoint;
  const model = METRIC_MODEL;
  const alias = METRIC_ALIAS;
  const vector = await embedQuery(endpoint, query, alias).catch(() => null);
  if (!vector || vector.length !== 1024) return [];
  const result = await db.queryObject<{ body: string; distance: number }>(
    `
    select concat_ws(' ', sc.normalized_title, left(sc.text, 1200), sc.citation_anchor) as body,
      (e.embedding <=> $1::vector)::float as distance
    from public.search_chunks_legal_unit sc
    join public.search_chunks_legal_unit_embeddings e on e.chunk_id = sc.chunk_id
    where sc.chunk_version = 'legal_unit_v1'
      and e.status = 'success'
      and e.model = $2
      and ($3::public.content_domain is null or sc.content_domain = $3::public.content_domain)
    order by e.embedding <=> $1::vector
    limit 10
    `,
    [vectorToPg(vector), model, isPractice(category) ? "practice" : null],
  );
  return result.rows.map((row) => row.body ?? "");
}

function hybridRank(lexical: string[], vector: string[]) {
  const scores = new Map<string, number>();
  for (const [i, row] of lexical.entries()) {
    scores.set(row, (scores.get(row) ?? 0) + 1 / (60 + i + 1));
  }
  for (const [i, row] of vector.entries()) {
    scores.set(row, (scores.get(row) ?? 0) + 1 / (60 + i + 1));
  }
  return [...scores.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([row]) => row);
}

function score(rows: string[], expected: readonly string[]) {
  return {
    count: rows.length,
    top5: hasExpected(rows.slice(0, 5).join(" "), expected),
    top10: hasExpected(rows.join(" "), expected),
  };
}

function hasExpected(text: string, expected: readonly string[]) {
  const lower = text.toLowerCase();
  return expected.some((term) => lower.includes(term.toLowerCase()));
}

async function embedQuery(endpoint: string, text: string, model: string): Promise<number[]> {
  const response = await fetch(`${endpoint.replace(/\/$/, "")}/embed`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ texts: [text], model, input_type: "query" }),
  });
  if (!response.ok) throw new Error(`embedding failed: ${response.status}`);
  const data = await response.json() as { vectors: number[][] };
  return data.vectors[0] ?? [];
}

async function embeddingCoverage(db: Client, armenianOnly = false) {
  const result = await db.queryObject(
    `
    select sc.normalized_domain, count(*)::int chunks,
      count(e.embedding_id)::int embedded,
      count(*) filter (where e.embedding is null)::int missing,
      count(e.embedding_id) filter (where e.model = 'armenian-text-embeddings-2-large')::int metric_success,
      count(e.embedding_id) filter (where e.dimension <> 1024)::int bad_dimensions,
      count(e.embedding_id) filter (where e.embedding is null and e.status = 'success')::int null_vectors,
      round(
        (count(e.embedding_id) filter (where e.model = 'armenian-text-embeddings-2-large'))::numeric
        / nullif(count(*), 0) * 100,
        2
      )::float8 as metric_coverage_pct,
      array_agg(distinct e.model) filter (where e.model is not null) models,
      array_agg(distinct e.dimension) filter (where e.dimension is not null) dimensions
    from public.search_chunks_legal_unit sc
    left join public.search_chunks_legal_unit_embeddings e
      on e.chunk_id = sc.chunk_id and e.status = 'success'
    where sc.chunk_version = 'legal_unit_v1'
      and ($1::boolean is false or sc.text ~ '[Ա-Ֆա-ֆ]')
    group by sc.normalized_domain
    order by sc.normalized_domain
    `,
    [armenianOnly],
  );
  return result.rows;
}

function isPractice(category: string) {
  return category === "echr" || category === "cross_echr" ||
    category === "court_practice";
}

function vectorToPg(vector: number[]): string {
  return `[${vector.join(",")}]`;
}

function envOptional(key: string): string | null {
  const value = Deno.env.get(key)?.trim();
  return value || null;
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    Deno.exit(1);
  });
}
