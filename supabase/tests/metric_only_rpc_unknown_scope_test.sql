\set ON_ERROR_STOP on

begin;

create function pg_temp.assert_true(p_condition boolean, p_message text)
returns void
language plpgsql
as $$
begin
  if coalesce(p_condition, false) is not true then
    raise exception 'ASSERTION_FAILED: %', p_message;
  end if;
end
$$;

insert into public.documents (
  document_id, canonical_key, arlis_doc_id, content_domain, title_hy,
  doc_number_clean, effective_from, normalized_status, source_metadata
)
values
  ('10000000-0000-0000-0000-000000000001', 'arlis:test-active', 'TEST-ACTIVE', 'knowledge_base', 'Փորձնական Վերնագիր', 'TEST-1', '2020-01-01', 'active', '{"source":"fixture"}'),
  ('10000000-0000-0000-0000-000000000002', 'arlis:test-unknown', 'TEST-UNKNOWN', 'knowledge_base', 'Անհայտ Կարգավիճակ', 'TEST-2', '2020-01-01', 'unknown', '{"source":"fixture"}'),
  ('10000000-0000-0000-0000-000000000003', 'arlis:test-repealed', 'TEST-REPEALED', 'knowledge_base', 'Հին Նորմ', 'TEST-3', '2010-01-01', 'repealed', '{"source":"fixture"}'),
  ('10000000-0000-0000-0000-000000000004', 'arlis:test-duplicate', 'TEST-DUP', 'knowledge_base', 'Կրկնակի Նորմ', 'TEST-4', '2020-01-01', 'active', '{"source":"fixture"}');

insert into public.document_versions (version_id, document_id, version_number, language_code, is_current)
values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 1, 'hy', true),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 1, 'hy', true),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003', 1, 'hy', true),
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000004', 1, 'hy', true);

insert into public.document_versions (version_id, document_id, version_number, language_code, is_current)
values ('20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', 2, 'hy', false);

insert into public.search_chunks (
  chunk_id, chunk_key, document_id, version_id, text, language_code,
  content_domain, norm_status, effective_from, citation_anchor,
  chunk_text_sha256, article_number, legal_unit_number
)
values
  ('30000000-0000-0000-0000-000000000001', 'fixture-active-1', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'գործողնորմ պայմանագիր պատասխանատվություն', 'hy', 'knowledge_base', 'active', '2020-01-01', 'Հոդված 77', 'hash-active', '77', '77'),
  ('30000000-0000-0000-0000-000000000002', 'fixture-unknown-1', '10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'անհայտվիճակ հատուկ կանոն', 'hy', 'knowledge_base', 'unknown', '2020-01-01', 'Հոդված 88', 'hash-unknown', '88', '88'),
  ('30000000-0000-0000-0000-000000000003', 'fixture-repealed-1', '10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', 'հիննորմ նախկին կարգավորում', 'hy', 'knowledge_base', 'repealed', '2010-01-01', 'Հոդված 99', 'hash-repealed', '99', '99'),
  ('30000000-0000-0000-0000-000000000004', 'fixture-duplicate-1', '10000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000004', 'կրկնվողբովանդակություն եզակի բառ', 'hy', 'knowledge_base', 'active', '2020-01-01', 'Հոդված 55', 'hash-duplicate', '55', '55'),
  ('30000000-0000-0000-0000-000000000005', 'fixture-duplicate-2', '10000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000004', 'կրկնվողբովանդակություն եզակի բառ', 'hy', 'knowledge_base', 'active', '2020-01-01', 'Հոդված 55', 'hash-duplicate', '55', '55');

insert into public.search_chunks (
  chunk_id, chunk_key, document_id, version_id, text, language_code,
  content_domain, norm_status, effective_from, chunk_text_sha256
)
values
  ('30000000-0000-0000-0000-000000000006', 'fixture-old-version', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000005', 'հինտարբերակ բացառիկ', 'hy', 'knowledge_base', 'active', '2010-01-01', 'hash-old-version'),
  ('30000000-0000-0000-0000-000000000007', 'fixture-non-armenian', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'englishonlyfixture exclusive', 'en', 'knowledge_base', 'active', '2020-01-01', 'hash-non-armenian');

insert into public.embeddings (
  embedding_id, chunk_id, model, dimension, vector, chunk_text_sha256, status
)
values
  ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'armenian-text-embeddings-2-large', 1024, (array[1.0] || array_fill(0.0, array[1023]))::vector(1024), 'hash-active', 'success'),
  ('40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', 'armenian-text-embeddings-2-large', 1024, (array[0.9, 0.1] || array_fill(0.0, array[1022]))::vector(1024), 'hash-unknown', 'success'),
  ('40000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000003', 'armenian-text-embeddings-2-large', 1024, (array[0.8, 0.2] || array_fill(0.0, array[1022]))::vector(1024), 'hash-repealed', 'success'),
  ('40000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000004', 'armenian-text-embeddings-2-large', 1024, (array[0.7, 0.3] || array_fill(0.0, array[1022]))::vector(1024), 'hash-duplicate', 'success'),
  ('40000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000005', 'armenian-text-embeddings-2-large', 1024, (array[0.7, 0.3] || array_fill(0.0, array[1022]))::vector(1024), 'hash-duplicate', 'success');

select pg_temp.assert_true(
  to_regprocedure('public.search_legal_corpus_metric(text,vector,public.content_domain,text,date,integer,integer,integer)') is not null,
  'Metric RPC must exist with the approved identity arguments'
);

select pg_temp.assert_true(
  has_function_privilege('service_role', 'public.search_legal_corpus_metric(text,vector,public.content_domain,text,date,integer,integer,integer)', 'EXECUTE'),
  'service_role must have EXECUTE'
);
select pg_temp.assert_true(
  not has_function_privilege('authenticated', 'public.search_legal_corpus_metric(text,vector,public.content_domain,text,date,integer,integer,integer)', 'EXECUTE'),
  'authenticated must not have EXECUTE'
);
select pg_temp.assert_true(
  not has_function_privilege('anon', 'public.search_legal_corpus_metric(text,vector,public.content_domain,text,date,integer,integer,integer)', 'EXECUTE'),
  'anon must not have EXECUTE'
);
select pg_temp.assert_true(
  not exists (
    select 1
    from pg_proc p
    cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    where p.oid = 'public.search_legal_corpus_metric(text,vector,public.content_domain,text,date,integer,integer,integer)'::regprocedure
      and a.grantee = 0
      and a.privilege_type = 'EXECUTE'
  ),
  'PUBLIC must not have EXECUTE'
);

select pg_temp.assert_true(
  not p.prosecdef
  and 'search_path=public, extensions, pg_temp' = any(p.proconfig)
  and 'statement_timeout=60s' = any(p.proconfig),
  'RPC must be SECURITY INVOKER with fixed search_path and timeout'
)
from pg_proc p
where p.oid = 'public.search_legal_corpus_metric(text,vector,public.content_domain,text,date,integer,integer,integer)'::regprocedure;

select pg_temp.assert_true(
  position('qwen' in lower(pg_get_functiondef(p.oid))) = 0
  and position('execute ' in lower(pg_get_functiondef(p.oid))) = 0,
  'RPC must contain neither Qwen nor dynamic SQL'
)
from pg_proc p
where p.oid = 'public.search_legal_corpus_metric(text,vector,public.content_domain,text,date,integer,integer,integer)'::regprocedure;

select pg_temp.assert_true(
  (select count(*) = 0 from public.search_legal_corpus_metric('անհայտվիճակ', null, 'knowledge_base', 'current', null, 10, 100, 50)),
  'current scope must exclude unknown'
);
select pg_temp.assert_true(
  (select count(*) = 1
     and bool_and(norm_status = 'unknown')
     and bool_and(status_scope = 'extended')
     and bool_and(status_eligible)
     and bool_and(status_reason_code = 'UNCONFIRMED_STATUS')
     and bool_and(legal_status_warning is not null)
   from public.search_legal_corpus_metric('անհայտվիճակ', null, 'knowledge_base', 'extended', null, 10, 100, 50)),
  'extended scope must recover unknown with warning metadata'
);
select pg_temp.assert_true(
  (select count(*) = 0 from public.search_legal_corpus_metric('հիննորմ', null, 'knowledge_base', 'extended', null, 10, 100, 50)),
  'extended scope must exclude repealed'
);
select pg_temp.assert_true(
  (select count(*) = 0 from public.search_legal_corpus_metric('հիննորմ', null, 'knowledge_base', 'current', null, 10, 100, 50)),
  'current scope must exclude repealed'
);
select pg_temp.assert_true(
  (select count(*) = 1
     and bool_and(norm_status = 'repealed')
     and bool_and(status_reason_code = 'REPEALED_HISTORICAL')
   from public.search_legal_corpus_metric('հիննորմ', null, 'knowledge_base', 'historical', null, 10, 100, 50)),
  'historical scope must include repealed'
);
select pg_temp.assert_true(
  (select count(*) = 1 and bool_and(status_reason_code = 'CURRENT_ACTIVE')
   from public.search_legal_corpus_metric('գործողնորմ', null, 'knowledge_base', 'historical', null, 10, 100, 50)),
  'historical scope must include active'
);
select pg_temp.assert_true(
  (select count(*) = 1 and bool_and(status_reason_code = 'UNCONFIRMED_STATUS')
   from public.search_legal_corpus_metric('անհայտվիճակ', null, 'knowledge_base', 'historical', null, 10, 100, 50)),
  'historical scope must include unknown'
);

select pg_temp.assert_true(
  (select count(*) >= 1
     and bool_or(ann_rank is not null)
     and bool_or(route_sources @> array['metric_ann'])
     and max(vector_similarity) > 0.99
   from public.search_legal_corpus_metric(
     'semantic-only-fixture',
     (array[1.0] || array_fill(0.0, array[1023]))::vector(1024),
     'knowledge_base', 'current', null, 10, 100, 50
   )),
  'Metric ANN lane must expose similarity, rank, and route'
);

select pg_temp.assert_true(
  (select count(*) >= 1
     and bool_or(identifier_match)
     and bool_or(route_sources @> array['identifier'])
   from public.search_legal_corpus_metric('arlis:test-active', null, 'knowledge_base', 'current', null, 10, 100, 50)),
  'identifier lane must resolve canonical key'
);

select pg_temp.assert_true(
  (select count(*) >= 1 and bool_or(route_sources @> array['armenian_fts'])
   from public.search_legal_corpus_metric('Փորձնական Վերնագիր', null, 'knowledge_base', 'current', null, 10, 100, 50)),
  'metadata FTS lane must search Armenian title'
);

select pg_temp.assert_true(
  (select count(*) = 1
   from public.search_legal_corpus_metric('կրկնվողբովանդակություն', null, 'knowledge_base', 'current', null, 20, 100, 50)
   where duplicate_group = 'hash-duplicate'),
  'near-duplicate hash must collapse to one chunk'
);

select pg_temp.assert_true(
  (select count(*) = 0
   from public.search_legal_corpus_metric('գործողնորմ', null, 'practice', 'current', null, 10, 100, 50)),
  'content-domain predicate must be enforced'
);
select pg_temp.assert_true(
  (select count(*) = 0
   from public.search_legal_corpus_metric('գործողնորմ', null, 'knowledge_base', 'current', '2019-01-01', 10, 100, 50)),
  'effective-date predicate must exclude not-yet-effective chunks'
);
select pg_temp.assert_true(
  (select count(*) = 0
   from public.search_legal_corpus_metric('հինտարբերակ', null, 'knowledge_base', 'historical', null, 10, 100, 50)),
  'non-current document versions must be excluded'
);
select pg_temp.assert_true(
  (select count(*) = 0
   from public.search_legal_corpus_metric('englishonlyfixture', null, 'knowledge_base', 'current', null, 10, 100, 50)),
  'non-Armenian chunks must be excluded'
);

do $$
begin
  begin
    perform * from public.search_legal_corpus_metric('', null, null, 'current', null, 10, 100, 50);
    raise exception 'ASSERTION_FAILED: empty query accepted';
  exception when sqlstate '22023' then
    if sqlerrm <> 'METRIC_RPC_QUERY_REQUIRED' then raise; end if;
  end;

  begin
    perform * from public.search_legal_corpus_metric('test', null, null, 'invalid', null, 10, 100, 50);
    raise exception 'ASSERTION_FAILED: invalid scope accepted';
  exception when sqlstate '22023' then
    if sqlerrm <> 'METRIC_RPC_INVALID_STATUS_SCOPE' then raise; end if;
  end;

  begin
    perform * from public.search_legal_corpus_metric('test', null, null, 'current', null, 51, 100, 50);
    raise exception 'ASSERTION_FAILED: invalid limit accepted';
  exception when sqlstate '22023' then
    if sqlerrm <> 'METRIC_RPC_INVALID_LIMIT' then raise; end if;
  end;

  begin
    perform * from public.search_legal_corpus_metric(repeat('x', 2001), null, null, 'current', null, 10, 100, 50);
    raise exception 'ASSERTION_FAILED: oversized query accepted';
  exception when sqlstate '22023' then
    if sqlerrm <> 'METRIC_RPC_QUERY_TOO_LONG' then raise; end if;
  end;

  begin
    perform * from public.search_legal_corpus_metric('test', null, null, 'current', null, 10, 19, 50);
    raise exception 'ASSERTION_FAILED: invalid ANN limit accepted';
  exception when sqlstate '22023' then
    if sqlerrm <> 'METRIC_RPC_INVALID_ANN_LIMIT' then raise; end if;
  end;

  begin
    perform * from public.search_legal_corpus_metric('test', null, null, 'current', null, 10, 100, 101);
    raise exception 'ASSERTION_FAILED: invalid FTS limit accepted';
  exception when sqlstate '22023' then
    if sqlerrm <> 'METRIC_RPC_INVALID_FTS_LIMIT' then raise; end if;
  end;

  begin
    perform * from public.search_legal_corpus_metric(
      'test', array[1.0, 0.0]::vector, null, 'current', null, 10, 100, 50
    );
    raise exception 'ASSERTION_FAILED: invalid vector dimension accepted';
  exception when sqlstate '22023' then
    if sqlerrm <> 'METRIC_RPC_INVALID_VECTOR_DIMENSION' then raise; end if;
  end;

  begin
    perform * from public.search_legal_corpus_metric(
      'test', array_fill(0.0, array[1024])::vector(1024), null, 'current', null, 10, 100, 50
    );
    raise exception 'ASSERTION_FAILED: zero vector accepted';
  exception when sqlstate '22023' then
    if sqlerrm <> 'METRIC_RPC_ZERO_VECTOR' then raise; end if;
  end;
end
$$;

rollback;
