-- Prompt 19.1: additive Metric-only retrieval. The legacy dual/Qwen path is
-- intentionally retained for rollback and is not called by the new runtime.

create index documents_metric_search_fts_idx
  on public.documents
  using gin ((
    setweight(to_tsvector('simple'::regconfig, coalesce(title_hy, '')), 'A') ||
    setweight(to_tsvector('simple'::regconfig, coalesce(canonical_key, '')), 'A') ||
    setweight(to_tsvector('simple'::regconfig, coalesce(arlis_doc_id, '')), 'A') ||
    setweight(to_tsvector('simple'::regconfig, coalesce(doc_number_clean, '')), 'A') ||
    setweight(to_tsvector('simple'::regconfig, coalesce(doc_number_raw, '')), 'B') ||
    setweight(to_tsvector('simple'::regconfig, coalesce(source_metadata ->> 'legal_id', '')), 'A')
  ));

create or replace function public.search_legal_corpus_metric(
  p_query_text text,
  p_metric_embedding vector(1024),
  p_content_domain public.content_domain default null,
  p_status_scope text default 'current',
  p_effective_at date default null,
  p_limit integer default 15,
  p_ann_limit integer default 100,
  p_fts_limit integer default 50
)
returns table (
  chunk_id uuid,
  document_id uuid,
  version_id uuid,
  doc_id text,
  title text,
  text_snippet text,
  source_url text,
  citation_anchor text,
  language text,
  source text,
  content_domain public.content_domain,
  norm_status public.normalized_status,
  status_scope text,
  status_eligible boolean,
  status_reason_code text,
  legal_status_warning text,
  effective_from date,
  effective_to date,
  score real,
  rrf_score real,
  vector_similarity real,
  ann_rank bigint,
  fts_score real,
  fts_rank bigint,
  identifier_match boolean,
  duplicate_group text,
  document_rank integer,
  source_rank integer,
  route_sources text[],
  retrieval_model text,
  retrieval_route text,
  match_reason text
)
language plpgsql
stable
security invoker
set search_path = public, extensions, pg_temp
set statement_timeout = '60s'
set plan_cache_mode = 'force_custom_plan'
as $function$
declare
  v_query_text text := nullif(btrim(p_query_text), '');
  v_status_scope text := lower(nullif(btrim(p_status_scope), ''));
  v_limit integer := coalesce(p_limit, 15);
  v_ann_limit integer := coalesce(p_ann_limit, 100);
  v_fts_limit integer := coalesce(p_fts_limit, 50);
begin
  if v_query_text is null then
    raise exception using errcode = '22023', message = 'METRIC_RPC_QUERY_REQUIRED';
  end if;

  if length(v_query_text) > 2000 then
    raise exception using errcode = '22023', message = 'METRIC_RPC_QUERY_TOO_LONG';
  end if;

  if v_status_scope is null or v_status_scope not in ('current', 'extended', 'historical') then
    raise exception using errcode = '22023', message = 'METRIC_RPC_INVALID_STATUS_SCOPE';
  end if;

  if v_limit < 1 or v_limit > 50 then
    raise exception using errcode = '22023', message = 'METRIC_RPC_INVALID_LIMIT';
  end if;

  if v_ann_limit < 20 or v_ann_limit > 200 then
    raise exception using errcode = '22023', message = 'METRIC_RPC_INVALID_ANN_LIMIT';
  end if;

  if v_fts_limit < 10 or v_fts_limit > 100 then
    raise exception using errcode = '22023', message = 'METRIC_RPC_INVALID_FTS_LIMIT';
  end if;

  if p_metric_embedding is not null then
    if vector_dims(p_metric_embedding) <> 1024 then
      raise exception using errcode = '22023', message = 'METRIC_RPC_INVALID_VECTOR_DIMENSION';
    end if;

    if p_metric_embedding::text ~* '(nan|infinity)' then
      raise exception using errcode = '22023', message = 'METRIC_RPC_NON_FINITE_VECTOR';
    end if;

    if vector_norm(p_metric_embedding) = 0 then
      raise exception using errcode = '22023', message = 'METRIC_RPC_ZERO_VECTOR';
    end if;
  end if;

  return query
  with recursive
  settings as materialized (
    select
      v_query_text as query_text,
      websearch_to_tsquery('simple'::regconfig, v_query_text) as ts_query,
      regexp_replace(lower(v_query_text), '[^[:alnum:]]+', '', 'g') as normalized_query,
      nullif(substring(v_query_text from '([0-9]+(?:[.][0-9]+)*)'), '') as numeric_query,
      case
        when v_status_scope in ('current', 'extended') then coalesce(p_effective_at, current_date)
        else p_effective_at
      end as effective_at
  ),
  metric_raw as materialized (
    select
      e.chunk_id,
      (1.0 - (e.vector <=> p_metric_embedding))::real as vector_similarity
    from public.embeddings e
    join public.search_chunks sc on sc.chunk_id = e.chunk_id
    join public.document_versions dv
      on dv.version_id = sc.version_id
     and dv.is_current = true
    cross join settings s
    where p_metric_embedding is not null
      and e.model = 'armenian-text-embeddings-2-large'
      and e.dimension = 1024
      and e.status = 'success'
      and e.vector is not null
      and sc.language_code = 'hy'
      and (p_content_domain is null or sc.content_domain = p_content_domain)
      and (
        sc.norm_status = 'active'
        or (v_status_scope = 'extended' and sc.norm_status = 'unknown')
        or (v_status_scope = 'historical' and sc.norm_status in ('unknown', 'repealed'))
      )
      and (
        s.effective_at is null
        or (
          (sc.effective_from is null or sc.effective_from <= s.effective_at)
          and (sc.effective_to is null or sc.effective_to > s.effective_at)
        )
      )
    order by e.vector <=> p_metric_embedding, e.chunk_id
    limit v_ann_limit
  ),
  metric_lane as (
    select
      mr.chunk_id,
      'metric_ann'::text as lane,
      row_number() over (order by mr.vector_similarity desc, mr.chunk_id) as lane_rank,
      mr.vector_similarity,
      null::real as fts_score,
      false as identifier_match
    from metric_raw mr
  ),
  identifier_documents as materialized (
    select d.document_id
    from public.documents d
    cross join settings s
    where s.normalized_query <> ''
      and (
        regexp_replace(lower(coalesce(d.canonical_key, '')), '[^[:alnum:]]+', '', 'g') = s.normalized_query
        or regexp_replace(lower(coalesce(d.arlis_doc_id, '')), '[^[:alnum:]]+', '', 'g') = s.normalized_query
        or regexp_replace(lower(coalesce(d.doc_number_clean, '')), '[^[:alnum:]]+', '', 'g') = s.normalized_query
        or regexp_replace(lower(coalesce(d.doc_number_raw, '')), '[^[:alnum:]]+', '', 'g') = s.normalized_query
        or lower(btrim(coalesce(d.title_hy, ''))) = lower(s.query_text)
        or lower(btrim(coalesce(d.source_metadata ->> 'case_number', ''))) = lower(s.query_text)
        or lower(btrim(coalesce(d.source_metadata ->> 'legal_id', ''))) = lower(s.query_text)
        or d.issued_date::text = s.query_text
      )
    order by d.document_id
    limit v_fts_limit
  ),
  identifier_raw as materialized (
    select distinct on (sc.chunk_id)
      sc.chunk_id,
      case
        when id.document_id is not null then 1.0::real
        when s.normalized_query <> '' and regexp_replace(lower(coalesce(sc.citation_anchor, '')), '[^[:alnum:]]+', '', 'g') = s.normalized_query then 0.95::real
        when s.numeric_query is not null and sc.article_number = s.numeric_query then 0.90::real
        when s.numeric_query is not null and sc.legal_unit_number = s.numeric_query then 0.85::real
        when s.numeric_query is not null and sc.part_number = s.numeric_query then 0.80::real
        when s.numeric_query is not null and sc.point_number = s.numeric_query then 0.75::real
        else 0.70::real
      end as identifier_score
    from public.search_chunks sc
    join public.document_versions dv
      on dv.version_id = sc.version_id
     and dv.is_current = true
    cross join settings s
    left join identifier_documents id on id.document_id = sc.document_id
    where sc.language_code = 'hy'
      and (p_content_domain is null or sc.content_domain = p_content_domain)
      and (
        sc.norm_status = 'active'
        or (v_status_scope = 'extended' and sc.norm_status = 'unknown')
        or (v_status_scope = 'historical' and sc.norm_status in ('unknown', 'repealed'))
      )
      and (
        s.effective_at is null
        or (
          (sc.effective_from is null or sc.effective_from <= s.effective_at)
          and (sc.effective_to is null or sc.effective_to > s.effective_at)
        )
      )
      and (
        id.document_id is not null
        or (s.normalized_query <> '' and regexp_replace(lower(coalesce(sc.citation_anchor, '')), '[^[:alnum:]]+', '', 'g') = s.normalized_query)
        or (s.numeric_query is not null and sc.article_number = s.numeric_query)
        or (s.numeric_query is not null and sc.legal_unit_number = s.numeric_query)
        or (s.numeric_query is not null and sc.part_number = s.numeric_query)
        or (s.numeric_query is not null and sc.point_number = s.numeric_query)
        or (s.numeric_query is not null and sc.paragraph_number = s.numeric_query)
        or lower(btrim(sc.text)) = lower(btrim(s.query_text, '"'))
      )
    order by sc.chunk_id, identifier_score desc
    limit v_fts_limit
  ),
  identifier_lane as (
    select
      ir.chunk_id,
      'identifier'::text as lane,
      row_number() over (order by ir.identifier_score desc, ir.chunk_id) as lane_rank,
      null::real as vector_similarity,
      null::real as fts_score,
      true as identifier_match
    from identifier_raw ir
  ),
  metadata_fts_documents as materialized (
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
      )::real as metadata_fts_score
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
    order by metadata_fts_score desc, d.document_id
    limit v_fts_limit
  ),
  chunk_fts_raw as materialized (
    select
      sc.chunk_id,
      ts_rank_cd(sc.fts_vector, s.ts_query)::real as fts_score
    from public.search_chunks sc
    join public.document_versions dv
      on dv.version_id = sc.version_id
     and dv.is_current = true
    cross join settings s
    where sc.language_code = 'hy'
      and sc.fts_vector @@ s.ts_query
      and (p_content_domain is null or sc.content_domain = p_content_domain)
      and (
        sc.norm_status = 'active'
        or (v_status_scope = 'extended' and sc.norm_status = 'unknown')
        or (v_status_scope = 'historical' and sc.norm_status in ('unknown', 'repealed'))
      )
      and (
        s.effective_at is null
        or (
          (sc.effective_from is null or sc.effective_from <= s.effective_at)
          and (sc.effective_to is null or sc.effective_to > s.effective_at)
        )
      )
    order by fts_score desc, sc.chunk_id
    limit v_fts_limit
  ),
  metadata_fts_raw as materialized (
    select
      sc.chunk_id,
      mfd.metadata_fts_score as fts_score,
      row_number() over (
        partition by sc.document_id
        order by (sc.article_number is null), sc.article_number, sc.chunk_id
      ) as per_document_rank
    from metadata_fts_documents mfd
    join public.search_chunks sc on sc.document_id = mfd.document_id
    join public.document_versions dv
      on dv.version_id = sc.version_id
     and dv.is_current = true
    cross join settings s
    where sc.language_code = 'hy'
      and (p_content_domain is null or sc.content_domain = p_content_domain)
      and (
        sc.norm_status = 'active'
        or (v_status_scope = 'extended' and sc.norm_status = 'unknown')
        or (v_status_scope = 'historical' and sc.norm_status in ('unknown', 'repealed'))
      )
      and (
        s.effective_at is null
        or (
          (sc.effective_from is null or sc.effective_from <= s.effective_at)
          and (sc.effective_to is null or sc.effective_to > s.effective_at)
        )
      )
  ),
  fts_raw as materialized (
    select cfr.chunk_id, cfr.fts_score
    from chunk_fts_raw cfr
    union all
    select mfr.chunk_id, mfr.fts_score
    from metadata_fts_raw mfr
    where mfr.per_document_rank <= 2
  ),
  fts_merged as (
    select fr.chunk_id, max(fr.fts_score)::real as fts_score
    from fts_raw fr
    group by fr.chunk_id
    order by max(fr.fts_score) desc, fr.chunk_id
    limit v_fts_limit
  ),
  fts_lane as (
    select
      fm.chunk_id,
      'armenian_fts'::text as lane,
      row_number() over (order by fm.fts_score desc, fm.chunk_id) as lane_rank,
      null::real as vector_similarity,
      fm.fts_score,
      false as identifier_match
    from fts_merged fm
  ),
  lane_rows as (
    select * from identifier_lane
    union all
    select * from metric_lane
    union all
    select * from fts_lane
  ),
  fused as materialized (
    select
      lr.chunk_id,
      sum(
        case lr.lane
          when 'identifier' then 3.0 / (60.0 + lr.lane_rank)
          when 'metric_ann' then 1.5 / (60.0 + lr.lane_rank)
          else 1.0 / (60.0 + lr.lane_rank)
        end
      )::real as rrf_score,
      max(lr.vector_similarity)::real as vector_similarity,
      min(lr.lane_rank) filter (where lr.lane = 'metric_ann') as ann_rank,
      max(lr.fts_score)::real as fts_score,
      min(lr.lane_rank) filter (where lr.lane = 'armenian_fts') as fts_rank,
      bool_or(lr.identifier_match) as identifier_match,
      array_agg(lr.lane order by
        case lr.lane when 'identifier' then 1 when 'metric_ann' then 2 else 3 end
      ) as route_sources
    from lane_rows lr
    group by lr.chunk_id
  ),
  enriched as materialized (
    select
      sc.chunk_id,
      sc.document_id,
      sc.version_id,
      d.canonical_key as doc_id,
      coalesce(d.title_hy, d.title_en, d.title_ru, d.canonical_key) as title,
      left(sc.text, 900) as text_snippet,
      sc.source_url,
      sc.citation_anchor,
      sc.language_code as language,
      case
        when d.canonical_key like 'echr:%' then 'echr'
        when d.canonical_key like 'venice:%' then 'venice'
        when d.arlis_doc_id is not null then 'arlis'
        else coalesce(d.source_metadata ->> 'source', 'armenian_legal')
      end as source,
      sc.content_domain,
      sc.norm_status,
      sc.effective_from,
      sc.effective_to,
      sc.chunk_text_sha256 as duplicate_group,
      f.rrf_score,
      f.vector_similarity,
      f.ann_rank,
      f.fts_score,
      f.fts_rank,
      f.identifier_match,
      f.route_sources,
      row_number() over (
        partition by coalesce(nullif(sc.chunk_text_sha256, ''), sc.chunk_id::text)
        order by f.rrf_score desc, sc.chunk_id
      ) as duplicate_rank
    from fused f
    join public.search_chunks sc on sc.chunk_id = f.chunk_id
    join public.documents d on d.document_id = sc.document_id
  ),
  deduplicated as materialized (
    select
      e.*,
      row_number() over (
        partition by e.document_id
        order by e.rrf_score desc, e.chunk_id
      )::integer as document_rank
    from enriched e
    where e.duplicate_rank = 1
  ),
  document_capped as materialized (
    select
      d.*,
      row_number() over (
        partition by d.source
        order by d.rrf_score desc, d.chunk_id
      )::integer as source_rank
    from deduplicated d
    where d.document_rank <= 3
  )
  select
    dc.chunk_id,
    dc.document_id,
    dc.version_id,
    dc.doc_id,
    dc.title,
    dc.text_snippet,
    dc.source_url,
    dc.citation_anchor,
    dc.language,
    dc.source,
    dc.content_domain,
    dc.norm_status,
    v_status_scope as status_scope,
    true as status_eligible,
    case
      when dc.norm_status = 'active' then 'CURRENT_ACTIVE'
      when dc.norm_status = 'unknown' then 'UNCONFIRMED_STATUS'
      else 'REPEALED_HISTORICAL'
    end as status_reason_code,
    case
      when dc.norm_status = 'unknown' then 'Статус действия документа не подтверждён.'
      when dc.norm_status = 'repealed' then 'Документ утратил силу или помечен как недействующий.'
      else null
    end as legal_status_warning,
    dc.effective_from,
    dc.effective_to,
    dc.rrf_score as score,
    dc.rrf_score,
    dc.vector_similarity,
    dc.ann_rank,
    dc.fts_score,
    dc.fts_rank,
    dc.identifier_match,
    dc.duplicate_group,
    dc.document_rank,
    dc.source_rank,
    dc.route_sources,
    case
      when dc.ann_rank is not null then 'armenian-text-embeddings-2-large'
      else 'fts:simple'
    end as retrieval_model,
    array_to_string(dc.route_sources, '+') as retrieval_route,
    case
      when dc.identifier_match then 'identifier_exact'
      when dc.ann_rank is not null and dc.fts_rank is not null then 'metric_fts_fusion'
      when dc.ann_rank is not null then 'metric_dense'
      else 'armenian_fts'
    end as match_reason
  from document_capped dc
  order by
    floor((dc.source_rank - 1) / 2.0),
    dc.rrf_score desc,
    dc.chunk_id
  limit v_limit;
end
$function$;

comment on function public.search_legal_corpus_metric(
  text, vector, public.content_domain, text, date, integer, integer, integer
) is 'Metric-only Armenian legal retrieval with current/extended/historical status scopes and weighted RRF.';

revoke all on function public.search_legal_corpus_metric(
  text, vector, public.content_domain, text, date, integer, integer, integer
) from public, anon, authenticated;

grant execute on function public.search_legal_corpus_metric(
  text, vector, public.content_domain, text, date, integer, integer, integer
) to service_role;
