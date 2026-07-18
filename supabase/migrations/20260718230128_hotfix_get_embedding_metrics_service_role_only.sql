BEGIN;

CREATE OR REPLACE FUNCTION public.get_embedding_metrics(p_model text DEFAULT 'armenian-text-embeddings-2-large'::text)
 RETURNS TABLE(model text, total_chunks bigint, embedded bigint, pending bigint, failed bigint, est_total_tokens bigint, est_total_cost_usd numeric, est_remaining_cost_usd numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  price_per_m numeric := 0.0;
BEGIN
  -- Fail-closed: only trusted server-side service_role calls are allowed.
  IF (auth.jwt() ->> 'role') IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH sc AS (
    SELECT
      s.chunk_id,
      ceil(length(coalesce(s.text, '')) / 4.0)::bigint AS toks,
      EXISTS (
        SELECT 1
        FROM public.embeddings e
        WHERE e.chunk_id = s.chunk_id
          AND e.model = p_model
          AND e.status = 'success'
      ) AS done
    FROM public.search_chunks s
  )
  SELECT
    p_model,
    count(*)::bigint,
    count(*) FILTER (WHERE done)::bigint,
    count(*) FILTER (WHERE NOT done)::bigint,
    (
      SELECT count(*)
      FROM public.embeddings em
      WHERE em.model = p_model
        AND em.status = 'failed'
    )::bigint,
    coalesce(sum(toks), 0)::bigint,
    round(
      coalesce(sum(toks), 0) / 1000000.0 * price_per_m,
      4
    ),
    round(
      coalesce(sum(toks) FILTER (WHERE NOT done), 0)
      / 1000000.0 * price_per_m,
      4
    )
  FROM sc;
END;
$function$;

COMMENT ON FUNCTION public.get_embedding_metrics(text) IS
'service-role-only: direct browser/anon/authenticated invocation is prohibited. '
'Authorization is enforced by a fail-closed JWT role guard: auth.jwt() ->> ''role'' IS DISTINCT FROM ''service_role'' => 42501.';

REVOKE ALL ON FUNCTION public.get_embedding_metrics(text) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.get_embedding_metrics(text) TO service_role;

COMMIT;
