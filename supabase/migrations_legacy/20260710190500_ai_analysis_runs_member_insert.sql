-- Allow any case member (not only lawyer/admin) to save AI analysis results
-- from the UI. The edge functions insert via service_role regardless; this
-- affects the manual "save analysis" path. triggered_by must still be the
-- caller.
drop policy if exists ai_insert on app.ai_analysis_runs;
create policy ai_insert on app.ai_analysis_runs
  for insert to authenticated
  with check (
    triggered_by = auth.uid()
    and app.can_read_case(case_id)
  );
