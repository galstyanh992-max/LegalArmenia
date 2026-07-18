-- =============================================================================
-- HOTFIX: record_ai_metric service-role-only containment (CRITICAL)
-- Forward migration version: 20260718180110
-- =============================================================================
-- P1 SECURITY FINDING: unauthenticated unbounded write to internal.ai_metrics.
--
-- PROBLEM (production baseline, def_md5 a77d65c5466a893c8e5db16aff026902):
--   public.record_ai_metric is SECURITY DEFINER with EXECUTE granted to
--   PUBLIC, anon, authenticated, and service_role. The body has NO
--   authorization guard. anon and any authenticated user can call it via
--   /rest/v1/rpc/record_ai_metric and insert unlimited rows into
--   internal.ai_metrics (RLS is bypassed by SECURITY DEFINER; force_rls is
--   off). All metric identity fields are caller-controlled (fn_name, model,
--   input_tokens, output_tokens, cost_usd, latency_ms, status,
--   error_message, case_id, user_id), enabling:
--     * spoofed user_id / case_id attribution,
--     * inflated cost / token / failure figures corrupting the admin
--       UsageMonitor / billing / analytics dashboards,
--     * unbounded storage and log amplification.
--
-- CONFIRMED LEGITIMATE CALLERS (repository evidence):
--   Every runtime caller is a Supabase Edge Function that builds its client
--   with SUPABASE_SERVICE_ROLE_KEY. Where p_user_id is supplied, it is derived
--   from trusted server-side context (verified user JWT, user.id);
--   kb-search-assistant intentionally omits p_user_id. No browser/frontend
--   runtime caller exists (generated types.ts alone is not runtime evidence).
--     - supabase/functions/_shared/ai-metrics.ts           (RPC wrapper)
--     - supabase/functions/ai-analyze/index.ts              (service_role)
--     - supabase/functions/multi-agent-analyze/index.ts    (service_role)
--     - supabase/functions/ocr-process/index.ts            (service_role)
--     - supabase/functions/audio-transcribe/index.ts       (service_role)
--     - supabase/functions/legal-chat/index.ts             (service_role)
--     - supabase/functions/kb-search-assistant/index.ts    (service_role)
--     - supabase/functions/_shared/rag-search.ts           (service_role)
--
-- CONTAINMENT MODEL: SERVICE_ROLE_ONLY.
--   * Body guard: fail-closed unless the caller's JWT role is service_role.
--   * ACL: revoke EXECUTE from PUBLIC, anon, authenticated; keep service_role.
--   * SECURITY DEFINER retained (owner postgres) so the service_role caller's
--     insert into internal.ai_metrics is unaffected; the JWT guard is the
--     authorization gate.
--   * search_path set to '' (empty) to remove any search_path surface; all
--     relations/functions referenced are schema-qualified
--     (internal.ai_metrics, auth.jwt(), auth.uid()) or pg_catalog builtins
--     (coalesce), which resolve regardless of search_path.
--
-- SIGNATURE / RETURN / BEHAVIOR PARITY:
--   * Public signature, parameter names, defaults, and return type (void)
--     are byte-for-byte preserved.
--   * Null-handling preserved: p_input_tokens/p_output_tokens/p_cost_usd
--     coalesce to 0; p_status coerced to 'success' when not in
--     ('success','failed'); p_user_id coalesces to auth.uid() (which is NULL
--     for the service_role caller; Edge Functions pass a server-derived
--     p_user_id where applicable, and kb-search-assistant omits it).
--   * No dynamic SQL. No app.get_my_role fallback. No authenticated-admin
--     fallback. No user-metadata authorization. No trust in p_user_id as
--     authorization evidence (p_user_id is treated as data only).
--
-- INPUT-VALIDATION DECISION (see 09_remediation_batches / data-quality guards):
--   Minimal authorization containment only. No value coercion or truncation
--   is introduced (negative tokens/cost/latency, extreme text lengths:
--   DEFERRED_BEHAVIOR_CHANGE; invalid status: NOT_REQUIRED, already coerced;
--   missing fn_name/model: NOT_REQUIRED_AFTER_SERVICE_ROLE_CONTAINMENT,
--   service_role is trusted and the Edge wrapper always supplies fn_name).
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
'service-role-only: direct browser/anon/authenticated invocation is prohibited. '
'metric identity fields (fn_name, model, input_tokens, output_tokens, cost_usd, '
'latency_ms, status, error_message, case_id, user_id) must be provided by trusted '
'server-side callers (Edge Functions using SUPABASE_SERVICE_ROLE_KEY with a '
'server-derived user id). Authorization is enforced by a fail-closed JWT role '
'guard: auth.jwt() ->> ''role'' IS DISTINCT FROM ''service_role'' => 42501.';

-- ACL normalization: remove all broad grants; allow service_role only.
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

GRANT EXECUTE ON FUNCTION public.record_ai_metric(
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
) TO service_role;

COMMIT;
