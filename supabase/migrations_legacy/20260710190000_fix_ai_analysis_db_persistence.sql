-- Fix AI analysis and multi-agent analysis database persistence.
--
-- 1) public.ai_analysis is a security-invoker view over app.ai_analysis_runs.
--    ai-analyze (service role) and CaseAIAnalysisPanel (authenticated) INSERT
--    columns the view did not expose (prompt_used, created_by) and could not
--    accept (response_text was a computed COALESCE, no INSTEAD OF trigger).
--    Every insert failed with `column "prompt_used" does not exist`; the error
--    was never checked, so analysis history was silently lost (0 rows despite
--    many successful runs). Recreate the view with insertable column mappings
--    and an INSTEAD OF INSERT trigger. Base-table RLS still applies because
--    the view is security_invoker and the trigger function is not SECURITY
--    DEFINER.
--
-- 2) agent_analysis_runs / agent_findings / evidence_registry /
--    aggregated_reports only had SELECT policies for authenticated users, so
--    the multi-agent UI failed at its first step (creating the run record)
--    for every role. Add INSERT/UPDATE policies scoped by app.can_read_case().
--
-- 3) Columns the frontend writes were missing:
--      agent_analysis_runs.findings / .sources_used
--      agent_findings.evidence_refs / .page_references
--      agent_findings.legal_basis was text but the app reads/writes string[]
--      aggregated_reports.agent_runs
--      evidence_registry.metadata
--    The frontend also inserted agent_findings.run_id while the column is
--    agent_run_id (fixed app-side in useMultiAgentAnalysis.ts).
--
-- 4) app_settings (read by _shared/ai-provider.ts and the admin AI-provider
--    switch) and audit_logs (written by ai-analyze / legal-chat /
--    rate-limiter) did not exist; those reads/writes failed silently and the
--    provider switch had no effect. Create both tables with RLS.

-- === 1) ai_analysis view: correct mapping + INSTEAD OF INSERT ===============

create or replace view public.ai_analysis
with (security_invoker = on) as
select
  ar.run_id as id,
  ar.case_id,
  ar.model_used as role,
  coalesce(
    ar.result_jsonb ->> 'response_text',
    ar.result_jsonb ->> 'analysis',
    ar.result_jsonb ->> 'summary'
  ) as response_text,
  coalesce(ar.result_jsonb -> 'sources_used', '[]'::jsonb) as sources_used,
  ar.created_at,
  ar.query_text as prompt_used,
  ar.triggered_by as created_by
from app.ai_analysis_runs ar;

create or replace function public.ai_analysis_view_insert()
returns trigger
language plpgsql
set search_path = public, app
as $$
begin
  insert into app.ai_analysis_runs (case_id, triggered_by, query_text, model_used, result_jsonb)
  values (
    new.case_id,
    coalesce(new.created_by, auth.uid()),
    new.prompt_used,
    new.role,
    jsonb_build_object(
      'response_text', new.response_text,
      'sources_used', coalesce(new.sources_used, '[]'::jsonb)
    )
  )
  returning run_id, created_at into new.id, new.created_at;
  return new;
end;
$$;

drop trigger if exists ai_analysis_insert_tg on public.ai_analysis;
create trigger ai_analysis_insert_tg
instead of insert on public.ai_analysis
for each row execute function public.ai_analysis_view_insert();

-- === 2) Multi-agent tables: allow case members to write =====================

drop policy if exists aar_insert on public.agent_analysis_runs;
create policy aar_insert on public.agent_analysis_runs
  for insert to authenticated
  with check (app.can_read_case(case_id));

drop policy if exists aar_update on public.agent_analysis_runs;
create policy aar_update on public.agent_analysis_runs
  for update to authenticated
  using (app.can_read_case(case_id))
  with check (app.can_read_case(case_id));

drop policy if exists af_insert on public.agent_findings;
create policy af_insert on public.agent_findings
  for insert to authenticated
  with check (app.can_read_case(case_id));

drop policy if exists er_insert on public.evidence_registry;
create policy er_insert on public.evidence_registry
  for insert to authenticated
  with check (app.can_read_case(case_id));

drop policy if exists er_update on public.evidence_registry;
create policy er_update on public.evidence_registry
  for update to authenticated
  using (app.can_read_case(case_id))
  with check (app.can_read_case(case_id));

drop policy if exists ar_insert on public.aggregated_reports;
create policy ar_insert on public.aggregated_reports
  for insert to authenticated
  with check (app.can_read_case(case_id));

-- === 3) Columns the app writes but the tables lacked =========================

alter table public.agent_analysis_runs
  add column if not exists findings jsonb not null default '[]'::jsonb,
  add column if not exists sources_used jsonb not null default '[]'::jsonb;

alter table public.agent_findings
  add column if not exists evidence_refs jsonb not null default '[]'::jsonb,
  add column if not exists page_references jsonb not null default '[]'::jsonb;

alter table public.agent_findings
  alter column legal_basis type jsonb
    using coalesce(to_jsonb(string_to_array(legal_basis, ', ')), '[]'::jsonb),
  alter column legal_basis set default '[]'::jsonb;

alter table public.aggregated_reports
  add column if not exists agent_runs jsonb not null default '[]'::jsonb;

alter table public.evidence_registry
  add column if not exists metadata jsonb;

-- === 4) app_settings + audit_logs ============================================

create table if not exists public.app_settings (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

drop policy if exists app_settings_service on public.app_settings;
create policy app_settings_service on public.app_settings
  for all to service_role using (true) with check (true);

drop policy if exists app_settings_read on public.app_settings;
create policy app_settings_read on public.app_settings
  for select to authenticated using (true);

drop policy if exists app_settings_admin_insert on public.app_settings;
create policy app_settings_admin_insert on public.app_settings
  for insert to authenticated
  with check (app.get_my_role() = 'admin'::app.app_role);

drop policy if exists app_settings_admin_update on public.app_settings;
create policy app_settings_admin_update on public.app_settings
  for update to authenticated
  using (app.get_my_role() = 'admin'::app.app_role)
  with check (app.get_my_role() = 'admin'::app.app_role);

grant select, insert, update on public.app_settings to authenticated;
grant all on public.app_settings to service_role;

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  action text not null,
  table_name text,
  record_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);

alter table public.audit_logs enable row level security;

drop policy if exists audit_logs_service on public.audit_logs;
create policy audit_logs_service on public.audit_logs
  for all to service_role using (true) with check (true);

drop policy if exists audit_logs_admin_read on public.audit_logs;
create policy audit_logs_admin_read on public.audit_logs
  for select to authenticated
  using (app.get_my_role() = 'admin'::app.app_role);

grant select on public.audit_logs to authenticated;
grant all on public.audit_logs to service_role;
