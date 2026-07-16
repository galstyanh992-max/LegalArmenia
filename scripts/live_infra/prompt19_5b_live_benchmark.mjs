import pg from "pg";
import { performance } from "node:perf_hooks";

const { Client } = pg;
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const client = new Client({ connectionString: process.env.DATABASE_URL });

const scenarios = [
  { category: "armenian_semantic", count: 20, query: "սահմանադրական դատարան", scope: "current", vector: "active" },
  { category: "russian_to_armenian", count: 10, query: "конституционный суд", scope: "current", vector: "active" },
  { category: "exact_identifier", count: 10, query: "1", scope: "current", vector: null },
  { category: "unknown_only", count: 10, query: "իրավական կարգավիճակ", scope: "extended", vector: "unknown" },
  { category: "historical", count: 10, query: "պատմական իրավական ակտ", scope: "historical", vector: "repealed" },
  { category: "no_answer", count: 10, query: "zzzz_no_such_legal_unit_19_5b_9f31", scope: "current", vector: null },
];

function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return Number(sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)].toFixed(2));
}

await client.connect();
try {
  await client.query("begin read only");
  await client.query("set local lock_timeout = '2s'");

  const vectors = {};
  for (const status of ["active", "unknown", "repealed"]) {
    const result = await client.query(
      `select e.vector::text as vector
       from public.search_chunks sc
       join public.document_versions dv on dv.version_id = sc.version_id and dv.is_current = true
       join public.embeddings e on e.chunk_id = sc.chunk_id
         and e.model = 'armenian-text-embeddings-2-large'
         and e.status = 'success' and e.dimension = 1024 and e.vector is not null
       where sc.language_code = 'hy' and sc.norm_status::text = $1
       limit 1`,
      [status],
    );
    if (!result.rows[0]?.vector) throw new Error(`No ${status} Metric sample`);
    vectors[status] = result.rows[0].vector;
  }

  const runs = [];
  let timeoutCount = 0;
  let errorCount = 0;
  const errorDetails = new Map();
  let contamination = 0;
  let unknownProof = false;
  let repealedProof = false;

  for (const scenario of scenarios) {
    const callCount = Math.min(scenario.count, Number(process.env.BENCHMARK_CALL_LIMIT ?? scenario.count));
    for (let iteration = 0; iteration < callCount; iteration++) {
      const started = performance.now();
      try {
        const result = await client.query(
          `select norm_status::text as norm_status,
                  status_reason_code,
                  legal_status_warning is not null as warning_present,
                  ann_rank is not null as ann_observed,
                  fts_rank is not null as fts_observed
           from public.search_legal_corpus_metric_v2(
             $1, $2::vector, null::public.content_domain, $3, null::date, 15, 100, 50
           )`,
          [scenario.query, scenario.vector ? vectors[scenario.vector] : null, scenario.scope],
        );
        const allowed = scenario.scope === "current"
          ? new Set(["active"])
          : scenario.scope === "extended"
          ? new Set(["active", "unknown"])
          : new Set(["active", "unknown", "repealed"]);
        contamination += result.rows.filter((row) => !allowed.has(row.norm_status)).length;
        unknownProof ||= result.rows.some((row) => row.norm_status === "unknown" && row.warning_present);
        repealedProof ||= result.rows.some((row) => row.norm_status === "repealed" && row.warning_present);
        runs.push({ category: scenario.category, ms: performance.now() - started, rows: result.rowCount });
      } catch (error) {
        if (error?.code === "57014") timeoutCount++;
        else errorCount++;
        const key = `${error?.code ?? "unknown"}:${error?.message ?? "unknown"}`;
        errorDetails.set(key, (errorDetails.get(key) ?? 0) + 1);
        runs.push({ category: scenario.category, ms: performance.now() - started, rows: null });
      }
    }
  }

  const categoryStats = Object.fromEntries(scenarios.map(({ category }) => {
    const subset = runs.filter((run) => run.category === category);
    const timings = subset.map((run) => run.ms);
    return [category, {
      calls: subset.length,
      p50Ms: percentile(timings, 0.5),
      p95Ms: percentile(timings, 0.95),
      p99Ms: percentile(timings, 0.99),
      minRows: Math.min(...subset.map((run) => run.rows ?? 0)),
      maxRows: Math.max(...subset.map((run) => run.rows ?? 0)),
    }];
  }));
  const allTimings = runs.map((run) => run.ms);
  console.log(JSON.stringify({
    calls: runs.length,
    p50Ms: percentile(allTimings, 0.5),
    p95Ms: percentile(allTimings, 0.95),
    p99Ms: percentile(allTimings, 0.99),
    timeoutCount,
    errorCount,
    errors: Object.fromEntries(errorDetails),
    statusContamination: contamination,
    unknownWarningProof: unknownProof,
    repealedWarningProof: repealedProof,
    vectorsExposed: false,
    idsExposed: false,
    categoryStats,
  }, null, 2));
  await client.query("rollback");
} catch (error) {
  await client.query("rollback").catch(() => {});
  throw error;
} finally {
  await client.end();
}
