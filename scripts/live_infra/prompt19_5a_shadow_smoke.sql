with requested_samples(sample_status) as (
  values ('active'::text), ('unknown'::text), ('repealed'::text)
), samples as materialized (
  select requested_samples.sample_status, picked.sample_chunk_id, picked.sample_vector
  from requested_samples
  cross join lateral (
    select sc.chunk_id as sample_chunk_id, e.vector as sample_vector
    from public.search_chunks sc
    join public.document_versions dv
      on dv.version_id = sc.version_id
     and dv.is_current = true
    join public.embeddings e
      on e.chunk_id = sc.chunk_id
     and e.model = 'armenian-text-embeddings-2-large'
     and e.dimension = 1024
     and e.status = 'success'
     and e.vector is not null
    where sc.language_code = 'hy'
      and sc.norm_status::text = requested_samples.sample_status
    limit 1
  ) picked
), scenarios as (
  select 'current'::text as scope, 'active'::text as sample_status
  union all select 'extended', 'unknown'
  union all select 'historical', 'repealed'
), results as (
  select
    scenarios.scope,
    samples.sample_status,
    samples.sample_chunk_id,
    r.chunk_id,
    r.norm_status::text as returned_status,
    r.legal_status_warning,
    r.vector_similarity,
    r.retrieval_route
  from scenarios
  join samples using (sample_status)
  cross join lateral public.search_legal_corpus_metric(
    'shadow infrastructure smoke',
    samples.sample_vector,
    null,
    scenarios.scope,
    null,
    10,
    20,
    10
  ) r
), aggregated as (
  select
    scope,
    sample_status,
    count(*) result_count,
    bool_or(chunk_id = sample_chunk_id) sample_returned,
    count(*) filter (where returned_status = 'active') active_count,
    count(*) filter (where returned_status = 'unknown') unknown_count,
    count(*) filter (where returned_status = 'repealed') repealed_count,
    count(*) filter (where legal_status_warning is not null) warning_count,
    bool_or(vector_similarity is not null) metric_ann_observed,
    bool_or(retrieval_route like '%metric_ann%') metric_route_observed
  from results
  group by scope, sample_status
), no_answer as (
  select count(*) result_count
  from public.search_legal_corpus_metric(
    'zzzz_no_such_legal_unit_19_5a_7f4d9c',
    null,
    null,
    'current',
    null,
    10,
    20,
    10
  )
)
select jsonb_build_object(
  'scopes', (select jsonb_agg(to_jsonb(aggregated) order by scope) from aggregated),
  'no_answer_result_count', (select result_count from no_answer)
) as shadow_smoke;
