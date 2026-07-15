set statement_timeout = '12s';
set lock_timeout = '2s';

explain (analyze, buffers, wal, settings, format json)
with settings as materialized (
  select websearch_to_tsquery('simple'::regconfig, 'սահմանադրական դատարան') as ts_query
)
select sc.chunk_id, ts_rank_cd(sc.fts_vector, s.ts_query)::real as fts_score
from public.search_chunks sc
cross join settings s
where sc.language_code = 'hy'
  and sc.norm_status = 'active'
  and sc.fts_vector @@ s.ts_query
order by fts_score desc, sc.chunk_id
limit 20;
