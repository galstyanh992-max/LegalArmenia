-- P1: CaseComments, useUserNotes and useFeedback/useUserFeedback query
-- public.case_comments / public.user_notes / public.user_feedback, none of
-- which existed.

create table if not exists public.case_comments (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references app.cases(case_id) on delete cascade,
  author_id uuid not null,
  content text not null,
  is_internal boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists case_comments_case_idx on public.case_comments (case_id, created_at);

alter table public.case_comments enable row level security;

drop policy if exists case_comments_service on public.case_comments;
create policy case_comments_service on public.case_comments
  for all to service_role using (true) with check (true);

drop policy if exists case_comments_select on public.case_comments;
create policy case_comments_select on public.case_comments
  for select to authenticated using (app.can_read_case(case_id));

drop policy if exists case_comments_insert on public.case_comments;
create policy case_comments_insert on public.case_comments
  for insert to authenticated
  with check (author_id = auth.uid() and app.can_read_case(case_id));

drop policy if exists case_comments_update on public.case_comments;
create policy case_comments_update on public.case_comments
  for update to authenticated
  using (author_id = auth.uid() or app.get_my_role() = 'admin'::app.app_role)
  with check (app.can_read_case(case_id));

drop policy if exists case_comments_delete on public.case_comments;
create policy case_comments_delete on public.case_comments
  for delete to authenticated
  using (author_id = auth.uid() or app.get_my_role() = 'admin'::app.app_role);

create trigger case_comments_set_updated_at
  before update on public.case_comments
  for each row execute function public.set_updated_at();

create table if not exists public.user_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text not null default '',
  content_html text not null default '',
  content_text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_notes_user_idx on public.user_notes (user_id, updated_at desc);

alter table public.user_notes enable row level security;

drop policy if exists user_notes_service on public.user_notes;
create policy user_notes_service on public.user_notes
  for all to service_role using (true) with check (true);

drop policy if exists user_notes_owner on public.user_notes;
create policy user_notes_owner on public.user_notes
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create trigger user_notes_set_updated_at
  before update on public.user_notes
  for each row execute function public.set_updated_at();

create table if not exists public.user_feedback (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references app.cases(case_id) on delete cascade,
  analysis_id uuid,
  user_id uuid not null,
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (case_id, user_id)
);

create index if not exists user_feedback_rating_idx on public.user_feedback (rating, created_at desc);

alter table public.user_feedback enable row level security;

drop policy if exists user_feedback_service on public.user_feedback;
create policy user_feedback_service on public.user_feedback
  for all to service_role using (true) with check (true);

drop policy if exists user_feedback_select on public.user_feedback;
create policy user_feedback_select on public.user_feedback
  for select to authenticated
  using (user_id = auth.uid() or app.get_my_role() = 'admin'::app.app_role);

drop policy if exists user_feedback_insert on public.user_feedback;
create policy user_feedback_insert on public.user_feedback
  for insert to authenticated
  with check (user_id = auth.uid() and app.can_read_case(case_id));

drop policy if exists user_feedback_delete on public.user_feedback;
create policy user_feedback_delete on public.user_feedback
  for delete to authenticated
  using (user_id = auth.uid() or app.get_my_role() = 'admin'::app.app_role);

grant select, insert, update, delete on public.case_comments, public.user_notes to authenticated;
grant select, insert, delete on public.user_feedback to authenticated;
grant all on public.case_comments, public.user_notes, public.user_feedback to service_role;
