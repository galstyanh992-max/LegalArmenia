import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");
const client = new pg.Client({ connectionString, statement_timeout: 30_000 });
await client.connect();
try {
  await client.query("begin transaction read only");
  const rpc = await client.query(`
    select p.oid::regprocedure::text as signature,
           pg_get_functiondef(p.oid) like '%p_status_scope%' as status_scoped
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'search_legal_corpus_metric'
  `);
  const smoke = await client.query(`
    select chunk_id, document_id, norm_status, status_eligible
    from public.search_legal_corpus_metric($1, null, null, 'current', null, 5, 20, 20)
  `, ["Հայաստանի Հանրապետություն"]);
  await client.query("rollback");
  console.log(JSON.stringify({
    transaction: "READ_ONLY_ROLLED_BACK",
    rpc_found: rpc.rowCount === 1,
    rpc_status_scoped: rpc.rows[0]?.status_scoped === true,
    result_count: smoke.rowCount,
    all_current_results_active: smoke.rows.every((row) =>
      row.norm_status === "active" && row.status_eligible === true
    ),
    production_writes: 0,
  }, null, 2));
} finally {
  await client.end();
}
