import pg from "pg";

const { Client } = pg;
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");

const client = new Client({ connectionString, statement_timeout: 20_000 });

function walk(node, summary) {
  if (!node || typeof node !== "object") return;
  const type = node["Node Type"];
  if (type) summary.nodeTypes[type] = (summary.nodeTypes[type] ?? 0) + 1;
  if (node["Index Name"]) summary.indexes.add(node["Index Name"]);
  if (type === "Seq Scan") summary.sequentialScans.push(node["Relation Name"]);
  summary.sharedHit += node["Shared Hit Blocks"] ?? 0;
  summary.sharedRead += node["Shared Read Blocks"] ?? 0;
  summary.rowsRemoved += node["Rows Removed by Filter"] ?? 0;
  for (const child of node.Plans ?? []) walk(child, summary);
}

function summarize(label, explainRow) {
  const root = explainRow["QUERY PLAN"][0];
  const summary = {
    label,
    planningMs: root["Planning Time"] ?? null,
    executionMs: root["Execution Time"] ?? null,
    indexes: new Set(),
    sequentialScans: [],
    nodeTypes: {},
    sharedHit: 0,
    sharedRead: 0,
    rowsRemoved: 0,
  };
  walk(root.Plan, summary);
  return { ...summary, indexes: [...summary.indexes] };
}

await client.connect();
try {
  await client.query("begin read only");
  await client.query("set local statement_timeout = '15s'");
  await client.query("set local lock_timeout = '2s'");
  const sample = await client.query(`
    select vector::text as vector
    from public.embeddings
    where model = 'armenian-text-embeddings-2-large'
      and status = 'success'
      and dimension = 1024
      and vector is not null
    limit 1
  `);
  if (!sample.rows[0]?.vector) throw new Error("Metric sample vector unavailable");
  const vector = sample.rows[0].vector;
  const results = [];

  for (const probes of [5, 10, 20, 30]) {
    await client.query(`set local ivfflat.probes = ${probes}`);
    await client.query("set local ivfflat.iterative_scan = 'off'");
    const plan = await client.query({
      text: `
        explain (analyze, buffers, wal, settings, format json)
        select e.chunk_id, (1.0 - (e.vector <=> $1::vector))::real as similarity
        from public.embeddings e
        where e.model = 'armenian-text-embeddings-2-large'
          and e.status = 'success'
          and e.dimension = 1024
          and e.vector is not null
        order by e.vector <=> $1::vector, e.chunk_id
        limit 100
      `,
      values: [vector],
    });
    results.push(summarize(`ann_only_probes_${probes}`, plan.rows[0]));
  }

  await client.query("set local ivfflat.probes = 10");
  await client.query("set local ivfflat.iterative_scan = 'relaxed_order'");
  await client.query("set local ivfflat.max_probes = 60");
  const joined = await client.query({
    text: `
      explain (analyze, buffers, wal, settings, format json)
      with metric_candidates as materialized (
        select e.chunk_id, (1.0 - (e.vector <=> $1::vector))::real as similarity
        from public.embeddings e
        where e.model = 'armenian-text-embeddings-2-large'
          and e.status = 'success'
          and e.dimension = 1024
          and e.vector is not null
        order by e.vector <=> $1::vector
        limit 500
      )
      select mc.chunk_id, mc.similarity
      from metric_candidates mc
      join public.search_chunks sc on sc.chunk_id = mc.chunk_id
      join public.document_versions dv on dv.version_id = sc.version_id and dv.is_current = true
      where sc.language_code = 'hy'
        and sc.norm_status = 'active'
        and (sc.effective_from is null or sc.effective_from <= current_date)
        and (sc.effective_to is null or sc.effective_to > current_date)
      order by mc.similarity desc, mc.chunk_id
      limit 100
    `,
    values: [vector],
  });
  results.push(summarize("ann_prefiltered_current", joined.rows[0]));

  console.log(JSON.stringify({ sampleVectorExposed: false, results }, null, 2));
  await client.query("rollback");
} catch (error) {
  await client.query("rollback").catch(() => {});
  throw error;
} finally {
  await client.end();
}
