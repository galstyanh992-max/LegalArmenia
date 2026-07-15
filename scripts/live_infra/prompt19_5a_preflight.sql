with proc_inventory as (
  select p.oid, p.proname, pg_get_function_identity_arguments(p.oid) identity_args,
         encode(extensions.digest(convert_to(pg_get_functiondef(p.oid), 'UTF8'), 'sha256'), 'hex') definition_sha256,
         has_function_privilege('anon', p.oid, 'execute') anon_execute,
         has_function_privilege('authenticated', p.oid, 'execute') authenticated_execute,
         has_function_privilege('service_role', p.oid, 'execute') service_role_execute
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('search_legal_corpus_dual', 'search_legal_corpus_metric')
), status_counts as (
  select coalesce(norm_status::text, 'null') status, count(*) count
  from public.search_chunks
  group by 1
), model_counts as (
  select model, dimension, count(*) count
  from public.embeddings
  group by model, dimension
), qwen_indexes as (
  select schemaname, indexname,
         encode(extensions.digest(convert_to(indexdef, 'UTF8'), 'sha256'), 'hex') definition_sha256
  from pg_indexes
  where schemaname = 'public'
    and (indexname ilike '%qwen%' or indexdef ilike '%qwen%')
)
select jsonb_build_object(
  'migration_count', (select count(*) from supabase_migrations.schema_migrations),
  'metric_migration_count', (
    select count(*) from supabase_migrations.schema_migrations where version = '20260714165009'
  ),
  'tables', jsonb_build_object(
    'documents', (select count(*) from public.documents),
    'document_versions', (select count(*) from public.document_versions),
    'search_chunks', (select count(*) from public.search_chunks),
    'embeddings', (select count(*) from public.embeddings)
  ),
  'status_counts', (select coalesce(jsonb_object_agg(status, count), '{}'::jsonb) from status_counts),
  'model_counts', (
    select coalesce(jsonb_agg(to_jsonb(model_counts) order by model, dimension), '[]'::jsonb) from model_counts
  ),
  'qwen_rows', (select count(*) from public.embeddings where model ilike '%qwen%'),
  'qwen_indexes', (
    select coalesce(jsonb_agg(to_jsonb(qwen_indexes) order by indexname), '[]'::jsonb) from qwen_indexes
  ),
  'functions', (
    select coalesce(jsonb_agg(to_jsonb(proc_inventory) order by proname, identity_args), '[]'::jsonb)
    from proc_inventory
  ),
  'notification_queue_usage', (select pg_notification_queue_usage())
) as preflight_snapshot;
