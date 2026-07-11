-- P1/P2: TeamManagement/TeamStats query public.teams / public.team_members;
-- useDocumentGenerator queries public.document_templates. None existed.

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  leader_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  unique (team_id, user_id)
);

alter table public.teams enable row level security;
alter table public.team_members enable row level security;

drop policy if exists teams_service on public.teams;
create policy teams_service on public.teams
  for all to service_role using (true) with check (true);

drop policy if exists teams_read on public.teams;
create policy teams_read on public.teams
  for select to authenticated using (true);

drop policy if exists teams_admin_write on public.teams;
create policy teams_admin_write on public.teams
  for insert to authenticated with check (app.get_my_role() = 'admin'::app.app_role);

drop policy if exists teams_admin_update on public.teams;
create policy teams_admin_update on public.teams
  for update to authenticated
  using (app.get_my_role() = 'admin'::app.app_role)
  with check (app.get_my_role() = 'admin'::app.app_role);

drop policy if exists teams_admin_delete on public.teams;
create policy teams_admin_delete on public.teams
  for delete to authenticated using (app.get_my_role() = 'admin'::app.app_role);

drop policy if exists team_members_service on public.team_members;
create policy team_members_service on public.team_members
  for all to service_role using (true) with check (true);

drop policy if exists team_members_read on public.team_members;
create policy team_members_read on public.team_members
  for select to authenticated using (true);

drop policy if exists team_members_admin_write on public.team_members;
create policy team_members_admin_write on public.team_members
  for insert to authenticated with check (app.get_my_role() = 'admin'::app.app_role);

drop policy if exists team_members_admin_delete on public.team_members;
create policy team_members_admin_delete on public.team_members
  for delete to authenticated using (app.get_my_role() = 'admin'::app.app_role);

create trigger teams_set_updated_at
  before update on public.teams
  for each row execute function public.set_updated_at();

create table if not exists public.document_templates (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  subcategory text,
  name_hy text not null default '',
  name_ru text not null default '',
  name_en text,
  description text,
  required_fields jsonb not null default '[]'::jsonb,
  template_text text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.document_templates enable row level security;

drop policy if exists document_templates_service on public.document_templates;
create policy document_templates_service on public.document_templates
  for all to service_role using (true) with check (true);

drop policy if exists document_templates_read on public.document_templates;
create policy document_templates_read on public.document_templates
  for select to authenticated using (true);

drop policy if exists document_templates_admin_write on public.document_templates;
create policy document_templates_admin_write on public.document_templates
  for insert to authenticated with check (app.get_my_role() = 'admin'::app.app_role);

drop policy if exists document_templates_admin_update on public.document_templates;
create policy document_templates_admin_update on public.document_templates
  for update to authenticated
  using (app.get_my_role() = 'admin'::app.app_role)
  with check (app.get_my_role() = 'admin'::app.app_role);

create trigger document_templates_set_updated_at
  before update on public.document_templates
  for each row execute function public.set_updated_at();

grant select on public.teams, public.team_members, public.document_templates to authenticated;
grant insert, update, delete on public.teams, public.team_members to authenticated;
grant insert, update on public.document_templates to authenticated;
grant all on public.teams, public.team_members, public.document_templates to service_role;
