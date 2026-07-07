-- =============================================================================
-- S3 latency fix — search_legal_corpus_dual: inline the query vector as a
-- literal so pgvector uses the partial IVFFlat indexes (custom plan).
-- =============================================================================
-- Root cause: LANGUAGE sql (non-inlinable) AND plpgsql EXECUTE ... USING both
-- bind the query vector as a runtime parameter => generic plan => pgvector
-- ignores the IVF index => full sort of ~1.33M / ~163k vectors (~60-80s).
--
-- Every fast result in testing used the vector as a LITERAL constant
-- (Index Scan, cost ~4,343). So this version builds the ANN query with the
-- vector inlined via format(%L)::vector(1024) — a constant => custom plan =>
--   armenian-text-embeddings-2-large -> embeddings_ivf_metric_idx
--   qwen3-embedding-0.6b             -> embeddings_ivf_qwen_idx
-- The inlined value is a numeric array cast to text (format %L quotes it), so
-- there is no injection surface. Non-vector inputs are inlined via format too.
--
-- PRESERVED: exact signature, 18-column return schema, S2 over-fetch
-- (candidate_limit = least(500, greatest(150, final_limit*5))), all filters,
-- RRF fusion, final limit, and metadata output. No embeddings/chunks/indexes/
-- providers/edge functions touched.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.search_legal_corpus_dual(
  p_query_text text,
  p_metric_embedding vector DEFAULT NULL::vector,
  p_qwen_embedding vector DEFAULT NULL::vector,
  p_content_domain content_domain DEFAULT NULL::content_domain,
  p_norm_status normalized_status DEFAULT NULL::normalized_status,
  p_limit integer DEFAULT 10,
  p_metric_limit integer DEFAULT 30,
  p_qwen_limit integer DEFAULT 30,
  p_bm25_limit integer DEFAULT 30,
  p_effective_at date DEFAULT NULL::date
)
 RETURNS TABLE(chunk_id uuid, document_id uuid, version_id uuid, doc_id text, title text, text_snippet text, source_url text, citation_anchor text, language text, source text, content_domain content_domain, norm_status normalized_status, score real, vector_score real, fts_score real, retrieval_model text, retrieval_route text, match_reason text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
 SET statement_timeout TO '60000'
AS $function$
declare
  v_final int := least(greatest(coalesce(p_limit,10),1),100);
  v_bm25  int := least(greatest(coalesce(p_bm25_limit,30),1),120);
  v_cand  int := least(500, greatest(150, least(greatest(coalesce(p_limit,10),1),100) * 5));
  v_sql   text;
begin
  v_sql := format($t$
    with settings as (select nullif(trim(coalesce(%4$L::text,'')),'') as query_text),
    metric_ann as materialized (
      select e.chunk_id, (1.0-(e.vector <=> %2$L::vector(1024)))::float4 as sim
      from public.embeddings e
      where %2$L::vector(1024) is not null and e.model='armenian-text-embeddings-2-large' and e.status='success'
      order by e.vector <=> %2$L::vector(1024) limit %1$s
    ),
    qwen_ann as materialized (
      select e.chunk_id, (1.0-(e.vector <=> %3$L::vector(1024)))::float4 as sim
      from public.embeddings e
      where %3$L::vector(1024) is not null and e.model='qwen3-embedding-0.6b' and e.status='success'
      order by e.vector <=> %3$L::vector(1024) limit %1$s
    ),
    metric_candidates as (
      select sc.chunk_id, sc.document_id, sc.version_id, d.canonical_key as doc_id,
        coalesce(d.title_hy,d.title_en,d.title_ru,d.canonical_key) as title, left(sc.text,900) as text_snippet,
        sc.source_url, sc.citation_anchor, sc.language_code as language,
        case when d.canonical_key like 'venice:%%' then 'venice' when d.arlis_doc_id is not null then 'arlis' else coalesce(d.source_metadata->>'source','armenian_legal') end as source,
        sc.content_domain, sc.norm_status, a.sim as score, a.sim as vector_score, 0.0::float4 as fts_score,
        'armenian-text-embeddings-2-large'::text as retrieval_model, 'metric_hy'::text as retrieval_route, 'metric_dense'::text as match_reason
      from metric_ann a
      join public.search_chunks sc on sc.chunk_id=a.chunk_id
      join public.document_versions dv on dv.version_id=sc.version_id and dv.is_current=true
      join public.documents d on d.document_id=sc.document_id
      where sc.language_code='hy' and d.canonical_key not like 'echr:%%'
        and (%5$L::content_domain is null or sc.content_domain=%5$L::content_domain)
        and (%6$L::normalized_status is null or sc.norm_status=%6$L::normalized_status)
        and (%7$L::date is null or sc.effective_from is null or (sc.effective_from<=%7$L::date and (sc.effective_to is null or sc.effective_to>%7$L::date)))
    ),
    qwen_candidates as (
      select sc.chunk_id, sc.document_id, sc.version_id, d.canonical_key as doc_id,
        coalesce(d.title_en,d.title_hy,d.title_ru,d.canonical_key) as title, left(sc.text,900) as text_snippet,
        sc.source_url, sc.citation_anchor, sc.language_code as language, 'echr'::text as source,
        sc.content_domain, sc.norm_status, a.sim as score, a.sim as vector_score, 0.0::float4 as fts_score,
        'qwen3-embedding-0.6b'::text as retrieval_model, 'qwen_echr'::text as retrieval_route, 'qwen_dense'::text as match_reason
      from qwen_ann a
      join public.search_chunks sc on sc.chunk_id=a.chunk_id
      join public.document_versions dv on dv.version_id=sc.version_id and dv.is_current=true
      join public.documents d on d.document_id=sc.document_id
      where d.canonical_key like 'echr:%%' and sc.language_code in ('en','fr')
        and (%5$L::content_domain is null or sc.content_domain=%5$L::content_domain)
        and (%6$L::normalized_status is null or sc.norm_status=%6$L::normalized_status)
    ),
    bm25_candidates as (
      select sc.chunk_id, sc.document_id, sc.version_id, d.canonical_key as doc_id,
        coalesce(d.title_hy,d.title_en,d.title_ru,d.canonical_key) as title, left(sc.text,900) as text_snippet,
        sc.source_url, sc.citation_anchor, sc.language_code as language,
        case when d.canonical_key like 'echr:%%' then 'echr' when d.canonical_key like 'venice:%%' then 'venice' when d.arlis_doc_id is not null then 'arlis' else coalesce(d.source_metadata->>'source','legal') end as source,
        sc.content_domain, sc.norm_status,
        ts_rank_cd(sc.fts_vector, websearch_to_tsquery('simple', s.query_text))::float4 as score, 0.0::float4 as vector_score,
        ts_rank_cd(sc.fts_vector, websearch_to_tsquery('simple', s.query_text))::float4 as fts_score,
        'fts:simple'::text as retrieval_model, 'bm25_fts'::text as retrieval_route, 'fts'::text as match_reason
      from public.search_chunks sc
      join public.document_versions dv on dv.version_id=sc.version_id and dv.is_current=true
      join public.documents d on d.document_id=sc.document_id cross join settings s
      where s.query_text is not null and sc.fts_vector @@ websearch_to_tsquery('simple', s.query_text)
        and (%5$L::content_domain is null or sc.content_domain=%5$L::content_domain)
        and (%6$L::normalized_status is null or sc.norm_status=%6$L::normalized_status)
      order by ts_rank_cd(sc.fts_vector, websearch_to_tsquery('simple', s.query_text)) desc limit %8$s
    ),
    unioned as (select * from metric_candidates union all select * from qwen_candidates union all select * from bm25_candidates),
    ranked as (select u.*, row_number() over (partition by retrieval_route order by score desc) as rnk from unioned u),
    rrf as (select chunk_id, sum(1.0/(60.0+rnk))::float4 as rrf_score from ranked group by chunk_id),
    best as (select distinct on (chunk_id) * from ranked order by chunk_id, case retrieval_route when 'metric_hy' then 3 when 'qwen_echr' then 3 when 'bm25_fts' then 2 else 1 end desc, score desc)
    select b.chunk_id, b.document_id, b.version_id, b.doc_id, b.title, b.text_snippet, b.source_url, b.citation_anchor,
      b.language, b.source, b.content_domain, b.norm_status, r.rrf_score as score, b.vector_score, b.fts_score,
      b.retrieval_model, b.retrieval_route, b.match_reason
    from best b join rrf r using (chunk_id) order by r.rrf_score desc limit %9$s
  $t$,
    v_cand,                    -- %1$s
    p_metric_embedding::text,  -- %2$L
    p_qwen_embedding::text,    -- %3$L
    p_query_text,              -- %4$L
    p_content_domain::text,    -- %5$L
    p_norm_status::text,       -- %6$L
    p_effective_at::text,      -- %7$L
    v_bm25,                    -- %8$s
    v_final                    -- %9$s
  );
  return query execute v_sql;
end
$function$;
