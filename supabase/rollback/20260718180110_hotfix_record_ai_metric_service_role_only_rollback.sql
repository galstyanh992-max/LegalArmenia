-- =============================================================================
-- CONTAINMENT ROLLBACK: record_ai_metric availability containment
-- =============================================================================
-- PURPOSE:
--   This rollback DISABLES the RPC in a fail-closed way if the forward hotfix
--   must be reverted. It NEVER restores the vulnerable pre-hotfix state.
--
-- NON-GOALS (explicitly forbidden):
--   * Does NOT restore the historical vulnerable body (no authorization guard).
--   * Does NOT grant EXECUTE to PUBLIC, anon, or authenticated.
--   * Does NOT use broad GRANT ALL.
--   * Does NOT drop internal.ai_metrics or delete metric data.
--
-- MODEL:
--   * Keep the safe fail-closed service-role-guarded body from the forward
--     migration (it raises 42501 for any non-service_role caller).
--   * REVOKE EXECUTE from PUBLIC, anon, authenticated, AND service_role.
--     => the RPC becomes non-callable by everyone. This is AVAILABILITY
--        CONTAINMENT, not restoration of the vulnerable state. Legitimate
--     Edge Function metric writes will stop until a reviewed recovery
--     migration re-grants EXECUTE to service_role.
--   * Update the comment to state the RPC is disabled pending reviewed
--     recovery.
--
-- ROLLBACK SEMANTICS:
--   Applying this file after the forward migration leaves the function body
--   safe and the ACL empty (no role can EXECUTE). To restore service, re-run
--   the forward migration (which re-grants EXECUTE to service_role). Never
--   re-grant PUBLIC/anon/authenticated.
-- =============================================================================
BEGIN;

CREATE OR REPLACE FUNCTION public.record_ai_metric(
  p_fn_name text,
  p_model text DEFAULT NULL::text,
  p_input_tokens integer DEFAULT 0,
  p_output_tokens integer DEFAULT 0,
  p_cost_usd numeric DEFAULT 0,
  p_latency_ms integer DEFAULT NULL::integer,
  p_status text DEFAULT 'success'::text,
  p_error_message text DEFAULT NULL::text,
  p_case_id uuid DEFAULT NULL::uuid,
  p_user_id uuid DEFAULT NULL::uuid
)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
begin
  -- Fail-closed: only the service_role JWT may invoke this RPC.
  if (auth.jwt() ->> 'role') is distinct from 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;

  insert into internal.ai_metrics
    (fn_name, model, input_tokens, output_tokens, cost_usd, latency_ms, status, error_message, case_id, user_id)
  values
    (p_fn_name, p_model, coalesce(p_input_tokens, 0), coalesce(p_output_tokens, 0),
     coalesce(p_cost_usd, 0), p_latency_ms,
     case when p_status in ('success', 'failed') then p_status else 'success' end,
     p_error_message, p_case_id, coalesce(p_user_id, auth.uid()));
end;
$function$;

COMMENT ON FUNCTION public.record_ai_metric(
  p_fn_name text,
  p_model text,
  p_input_tokens integer,
  p_output_tokens integer,
  p_cost_usd numeric,
  p_latency_ms integer,
  p_status text,
  p_error_message text,
  p_case_id uuid,
  p_user_id uuid
) IS
'DISABLED pending reviewed recovery: service-role-only fail-closed body retained, '
'but EXECUTE has been revoked from ALL roles (including service_role) as '
'availability containment. Do NOT re-grant PUBLIC/anon/authenticated. To restore '
'legitimate service_role writes, re-apply the forward hotfix '
'(20260718180110_hotfix_record_ai_metric_service_role_only.sql).';

-- Availability containment: revoke EXECUTE from every role, including service_role.
REVOKE ALL ON FUNCTION public.record_ai_metric(
  p_fn_name text,
  p_model text,
  p_input_tokens integer,
  p_output_tokens integer,
  p_cost_usd numeric,
  p_latency_ms integer,
  p_status text,
  p_error_message text,
  p_case_id uuid,
  p_user_id uuid
) FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
