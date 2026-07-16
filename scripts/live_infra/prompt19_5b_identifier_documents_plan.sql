set statement_timeout = '12s';
set lock_timeout = '2s';

explain (analyze, buffers, wal, settings, format json)
with settings as materialized (
  select
    'zzzz_prompt19_5b_no_identifier'::text as query_text,
    regexp_replace(lower('zzzz_prompt19_5b_no_identifier'), '[^[:alnum:]]+', '', 'g') as normalized_query
)
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
limit 10;
