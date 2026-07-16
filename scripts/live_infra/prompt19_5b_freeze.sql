begin isolation level repeatable read read only;
set local statement_timeout = '20s';
set local lock_timeout = '2s';

with target_tables(relid) as (
  select unnest(array[
    'public.embeddings'::regclass,
    'public.search_chunks'::regclass,
    'public.documents'::regclass,
    'public.document_versions'::regclass
  ])
), target_indexes as (
  select
    n.nspname as schema_name,
    t.relname as table_name,
    i.relname as index_name,
    pg_get_indexdef(i.oid) as index_definition,
    pg_relation_size(i.oid) as index_bytes,
    coalesce(s.idx_scan, 0) as idx_scan,
    coalesce(s.idx_tup_read, 0) as idx_tup_read,
    coalesce(s.idx_tup_fetch, 0) as idx_tup_fetch,
    x.indisvalid,
    x.indisready
  from target_tables tt
  join pg_class t on t.oid = tt.relid
  join pg_namespace n on n.oid = t.relnamespace
  join pg_index x on x.indrelid = t.oid
  join pg_class i on i.oid = x.indexrelid
  left join pg_stat_user_indexes s on s.indexrelid = i.oid
), table_inventory as (
  select
    n.nspname as schema_name,
    c.relname as table_name,
    pg_relation_size(c.oid) as table_bytes,
    pg_indexes_size(c.oid) as index_bytes,
    pg_total_relation_size(c.oid) as total_bytes,
    s.n_live_tup,
    s.n_dead_tup,
    s.last_analyze,
    s.last_autoanalyze,
    s.last_vacuum,
    s.last_autovacuum
  from target_tables tt
  join pg_class c on c.oid = tt.relid
  join pg_namespace n on n.oid = c.relnamespace
  left join pg_stat_user_tables s on s.relid = c.oid
), functions as (
  select
    p.proname,
    pg_get_function_identity_arguments(p.oid) as identity_arguments,
    encode(extensions.digest(convert_to(pg_get_functiondef(p.oid), 'UTF8'), 'sha256'), 'hex') as definition_sha256,
    p.proconfig,
    has_function_privilege('anon', p.oid, 'execute') as anon_execute,
    has_function_privilege('authenticated', p.oid, 'execute') as authenticated_execute,
    has_function_privilege('service_role', p.oid, 'execute') as service_role_execute
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('search_legal_corpus_metric', 'search_legal_corpus_metric_v2', 'search_legal_corpus_dual')
), counts as (
  select jsonb_build_object(
    'documents', (select count(*) from public.documents),
    'document_versions', (select count(*) from public.document_versions),
    'search_chunks', (select count(*) from public.search_chunks),
    'embeddings', (select count(*) from public.embeddings),
    'active', (select count(*) from public.search_chunks where norm_status = 'active'),
    'unknown', (select count(*) from public.search_chunks where norm_status = 'unknown'),
    'repealed', (select count(*) from public.search_chunks where norm_status = 'repealed'),
    'metric', (select count(*) from public.embeddings where model = 'armenian-text-embeddings-2-large'),
    'qwen', (select count(*) from public.embeddings where model ilike '%qwen%')
  ) as value
)
select jsonb_build_object(
  'captured_at', clock_timestamp(),
  'vector_extension', (
    select jsonb_build_object('version', extversion, 'schema', n.nspname)
    from pg_extension e join pg_namespace n on n.oid = e.extnamespace
    where e.extname = 'vector'
  ),
  'ivfflat', jsonb_build_object(
    'probes', current_setting('ivfflat.probes', true),
    'iterative_scan', current_setting('ivfflat.iterative_scan', true),
    'max_probes', current_setting('ivfflat.max_probes', true)
  ),
  'tables', (select jsonb_agg(to_jsonb(table_inventory) order by table_name) from table_inventory),
  'indexes', (select jsonb_agg(to_jsonb(target_indexes) order by table_name, index_name) from target_indexes),
  'functions', (select jsonb_agg(to_jsonb(functions) order by proname) from functions),
  'counts', (select value from counts)
) as freeze_snapshot;

rollback;
