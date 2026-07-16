set statement_timeout = '12s';
set lock_timeout = '2s';

explain (analyze, buffers, wal, settings, format json)
with settings as materialized (
  select websearch_to_tsquery('simple'::regconfig, 'սահմանադրական դատարան') as ts_query
)
select
  sc.chunk_id,
  ts_rank_cd(sc.fts_vector, s.ts_query)::real as fts_score
from public.search_chunks sc
cross join settings s
where sc.language_code = 'hy'
  and sc.norm_status = 'active'
  and sc.fts_vector @@ s.ts_query
order by fts_score desc, sc.chunk_id
limit 20;

explain (analyze, buffers, wal, settings, format json)
with settings as materialized (
  select websearch_to_tsquery('simple'::regconfig, 'սահմանադրական դատարան') as ts_query
)
select
  d.document_id,
  ts_rank_cd(
    setweight(to_tsvector('simple'::regconfig, coalesce(d.title_hy, '')), 'A') ||
    setweight(to_tsvector('simple'::regconfig, coalesce(d.canonical_key, '')), 'A') ||
    setweight(to_tsvector('simple'::regconfig, coalesce(d.arlis_doc_id, '')), 'A') ||
    setweight(to_tsvector('simple'::regconfig, coalesce(d.doc_number_clean, '')), 'A') ||
    setweight(to_tsvector('simple'::regconfig, coalesce(d.doc_number_raw, '')), 'B') ||
    setweight(to_tsvector('simple'::regconfig, coalesce(d.source_metadata ->> 'legal_id', '')), 'A'),
    s.ts_query
  )::real as fts_score
from public.documents d
cross join settings s
where (
  setweight(to_tsvector('simple'::regconfig, coalesce(d.title_hy, '')), 'A') ||
  setweight(to_tsvector('simple'::regconfig, coalesce(d.canonical_key, '')), 'A') ||
  setweight(to_tsvector('simple'::regconfig, coalesce(d.arlis_doc_id, '')), 'A') ||
  setweight(to_tsvector('simple'::regconfig, coalesce(d.doc_number_clean, '')), 'A') ||
  setweight(to_tsvector('simple'::regconfig, coalesce(d.doc_number_raw, '')), 'B') ||
  setweight(to_tsvector('simple'::regconfig, coalesce(d.source_metadata ->> 'legal_id', '')), 'A')
) @@ s.ts_query
order by fts_score desc, d.document_id
limit 20;
