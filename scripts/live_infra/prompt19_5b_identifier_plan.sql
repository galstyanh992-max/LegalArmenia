set statement_timeout = '12s';
set lock_timeout = '2s';

explain (analyze, buffers, wal, settings, format json)
with settings as materialized (
  select
    'zzzz_prompt19_5b_no_identifier'::text as query_text,
    regexp_replace(lower('zzzz_prompt19_5b_no_identifier'), '[^[:alnum:]]+', '', 'g') as normalized_query,
    null::text as numeric_query
), identifier_documents as materialized (
  select d.document_id
  from public.documents d
  cross join settings s
  where
    regexp_replace(lower(coalesce(d.canonical_key, '')), '[^[:alnum:]]+', '', 'g') = s.normalized_query
    or regexp_replace(lower(coalesce(d.arlis_doc_id, '')), '[^[:alnum:]]+', '', 'g') = s.normalized_query
    or regexp_replace(lower(coalesce(d.doc_number_clean, '')), '[^[:alnum:]]+', '', 'g') = s.normalized_query
    or regexp_replace(lower(coalesce(d.doc_number_raw, '')), '[^[:alnum:]]+', '', 'g') = s.normalized_query
    or lower(btrim(coalesce(d.title_hy, ''))) = lower(s.query_text)
    or lower(btrim(coalesce(d.source_metadata ->> 'case_number', ''))) = lower(s.query_text)
    or lower(btrim(coalesce(d.source_metadata ->> 'legal_id', ''))) = lower(s.query_text)
    or d.issued_date::text = s.query_text
  order by d.document_id
  limit 10
)
select count(*) as candidate_count
from identifier_documents;

explain (costs, settings, format json)
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
