set statement_timeout = '5s';
set lock_timeout = '2s';

explain (analyze, buffers, wal, settings, format json)
with settings as materialized (
  select
    'zzzz_prompt19_5b_no_identifier'::text as query_text,
    regexp_replace(lower('zzzz_prompt19_5b_no_identifier'), '[^[:alnum:]]+', '', 'g') as normalized_query,
    null::text as numeric_query
)
select sc.chunk_id
from public.search_chunks sc
cross join settings s
where sc.language_code = 'hy'
  and sc.norm_status = 'active'
  and (
    regexp_replace(lower(coalesce(sc.citation_anchor, '')), '[^[:alnum:]]+', '', 'g') = s.normalized_query
    or (s.numeric_query is not null and sc.article_number = s.numeric_query)
    or (s.numeric_query is not null and sc.legal_unit_number = s.numeric_query)
    or (s.numeric_query is not null and sc.part_number = s.numeric_query)
    or (s.numeric_query is not null and sc.point_number = s.numeric_query)
    or (s.numeric_query is not null and sc.paragraph_number = s.numeric_query)
    or lower(btrim(sc.text)) = lower(btrim(s.query_text, '"'))
  )
order by sc.chunk_id
limit 10;
