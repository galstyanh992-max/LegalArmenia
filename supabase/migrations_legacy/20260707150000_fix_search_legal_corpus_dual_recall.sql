-- =============================================================================
-- S2 recall fix — search_legal_corpus_dual: over-fetch BEFORE post-ANN filters.
-- =============================================================================
-- Problem: metric_ann / qwen_ann took only p_metric_limit / p_qwen_limit (default
-- 30) nearest vectors, THEN metric_candidates/qwen_candidates applied
-- is_current / language / not-echr / domain filters. Non-qualifying vectors in
-- the ANN top-30 consumed the budget, so genuinely relevant current-hy chunks
-- ranked 31+ never surfaced => recall loss.
--
-- Fix: enlarge the ANN candidate pool to
--   candidate_limit = least(500, greatest(150, final_limit * 5))
-- for BOTH dense branches, then keep the existing filters + RRF fusion + final
-- limit unchanged. Signature and 18-column return schema preserved. No data,
-- embeddings, chunks, indexes, or other branches touched. Additive/idempotent
-- (CREATE OR REPLACE).
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
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
 SET statement_timeout TO '60000'
AS $function$
  with settings as (
    select least(greatest(coalesce(p_limit,10),1),100) as final_limit,
      least(greatest(coalesce(p_metric_limit,30),1),100) as metric_limit,
      least(greatest(coalesce(p_qwen_limit,30),1),100) as qwen_limit,
      least(greatest(coalesce(p_bm25_limit,30),1),120) as bm25_limit,
      -- S2: over-fetch ANN candidates before post-filters (is_current/hy/not-echr)
      least(500, greatest(150, least(greatest(coalesce(p_limit,10),1),100) * 5)) as candidate_limit,
      nullif(trim(coalesce(p_query_text,'')),'') as query_text
  ),
  metric_ann as materialized (
    select e.chunk_id, (1.0-(e.vector <=> p_metric_embedding))::float4 as sim
    from public.embeddings e
    where p_metric_embedding is not null and e.model='armenian-text-embeddings-2-large' and e.status='success'
    order by e.vector <=> p_metric_embedding limit (select candidate_limit from settings)
  ),
  qwen_ann as materialized (
    select e.chunk_id, (1.0-(e.vector <=> p_qwen_embedding))::float4 as sim
    from public.embeddings e
    where p_qwen_embedding is not null and e.model='qwen3-embedding-0.6b' and e.status='success'
    order by e.vector <=> p_qwen_embedding limit (select candidate_limit from settings)
  ),
  metric_candidates as (
    select sc.chunk_id, sc.document_id, sc.version_id, d.canonical_key as doc_id,
      coalesce(d.title_hy,d.title_en,d.title_ru,d.canonical_key) as title, left(sc.text,900) as text_snippet,
      sc.source_url, sc.citation_anchor, sc.language_code as language,
      case when d.canonical_key like 'venice:%' then 'venice' when d.arlis_doc_id is not null then 'arlis' else coalesce(d.source_metadata->>'source','armenian_legal') end as source,
      sc.content_domain, sc.norm_status, a.sim as score, a.sim as vector_score, 0.0::float4 as fts_score,
      'armenian-text-embeddings-2-large'::text as retrieval_model, 'metric_hy'::text as retrieval_route, 'metric_dense'::text as match_reason
    from metric_ann a
    join public.search_chunks sc on sc.chunk_id=a.chunk_id
    join public.document_versions dv on dv.version_id=sc.version_id and dv.is_current=true
    join public.documents d on d.document_id=sc.document_id
    where sc.language_code='hy' and d.canonical_key not like 'echr:%'
      and (p_content_domain is null or sc.content_domain=p_content_domain)
      and (p_norm_status is null or sc.norm_status=p_norm_status)
      and (p_effective_at is null or sc.effective_from is null or (sc.effective_from<=p_effective_at and (sc.effective_to is null or sc.effective_to>p_effective_at)))
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
    where d.canonical_key like 'echr:%' and sc.language_code in ('en','fr')
      and (p_content_domain is null or sc.content_domain=p_content_domain)
      and (p_norm_status is null or sc.norm_status=p_norm_status)
  ),
  bm25_candidates as (
    select sc.chunk_id, sc.document_id, sc.version_id, d.canonical_key as doc_id,
      coalesce(d.title_hy,d.title_en,d.title_ru,d.canonical_key) as title, left(sc.text,900) as text_snippet,
      sc.source_url, sc.citation_anchor, sc.language_code as language,
      case when d.canonical_key like 'echr:%' then 'echr' when d.canonical_key like 'venice:%' then 'venice' when d.arlis_doc_id is not null then 'arlis' else coalesce(d.source_metadata->>'source','legal') end as source,
      sc.content_domain, sc.norm_status,
      ts_rank_cd(sc.fts_vector, websearch_to_tsquery('simple', s.query_text))::float4 as score, 0.0::float4 as vector_score,
      ts_rank_cd(sc.fts_vector, websearch_to_tsquery('simple', s.query_text))::float4 as fts_score,
      'fts:simple'::text as retrieval_model, 'bm25_fts'::text as retrieval_route, 'fts'::text as match_reason
    from public.search_chunks sc
    join public.document_versions dv on dv.version_id=sc.version_id and dv.is_current=true
    join public.documents d on d.document_id=sc.document_id cross join settings s
    where s.query_text is not null and sc.fts_vector @@ websearch_to_tsquery('simple', s.query_text)
      and (p_content_domain is null or sc.content_domain=p_content_domain)
      and (p_norm_status is null or sc.norm_status=p_norm_status)
    order by ts_rank_cd(sc.fts_vector, websearch_to_tsquery('simple', s.query_text)) desc limit (select bm25_limit from settings)
  ),
  unioned as (select * from metric_candidates union all select * from qwen_candidates union all select * from bm25_candidates),
  ranked as (select u.*, row_number() over (partition by retrieval_route order by score desc) as rnk from unioned u),
  rrf as (select chunk_id, sum(1.0/(60.0+rnk))::float4 as rrf_score from ranked group by chunk_id),
  best as (select distinct on (chunk_id) * from ranked order by chunk_id, case retrieval_route when 'metric_hy' then 3 when 'qwen_echr' then 3 when 'bm25_fts' then 2 else 1 end desc, score desc)
  select b.chunk_id, b.document_id, b.version_id, b.doc_id, b.title, b.text_snippet, b.source_url, b.citation_anchor,
    b.language, b.source, b.content_domain, b.norm_status, r.rrf_score as score, b.vector_score, b.fts_score,
    b.retrieval_model, b.retrieval_route, b.match_reason
  from best b join rrf r using (chunk_id) order by r.rrf_score desc limit (select final_limit from settings);
$function$;
