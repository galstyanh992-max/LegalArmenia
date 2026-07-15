-- Prompt 19.5B: qualify V2 CTE columns that collide with RETURNS TABLE variables.
-- The prior migration remains immutable and replayable; this replacement is limited to V2.

do $migration$
declare
  v_before text;
  v_after text;
begin
  select pg_get_functiondef(
    'public.search_legal_corpus_metric_v2(text,vector,public.content_domain,text,date,integer,integer,integer)'::regprocedure
  ) into v_before;

  v_after := replace(
    v_before,
    'select chunk_id, fts_score from chunk_fts_raw',
    'select cfr.chunk_id, cfr.fts_score from chunk_fts_raw cfr'
  );
  v_after := replace(
    v_after,
    'select chunk_id, fts_score from metadata_fts_raw where per_document_rank <= 2',
    'select mfr.chunk_id, mfr.fts_score from metadata_fts_raw mfr where mfr.per_document_rank <= 2'
  );

  if v_after = v_before then
    raise exception using errcode = '22023', message = 'METRIC_RPC_V2_QUALIFICATION_TARGET_NOT_FOUND';
  end if;

  execute v_after;
end
$migration$;
