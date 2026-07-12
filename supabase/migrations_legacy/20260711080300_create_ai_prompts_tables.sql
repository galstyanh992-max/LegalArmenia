-- P1: the admin Prompt Manager (src/components/admin/PromptManager.tsx)
-- reads/writes public.ai_prompts and public.ai_prompt_versions, which did
-- not exist. Read for any signed-in user, writes admin-only.

create table if not exists public.ai_prompts (
  id uuid primary key default gen_random_uuid(),
  function_name text not null,
  module_type text not null,
  name_hy text not null default '',
  name_ru text not null default '',
  name_en text,
  description text,
  prompt_text text not null,
  is_active boolean not null default true,
  current_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_prompts_function_idx on public.ai_prompts (function_name, module_type);

create table if not exists public.ai_prompt_versions (
  id uuid primary key default gen_random_uuid(),
  prompt_id uuid not null references public.ai_prompts(id) on delete cascade,
  version_number integer not null,
  prompt_text text not null,
  change_reason text,
  changed_at timestamptz not null default now()
);

create index if not exists ai_prompt_versions_prompt_idx on public.ai_prompt_versions (prompt_id, version_number desc);

alter table public.ai_prompts enable row level security;
alter table public.ai_prompt_versions enable row level security;

drop policy if exists ai_prompts_service on public.ai_prompts;
create policy ai_prompts_service on public.ai_prompts
  for all to service_role using (true) with check (true);

drop policy if exists ai_prompts_read on public.ai_prompts;
create policy ai_prompts_read on public.ai_prompts
  for select to authenticated using (true);

drop policy if exists ai_prompts_admin_write on public.ai_prompts;
create policy ai_prompts_admin_write on public.ai_prompts
  for insert to authenticated with check (app.get_my_role() = 'admin'::app.app_role);

drop policy if exists ai_prompts_admin_update on public.ai_prompts;
create policy ai_prompts_admin_update on public.ai_prompts
  for update to authenticated
  using (app.get_my_role() = 'admin'::app.app_role)
  with check (app.get_my_role() = 'admin'::app.app_role);

drop policy if exists ai_prompts_admin_delete on public.ai_prompts;
create policy ai_prompts_admin_delete on public.ai_prompts
  for delete to authenticated using (app.get_my_role() = 'admin'::app.app_role);

drop policy if exists ai_prompt_versions_service on public.ai_prompt_versions;
create policy ai_prompt_versions_service on public.ai_prompt_versions
  for all to service_role using (true) with check (true);

drop policy if exists ai_prompt_versions_read on public.ai_prompt_versions;
create policy ai_prompt_versions_read on public.ai_prompt_versions
  for select to authenticated using (true);

drop policy if exists ai_prompt_versions_admin_write on public.ai_prompt_versions;
create policy ai_prompt_versions_admin_write on public.ai_prompt_versions
  for insert to authenticated with check (app.get_my_role() = 'admin'::app.app_role);

create trigger ai_prompts_set_updated_at
  before update on public.ai_prompts
  for each row execute function public.set_updated_at();

grant select on public.ai_prompts, public.ai_prompt_versions to authenticated;
grant insert, update, delete on public.ai_prompts to authenticated;
grant insert on public.ai_prompt_versions to authenticated;
grant all on public.ai_prompts, public.ai_prompt_versions to service_role;
