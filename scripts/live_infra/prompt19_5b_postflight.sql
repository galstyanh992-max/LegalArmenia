begin isolation level repeatable read read only;
set local statement_timeout = '20s';

with functions as (
  select p.proname,
    encode(extensions.digest(convert_to(pg_get_functiondef(p.oid), 'UTF8'), 'sha256'), 'hex') definition_sha256,
    has_function_privilege('anon', p.oid, 'execute') anon_execute,
    has_function_privilege('authenticated', p.oid, 'execute') authenticated_execute,
    has_function_privilege('service_role', p.oid, 'execute') service_role_execute
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('search_legal_corpus_dual', 'search_legal_corpus_metric', 'search_legal_corpus_metric_v2')
)
select jsonb_build_object(
  'migration_v2', (select count(*) from supabase_migrations.schema_migrations where version = '20260715023423'),
  'migration_v2_fix', (select count(*) from supabase_migrations.schema_migrations where version = '20260715024359'),
  'functions', (select jsonb_agg(to_jsonb(functions) order by proname) from functions),
  'counts', jsonb_build_object(
    'documents', (select count(*) from public.documents),
    'document_versions', (select count(*) from public.document_versions),
    'search_chunks', (select count(*) from public.search_chunks),
    'embeddings', (select count(*) from public.embeddings),
    'active', (select count(*) from public.search_chunks where norm_status = 'active'),
    'unknown', (select count(*) from public.search_chunks where norm_status = 'unknown'),
    'repealed', (select count(*) from public.search_chunks where norm_status = 'repealed'),
    'metric', (select count(*) from public.embeddings where model = 'armenian-text-embeddings-2-large'),
    'qwen', (select count(*) from public.embeddings where model ilike '%qwen%')
  ),
  'qwen_index', (
    select encode(extensions.digest(convert_to(indexdef, 'UTF8'), 'sha256'), 'hex')
    from pg_indexes where schemaname = 'public' and indexname = 'embeddings_ivf_qwen_idx'
  )
) as postflight;

rollback;
