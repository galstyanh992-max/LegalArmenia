-- P1: the reminder system had no tables. useReminders / useNotifications and
-- the process-reminder-notifications edge function all query
-- public.reminders / public.notifications, which did not exist. Create both
-- with owner-scoped RLS. The FK is named reminders_user_id_fkey because the
-- edge function embeds `profiles!reminders_user_id_fkey`.

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  case_id uuid,
  title text not null,
  description text,
  reminder_type text not null default 'other'
    check (reminder_type in ('court_hearing','deadline','task','meeting','other')),
  priority text not null default 'medium'
    check (priority in ('low','medium','high','urgent')),
  event_datetime timestamptz not null,
  notify_before integer[] not null default '{60}',
  status text not null default 'active'
    check (status in ('active','completed','dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reminders_user_id_fkey
    foreign key (user_id) references app.user_profiles(user_id) on delete cascade
);

create index if not exists reminders_user_idx on public.reminders (user_id, status);
create index if not exists reminders_event_idx on public.reminders (event_datetime) where status = 'active';

alter table public.reminders enable row level security;

drop policy if exists reminders_service on public.reminders;
create policy reminders_service on public.reminders
  for all to service_role using (true) with check (true);

drop policy if exists reminders_owner_select on public.reminders;
create policy reminders_owner_select on public.reminders
  for select to authenticated using (user_id = auth.uid());

drop policy if exists reminders_owner_insert on public.reminders;
create policy reminders_owner_insert on public.reminders
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists reminders_owner_update on public.reminders;
create policy reminders_owner_update on public.reminders
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists reminders_owner_delete on public.reminders;
create policy reminders_owner_delete on public.reminders
  for delete to authenticated using (user_id = auth.uid());

create trigger reminders_set_updated_at
  before update on public.reminders
  for each row execute function public.set_updated_at();

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  reminder_id uuid references public.reminders(id) on delete set null,
  title text not null,
  message text,
  is_read boolean not null default false,
  notification_type text not null default 'general',
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx on public.notifications (user_id, is_read, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists notifications_service on public.notifications;
create policy notifications_service on public.notifications
  for all to service_role using (true) with check (true);

drop policy if exists notifications_owner_select on public.notifications;
create policy notifications_owner_select on public.notifications
  for select to authenticated using (user_id = auth.uid());

drop policy if exists notifications_owner_update on public.notifications;
create policy notifications_owner_update on public.notifications
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists notifications_owner_delete on public.notifications;
create policy notifications_owner_delete on public.notifications
  for delete to authenticated using (user_id = auth.uid());

grant select, insert, update, delete on public.reminders to authenticated;
grant select, update, delete on public.notifications to authenticated;
grant all on public.reminders, public.notifications to service_role;
