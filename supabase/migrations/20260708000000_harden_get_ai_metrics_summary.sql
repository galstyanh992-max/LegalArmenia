-- Harden public.get_ai_metrics_summary for role-aware, production-safe behavior.
--
-- Problem: the function raised a hard exception (errcode 42501) for any non-admin
-- caller. Supabase/PostgREST surfaces that as an HTTP 403, which the frontend
-- (UsageMonitor.tsx) logged via console.error for every non-admin user, because a
-- compact usage widget on the main Dashboard was rendered unconditionally for all
-- roles and called this RPC on mount.
--
-- Additional bug found while auditing: the admin check used `<> 'admin'`. In
-- PL/pgSQL, `IF NULL THEN ... END IF` treats NULL as "not true" and SKIPS the
-- branch, so a caller whose app.get_my_role() returns NULL (no app.user_profiles
-- row, e.g. anon or an unprovisioned account) would silently bypass the "raise
-- exception" branch and fall through to the real metrics query. This migration
-- fixes that with `IS DISTINCT FROM`, which correctly treats NULL as "not admin".
--
-- Fix:
--   1. Non-admin (including NULL-role/anon) callers get an EMPTY result set
--      (0 rows), never an error — safe default, no console-visible failures.
--   2. IS DISTINCT FROM closes the NULL-role bypass.
--   3. EXECUTE grants tightened: revoke from anon/PUBLIC (unauthenticated callers
--      have no legitimate reason to invoke this RPC at all), keep authenticated
--      (so admin users, who are also `authenticated`, can call it) and
--      service_role. No table-level grants are touched or added — the underlying
--      internal.ai_metrics table remains inaccessible outside this SECURITY
--      DEFINER function (RLS enabled, no direct grants to authenticated/anon).
--
-- This does NOT weaken admin-only security: admins still see full real metrics,
-- non-admins still cannot read any row of internal.ai_metrics, and no broad
-- EXECUTE/SELECT access is newly granted anywhere.

create or replace function public.get_ai_metrics_summary(p_days integer default 30)
returns table(
  day date,
  fn_name text,
  model text,
  calls bigint,
  total_tokens bigint,
  cost_usd numeric,
  avg_latency_ms numeric,
  failures bigint
)
language plpgsql
security definer
set search_path to 'internal', 'public', 'auth', 'pg_temp'
as $function$
begin
  -- Safe-empty for anyone who isn't admin, including NULL role (IS DISTINCT FROM
  -- correctly handles NULL, unlike `<>`). No exception is raised: the frontend
  -- can call this RPC defensively without producing console errors, and a
  -- non-admin/anon caller receives 0 rows rather than any data or an error.
  if app.get_my_role() is distinct from 'admin' then
    return;
  end if;

  return query
    select date_trunc('day', m.created_at)::date as day,
           m.fn_name, m.model,
           count(*)::bigint as calls,
           coalesce(sum(m.total_tokens),0)::bigint as total_tokens,
           round(coalesce(sum(m.cost_usd),0), 4) as cost_usd,
           round(avg(m.latency_ms)::numeric, 0) as avg_latency_ms,
           count(*) filter (where m.status='failed')::bigint as failures
    from internal.ai_metrics m
    where m.created_at >= now() - make_interval(days => greatest(p_days,1))
    group by 1,2,3
    order by 1 desc, calls desc;
end;
$function$;

comment on function public.get_ai_metrics_summary(integer) is
  'Admin-only aggregated AI usage metrics (calls/tokens/cost/latency/failures by day+fn+model). Non-admin and anon callers receive an empty result set, never an error. SECURITY DEFINER; role check via app.get_my_role() using IS DISTINCT FROM to correctly reject NULL roles. Underlying internal.ai_metrics table has no direct grants to authenticated/anon and RLS enabled — this function is the only read path.';

-- Tighten grants: unauthenticated callers have no legitimate use for this RPC.
revoke execute on function public.get_ai_metrics_summary(integer) from public;
revoke execute on function public.get_ai_metrics_summary(integer) from anon;
grant execute on function public.get_ai_metrics_summary(integer) to authenticated;
grant execute on function public.get_ai_metrics_summary(integer) to service_role;
