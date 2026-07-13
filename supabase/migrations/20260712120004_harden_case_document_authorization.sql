-- Forward migration: authorization hardening after the versioned baseline.
-- Source: APPLICATION_CONTRACT_REQUIRED + SECURITY_BASELINE_REQUIRED.

begin;

create or replace function app.can_read_case(p_case_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'app', 'public', 'auth'
as $function$
  select app.get_my_role() = 'admin'
    or app.is_case_lawyer(p_case_id)
    or app.is_case_member(p_case_id)
    or exists (
      select 1
      from app.cases c
      where c.case_id = p_case_id
        and c.client_id = auth.uid()
    )
$function$;

create or replace function app.check_case_upload_access(_case_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from app.cases c
    where c.case_id = _case_id
      and (
        c.client_id = auth.uid()
        or c.lawyer_id = auth.uid()
        or exists (
          select 1
          from app.user_profiles up
          where up.user_id = auth.uid()
            and up.app_role = 'admin'::app.app_role
        )
      )
  )
  or exists (
    select 1
    from app.case_members cm
    where cm.case_id = _case_id
      and cm.user_id = auth.uid()
  )
$function$;

drop policy if exists "Case members can upload documents" on app.client_documents;
create policy "Case members can upload documents"
on app.client_documents
as permissive
for insert
to authenticated
with check (app.check_case_upload_access(case_id));

commit;

-- Verification (read-only):
-- select app.can_read_case(<synthetic_case_uuid>);
-- select policyname from pg_policies
-- where schemaname='app' and tablename='client_documents';
