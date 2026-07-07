/**
 * Embedding preview for legal_unit_v1 chunks only.
 *
 * Writes to public.search_chunks_legal_unit_embeddings. It never updates
 * production search_chunks or production retrieval.
 */

import { Client } from "https://deno.land/x/postgres@v0.19.3/mod.ts";
import { requireEnv } from "./pipeline_common.ts";

interface Options {
  commit: boolean;
  limit: number;
  batchSize: number;
  domain: string | null;
  includeNonArmenian: boolean;
}

interface ChunkRow {
  chunk_id: string;
  chunk_text_sha256: string;
  normalized_domain: string | null;
  text: string;
  citation_anchor: string | null;
}

interface EndpointHealth {
  status: string;
  model?: string;
  dimension?: number;
  models?: Record<string, { model: string; dimension: number; loaded: boolean }>;
}

const METRIC_MODEL = "armenian-text-embeddings-2-large";
const METRIC_ALIAS = "metric-ai-armenian";

function parseArgs(args: string[]): Options {
  const opts: Options = {
    commit: false,
    limit: 1000,
    batchSize: 16,
    domain: null,
    includeNonArmenian: false,
  };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--commit") opts.commit = true;
    else if (arg === "--limit") opts.limit = Number(args[++i] ?? opts.limit);
    else if (arg === "--domain") opts.domain = args[++i] ?? null;
    else if (arg === "--include-non-armenian") opts.includeNonArmenian = true;
    else if (arg === "--batch-size") {
      opts.batchSize = Number(args[++i] ?? opts.batchSize);
    }
  }
  return opts;
}

async function main() {
  const opts = parseArgs(Deno.args);
  const metricEndpoint = envOptional("METRIC_EMBEDDING_ENDPOINT") ??
    envOptional("EMBEDDING_ENDPOINT") ?? "http://127.0.0.1:8088";
  const metricHealth = await health(metricEndpoint);

  const db = new Client(requireEnv("DATABASE_URL"));
  await db.connect();
  try {
    const rows = await fetchPendingChunks(db, opts.limit, opts.domain, opts.includeNonArmenian);
    const metricInfo = metricHealth?.models?.[METRIC_ALIAS] ?? metricHealth;
    const report = {
      dry_run: !opts.commit,
      chunks_selected: rows.length,
      armenian_text_only: !opts.includeNonArmenian,
      metric_endpoint_ready: Boolean(metricHealth),
      metric_model: metricInfo?.model ?? null,
      metric_dimension: metricInfo?.dimension ?? null,
      primary_route: METRIC_ALIAS,
      qwen_optional_fallback: false,
      written: 0,
      skipped_bad_dimension: 0,
      failed_batches: 0,
    };

    for (let offset = 0; offset < rows.length; offset += opts.batchSize) {
      const batch = rows.slice(offset, offset + opts.batchSize);
      const groups = groupByEndpoint(batch, metricEndpoint);
      for (const group of groups) {
        const vectors = await embed(
          group.endpoint,
          group.rows.map(buildText),
          group.alias,
        )
          .catch(() => null);
        if (!vectors) {
          report.failed_batches++;
          continue;
        }
        const inserts = [];
        for (let i = 0; i < group.rows.length; i++) {
          const vector = vectors.vectors[i];
          if (!vector || vector.length !== 1024) {
            report.skipped_bad_dimension++;
            continue;
          }
          inserts.push({
            chunk_id: group.rows[i].chunk_id,
            chunk_text_sha256: group.rows[i].chunk_text_sha256,
            provider: vectors.model,
            model: group.model,
            dimension: vector.length,
            embedding_text: vectorToPg(vector),
          });
        }
        if (opts.commit && inserts.length > 0) {
          await insertEmbeddings(db, inserts);
          report.written += inserts.length;
        }
      }
    }

    const coverage = await embeddingCoverage(db);
    const armenianCoverage = await embeddingCoverage(db, true);
    console.log(JSON.stringify({ ...report, coverage, armenian_coverage: armenianCoverage }, null, 2));
  } finally {
    await db.end();
  }
}

async function fetchPendingChunks(
  db: Client,
  limit: number,
  domain: string | null,
  includeNonArmenian: boolean,
): Promise<ChunkRow[]> {
  const result = await db.queryObject<ChunkRow>(
    `
    select sc.chunk_id::text, sc.chunk_text_sha256, sc.normalized_domain,
      sc.text, sc.citation_anchor
    from public.search_chunks_legal_unit sc
    where sc.chunk_version = 'legal_unit_v1'
      and ($2::text is null or sc.normalized_domain = $2::text)
      and ($3::boolean is true or sc.text ~ '[Ա-Ֆա-ֆ]')
      and not exists (
        select 1 from public.search_chunks_legal_unit_embeddings e
        where e.chunk_id = sc.chunk_id and e.status = 'success'
      )
    order by
      case sc.normalized_domain when 'armenian_legislation' then 1
        when 'court_practice' then 2 when 'echr' then 3 else 9 end,
      sc.chunk_id
    limit $1
    `,
    [limit, domain, includeNonArmenian],
  );
  return result.rows;
}

function groupByEndpoint(
  rows: ChunkRow[],
  metricEndpoint: string,
): Array<{ endpoint: string; model: string; alias: string; rows: ChunkRow[] }> {
  return [
    { endpoint: metricEndpoint, model: METRIC_MODEL, alias: METRIC_ALIAS, rows },
  ].filter((group) => group.rows.length > 0);
}

async function health(endpoint: string): Promise<EndpointHealth | null> {
  try {
    const response = await fetch(`${endpoint.replace(/\/$/, "")}/health`);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

async function embed(endpoint: string, texts: string[], model: string) {
  const response = await fetch(`${endpoint.replace(/\/$/, "")}/embed`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ texts, model, input_type: "passage" }),
  });
  if (!response.ok) throw new Error(`embedding failed: ${response.status}`);
  return await response.json() as {
    model: string;
    dimension: number;
    vectors: number[][];
  };
}

function buildText(row: ChunkRow): string {
  return [row.citation_anchor, row.text].filter(Boolean).join("\n\n");
}

async function insertEmbeddings(
  db: Client,
  rows: Array<Record<string, unknown>>,
): Promise<void> {
  await db.queryObject(
    `
    with rows as (
      select * from jsonb_to_recordset($1::jsonb) as x(
        chunk_id uuid,
        chunk_text_sha256 text,
        provider text,
        model text,
        dimension integer,
        embedding_text text
      )
    )
    insert into public.search_chunks_legal_unit_embeddings (
      chunk_id, chunk_text_sha256, provider, model, dimension, embedding, status
    )
    select chunk_id, chunk_text_sha256, provider, model, dimension,
      embedding_text::vector, 'success'
    from rows
    on conflict (chunk_id, model) do update set
      provider = excluded.provider,
      dimension = excluded.dimension,
      embedding = excluded.embedding,
      status = 'success',
      error_message = null,
      updated_at = now()
    `,
    [JSON.stringify(rows)],
  );
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
