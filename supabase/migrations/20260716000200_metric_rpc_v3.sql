-- =============================================================================
-- Prompt 19.7 Phase 15: Metric RPC V3 — Additive Structured Metadata Search
-- Does NOT modify search_legal_corpus_metric, search_legal_corpus_metric_v2,
-- or search_legal_corpus_dual. All existing RPCs remain available for rollback.
-- =============================================================================

create or replace function public.search_legal_corpus_metric_v3(
  p_query_text text,
  p_metric_embedding vector(1024),
  p_content_domain public.content_domain default null,
  p_status_scope text default 'current',
  p_effective_at date default null,
  p_limit integer default 15,
  p_ann_limit integer default 100,
  p_fts_limit integer default 50,
  p_provision_query text default null
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
  identifier_match_type text,
  identifier_match_score real,
  provision_key text,
  canonical_citation text,
  metadata_confidence text,
  metadata_source text,
  document_version_id uuid,
  authority_type text,
  page_source_url text,
  page_from_physical integer,
  page_to_physical integer,
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
set statement_timeout = '15s'
set plan_cache_mode = 'force_custom_plan'
as $function$
declare
  v_query_text text := nullif(btrim(p_query_text), '');
  v_provision_query text := nullif(btrim(p_provision_query), '');
  v_status_scope text := lower(nullif(btrim(p_status_scope), ''));
  v_limit integer := coalesce(p_limit, 15);
  v_ann_limit integer := coalesce(p_ann_limit, 100);
  v_fts_limit integer := coalesce(p_fts_limit, 50);
  v_ann_candidate_limit integer;
  v_fts_candidate_limit integer;
  v_provision_article text;
  v_provision_part text;
  v_provision_point text;
begin
  if v_query_text is null then
    raise exception using errcode = '22023', message = 'METRIC_RPC_V3_QUERY_REQUIRED';
  end if;
  if length(v_query_text) > 2000 then
    raise exception using errcode = '22023', message = 'METRIC_RPC_V3_QUERY_TOO_LONG';
  end if;
  if v_status_scope is null or v_status_scope not in ('current', 'extended', 'historical') then
    raise exception using errcode = '22023', message = 'METRIC_RPC_V3_INVALID_STATUS_SCOPE';
  end if;
  if v_limit < 1 or v_limit > 50 then
    raise exception using errcode = '22023', message = 'METRIC_RPC_V3_INVALID_LIMIT';
  end if;
  if v_ann_limit < 20 or v_ann_limit > 200 then
    raise exception using errcode = '22023', message = 'METRIC_RPC_V3_INVALID_ANN_LIMIT';
  end if;
  if v_fts_limit < 10 or v_fts_limit > 100 then
    raise exception using errcode = '22023', message = 'METRIC_RPC_V3_INVALID_FTS_LIMIT';
  end if;
  if p_metric_embedding is not null then
    if vector_dims(p_metric_embedding) <> 1024 then
      raise exception using errcode = '22023', message = 'METRIC_RPC_V3_INVALID_VECTOR_DIMENSION';
    end if;
    if p_metric_embedding::text ~* '(nan|infinity)' then
      raise exception using errcode = '22023', message = 'METRIC_RPC_V3_NON_FINITE_VECTOR';
    end if;
    if vector_norm(p_metric_embedding) = 0 then
      raise exception using errcode = '22023', message = 'METRIC_RPC_V3_ZERO_VECTOR';
    end if;
  end if;

  -- Extract provision components from provision query or main query
  v_provision_article := nullif(substring(coalesce(v_provision_query, v_query_text) from '(?:article|art\.?|статья|հոդված(?:ի)?)\s*([0-9]+(?:\.[0-9]+)?)'), '');
  v_provision_part := nullif(substring(coalesce(v_provision_query, v_query_text) from '(?:part|часть|մաս(?:ի)?)\s*([0-9]+(?:\.[0-9]+)?)'), '');
  v_provision_point := nullif(substring(coalesce(v_provision_query, v_query_text) from '(?:point|clause|пункт|կետ(?:ի)?)\s*([0-9]+(?:\.[0-9]+)?)'), '');

  v_ann_candidate_limit := least(2000, greatest(v_ann_limit * 5, 100));
  v_fts_candidate_limit := least(800, greatest(v_fts_limit * 8, 80));

  return query
  with recursive
  settings as materialized (
    select
      v_query_text as query_text,
      websearch_to_tsquery('simple'::regconfig, v_query_text) as ts_query,
      regexp_replace(lower(v_query_text), '[^[:alnum:]]+', '', 'g') as normalized_query,
      nullif(substring(v_query_text from '([0-9]+(?:[.][0-9]+)*)'), '') as numeric_query,
      case when v_status_scope in ('current', 'extended')
        then coalesce(p_effective_at, current_date) else p_effective_at end as effective_at,
      v_provision_article as prov_article,
      v_provision_part as prov_part,
      v_provision_point as prov_point
  ),
  -- Lane 1: Exact trusted provision lane (new in V3)
  provision_lane as materialized (
    select sc.chunk_id, 'provision_exact'::text as lane,
      1.0::real as provision_score,
      row_number() over (order by sc.chunk_id) as lane_rank,
      null::real as vector_similarity, null::real as fts_score,
      true as identifier_match,
      'PROVISION_EXACT'::text as identifier_match_type,
      1.0::real as identifier_match_score
    from public.search_chunks sc
    join public.document_versions dv on dv.version_id = sc.version_id and dv.is_current = true
    cross join settings s
    where s.prov_article is not null
      and sc.language_code = 'hy'
      and sc.article_number = s.prov_article
      and (s.prov_part is null or sc.part_number = s.prov_part)
      and (s.prov_point is null or sc.point_number = s.prov_point)
      and (p_content_domain is null or sc.content_domain = p_content_domain)
      and (
        sc.norm_status = 'active'
        or (v_status_scope = 'extended' and sc.norm_status = 'unknown')
        or (v_status_scope = 'historical' and sc.norm_status in ('unknown', 'repealed'))
      )
      and (s.effective_at is null or (
        (sc.effective_from is null or sc.effective_from <= s.effective_at)
        and (sc.effective_to is null or sc.effective_to > s.effective_at)
      ))
    limit 20
  ),
  -- Lane 2: Also check legal_provisions additive table for high-confidence matches
  legal_provision_lane as materialized (
    select sc.chunk_id, 'legal_provision'::text as lane,
      case when lp.confidence = 'high' then 0.95
           when lp.confidence = 'medium' then 0.80
           else 0.50 end::real as provision_score,
      row_number() over (order by case when lp.confidence = 'high' then 0 when lp.confidence = 'medium' then 1 else 2 end, sc.chunk_id) as lane_rank,
      null::real as vector_similarity, null::real as fts_score,
      true as identifier_match,
      'LEGAL_PROVISION'::text as identifier_match_type,
      case when lp.confidence = 'high' then 0.95
           when lp.confidence = 'medium' then 0.80
           else 0.50 end::real as identifier_match_score
    from public.legal_provisions lp
    join public.search_chunks sc on sc.chunk_id = lp.chunk_id
    join public.document_versions dv on dv.version_id = sc.version_id and dv.is_current = true
    cross join settings s
    where s.prov_article is not null
      and lp.article = s.prov_article
      and (s.prov_part is null or lp.part = s.prov_part)
      and (s.prov_point is null or lp.point = s.prov_point)
      and lp.review_status in ('pending', 'approved')
      and sc.language_code = 'hy'
      and (p_content_domain is null or sc.content_domain = p_content_domain)
      and (
        sc.norm_status = 'active'
        or (v_status_scope = 'extended' and sc.norm_status = 'unknown')
        or (v_status_scope = 'historical' and sc.norm_status in ('unknown', 'repealed'))
      )
      and (s.effective_at is null or (
        (sc.effective_from is null or sc.effective_from <= s.effective_at)
        and (sc.effective_to is null or sc.effective_to > s.effective_at)
      ))
    limit 20
  ),
  -- Lane 3: Exact document/title/number identifier lane
  identifier_lane as materialized (
    select sc.chunk_id, 'identifier'::text as lane,
      null::real as provision_score,
      row_number() over (order by sc.chunk_id) as lane_rank,
      null::real as vector_similarity, null::real as fts_score,
      true as identifier_match,
      'IDENTIFIER_EXACT'::text as identifier_match_type,
      1.0::real as identifier_match_score
    from public.search_chunks sc
    join public.documents d on d.document_id = sc.document_id
    join public.document_versions dv on dv.version_id = sc.version_id and dv.is_current = true
    cross join settings s
    where sc.language_code = 'hy'
      and (p_content_domain is null or sc.content_domain = p_content_domain)
      and (
        (d.doc_number_clean is not null and d.doc_number_clean = s.normalized_query)
        or (d.arlis_doc_id is not null and d.arlis_doc_id = s.normalized_query)
        or (d.canonical_key is not null and d.canonical_key = s.normalized_query)
      )
      and (
        sc.norm_status = 'active'
        or (v_status_scope = 'extended' and sc.norm_status = 'unknown')
        or (v_status_scope = 'historical' and sc.norm_status in ('unknown', 'repealed'))
      )
      and (s.effective_at is null or (
        (sc.effective_from is null or sc.effective_from <= s.effective_at)
        and (sc.effective_to is null or sc.effective_to > s.effective_at)
      ))
    limit 20
  ),
  -- Lane 4: Metric ANN
  metric_candidates as materialized (
    select e.chunk_id, (1.0 - (e.vector <=> p_metric_embedding))::real as vector_similarity
    from public.embeddings e
    where p_metric_embedding is not null
      and e.model = 'armenian-text-embeddings-2-large'
      and e.dimension = 1024
      and e.status = 'success'
      and e.vector is not null
    order by e.vector <=> p_metric_embedding
    limit v_ann_candidate_limit
  ),
  metric_raw as materialized (
    select mc.chunk_id, mc.vector_similarity
    from metric_candidates mc
    join public.search_chunks sc on sc.chunk_id = mc.chunk_id
    join public.document_versions dv on dv.version_id = sc.version_id and dv.is_current = true
    cross join settings s
    where sc.language_code = 'hy'
      and (p_content_domain is null or sc.content_domain = p_content_domain)
      and (
        sc.norm_status = 'active'
        or (v_status_scope = 'extended' and sc.norm_status = 'unknown')
        or (v_status_scope = 'historical' and sc.norm_status in ('unknown', 'repealed'))
      )
      and (s.effective_at is null or (
        (sc.effective_from is null or sc.effective_from <= s.effective_at)
        and (sc.effective_to is null or sc.effective_to > s.effective_at)
      ))
    order by mc.vector_similarity desc
    limit v_ann_limit
  ),
  metric_lane as (
    select mr.chunk_id, 'metric_ann'::text as lane,
      null::real as provision_score,
      row_number() over (order by mr.vector_similarity desc, mr.chunk_id) as lane_rank,
      mr.vector_similarity, null::real as fts_score, false as identifier_match,
      null::text as identifier_match_type, null::real as identifier_match_score
    from metric_raw mr
  ),
  -- Lane 5: Sanitized Armenian FTS
  chunk_fts_candidates as materialized (
    select sc.chunk_id, sc.fts_vector
    from public.search_chunks sc
    join public.document_versions dv on dv.version_id = sc.version_id and dv.is_current = true
    cross join settings s
    where sc.language_code = 'hy'
      and (p_content_domain is null or sc.content_domain = p_content_domain)
      and sc.fts_vector @@ s.ts_query
      and (
        sc.norm_status = 'active'
        or (v_status_scope = 'extended' and sc.norm_status = 'unknown')
        or (v_status_scope = 'historical' and sc.norm_status in ('unknown', 'repealed'))
      )
      and (s.effective_at is null or (
        (sc.effective_from is null or sc.effective_from <= s.effective_at)
        and (sc.effective_to is null or sc.effective_to > s.effective_at)
      ))
    limit v_fts_candidate_limit
  ),
  chunk_fts_raw as materialized (
    select cfc.chunk_id, ts_rank_cd(cfc.fts_vector, s.ts_query)::real as fts_score
    from chunk_fts_candidates cfc cross join settings s
    order by fts_score desc, cfc.chunk_id
    limit v_fts_limit
  ),
  fts_lane as (
    select cf.chunk_id, 'armenian_fts'::text as lane,
      null::real as provision_score,
      row_number() over (order by cf.fts_score desc, cf.chunk_id) as lane_rank,
      null::real as vector_similarity, cf.fts_score, false as identifier_match,
      null::text as identifier_match_type, null::real as identifier_match_score
    from chunk_fts_raw cf
  ),
  -- Combine all lanes
  lane_rows as (
    select * from provision_lane
    union all select * from legal_provision_lane
    union all select * from identifier_lane
    union all select * from metric_lane
    union all select * from fts_lane
  ),
  fused as materialized (
    select lr.chunk_id,
      sum(case lr.lane
        when 'provision_exact' then 4.0 / (60.0 + lr.lane_rank)
        when 'legal_provision' then 3.5 / (60.0 + lr.lane_rank)
        when 'identifier' then 3.0 / (60.0 + lr.lane_rank)
        when 'metric_ann' then 1.5 / (60.0 + lr.lane_rank)
        else 1.0 / (60.0 + lr.lane_rank) end)::real as rrf_score,
      max(lr.vector_similarity)::real as vector_similarity,
      min(lr.lane_rank) filter (where lr.lane = 'metric_ann') as ann_rank,
      max(lr.fts_score)::real as fts_score,
      min(lr.lane_rank) filter (where lr.lane = 'armenian_fts') as fts_rank,
      bool_or(lr.identifier_match) as identifier_match,
      max(lr.identifier_match_type) as identifier_match_type,
      max(lr.identifier_match_score)::real as identifier_match_score,
      array_agg(lr.lane order by case lr.lane
        when 'provision_exact' then 0
        when 'legal_provision' then 1
        when 'identifier' then 2
        when 'metric_ann' then 3 else 4 end) as route_sources
    from lane_rows lr group by lr.chunk_id
  ),
  enriched as materialized (
    select sc.chunk_id, sc.document_id, sc.version_id, d.canonical_key as doc_id,
      coalesce(d.title_hy, d.title_en, d.title_ru, d.canonical_key) as title,
      left(sc.text, 900) as text_snippet, sc.source_url, sc.citation_anchor,
      sc.language_code as language,
      case when d.canonical_key like 'echr:%' then 'echr'
        when d.canonical_key like 'venice:%' then 'venice'
        when d.arlis_doc_id is not null then 'arlis'
        else coalesce(d.source_metadata ->> 'source', 'armenian_legal') end as source,
      sc.content_domain, sc.norm_status, sc.effective_from, sc.effective_to,
      sc.chunk_text_sha256 as duplicate_group,
      f.rrf_score, f.vector_similarity, f.ann_rank, f.fts_score, f.fts_rank,
      f.identifier_match, f.identifier_match_type, f.identifier_match_score, f.route_sources,
      -- Join legal_provisions for metadata enrichment
      lp.provision_key, lp.canonical_citation,
      coalesce(lp.confidence, case when sc.article_number is not null then 'medium' else null end) as metadata_confidence,
      case when lp.provision_id is not null then 'legal_provisions'
           when sc.article_number is not null then 'search_chunks'
           else null end as metadata_source,
      -- Join legal_document_metadata for authority
      ldm.authority_type,
      ldm.source_url as meta_source_url,
      -- Join legal_source_page_mappings for page mapping
      lpm.page_from_physical, lpm.page_to_physical,
      row_number() over (partition by coalesce(nullif(sc.chunk_text_sha256, ''), sc.chunk_id::text)
        order by f.rrf_score desc, sc.chunk_id) as duplicate_rank
    from fused f
    join public.search_chunks sc on sc.chunk_id = f.chunk_id
    join public.documents d on d.document_id = sc.document_id
    left join public.legal_provisions lp on lp.chunk_id = sc.chunk_id
      and lp.review_status in ('pending', 'approved')
      and lp.parser_version = 'prompt19_7_v1'
    left join public.legal_document_metadata ldm on ldm.document_id = sc.document_id
      and ldm.review_status in ('pending', 'approved')
      and ldm.parser_version = 'prompt19_7_v1'
    left join public.legal_source_page_mappings lpm on lpm.chunk_id = sc.chunk_id
  ),
  deduplicated as materialized (
    select e.*, row_number() over (partition by e.document_id order by e.rrf_score desc, e.chunk_id)::integer as document_rank
    from enriched e where e.duplicate_rank = 1
  ),
  document_capped as materialized (
    select d.*, row_number() over (partition by d.source order by d.rrf_score desc, d.chunk_id)::integer as source_rank
    from deduplicated d where d.document_rank <= 3
  )
  select dc.chunk_id, dc.document_id, dc.version_id, dc.doc_id, dc.title, dc.text_snippet,
    coalesce(dc.meta_source_url, dc.source_url) as source_url,
    dc.citation_anchor, dc.language, dc.source, dc.content_domain, dc.norm_status,
    v_status_scope, true,
    case when dc.norm_status = 'active' then 'CURRENT_ACTIVE'
      when dc.norm_status = 'unknown' then 'UNCONFIRMED_STATUS' else 'REPEALED_HISTORICAL' end,
    case when dc.norm_status = 'unknown' then 'Status unconfirmed.'
      when dc.norm_status = 'repealed' then 'Document repealed or inactive.' else null end,
    dc.effective_from, dc.effective_to, dc.rrf_score, dc.rrf_score, dc.vector_similarity,
    dc.ann_rank, dc.fts_score, dc.fts_rank, dc.identifier_match,
    dc.identifier_match_type, dc.identifier_match_score,
    dc.provision_key, dc.canonical_citation, dc.metadata_confidence, dc.metadata_source,
    dc.version_id, dc.authority_type, coalesce(dc.meta_source_url, dc.source_url),
    dc.page_from_physical, dc.page_to_physical,
    dc.duplicate_group, dc.document_rank, dc.source_rank, dc.route_sources,
    case when dc.ann_rank is not null then 'armenian-text-embeddings-2-large' else 'fts:simple' end,
    array_to_string(dc.route_sources, '+'),
    case
      when dc.identifier_match_type = 'PROVISION_EXACT' then 'provision_exact'
      when dc.identifier_match_type = 'LEGAL_PROVISION' then 'legal_provision'
      when dc.identifier_match then 'identifier_exact'
      when dc.ann_rank is not null and dc.fts_rank is not null then 'metric_fts_fusion'
      when dc.ann_rank is not null then 'metric_dense' else 'armenian_fts' end
  from document_capped dc
  order by
    case when dc.identifier_match_type in ('PROVISION_EXACT', 'LEGAL_PROVISION') then 0 else 1 end,
    floor((dc.source_rank - 1) / 2.0),
    dc.rrf_score desc, dc.chunk_id
  limit v_limit;
end
$function$;

comment on function public.search_legal_corpus_metric_v3(
  text, vector, public.content_domain, text, date, integer, integer, integer, text
) is 'V3: Metric-only structured Armenian legal retrieval with provision lane and additive metadata joins.';

revoke all on function public.search_legal_corpus_metric_v3(
  text, vector, public.content_domain, text, date, integer, integer, integer, text
) from public, anon, authenticated;

grant execute on function public.search_legal_corpus_metric_v3(
  text, vector, public.content_domain, text, date, integer, integer, integer, text
) to service_role;
