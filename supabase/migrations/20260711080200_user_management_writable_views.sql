-- P1: user management was broken.
--  * UserManagement.tsx selects profiles.username / auditor_id / created_at
--    which did not exist.
--  * admin-create-user wrote to public.profiles and public.user_roles, both
--    read-only views, so new users ended up without username and the role
--    write failed.
-- Add the columns to app.user_profiles, re-expose them through the profiles
-- view, and make profiles / user_roles writable via INSTEAD OF triggers.
-- Role changes are guarded: only service_role or an admin may change roles,
-- usernames or auditor assignments (prevents self-escalation, since
-- app.user_profiles RLS allows self-updates of the own row).

alter table app.user_profiles
  add column if not exists username text,
  add column if not exists auditor_id uuid;

create unique index if not exists user_profiles_username_key
  on app.user_profiles (lower(username)) where username is not null;

create or replace view public.profiles
with (security_invoker = on) as
select
  up.user_id as id,
  up.full_name,
  up.email,
  up.app_role::text as role,
  up.is_active,
  true as has_migrated,
  up.updated_at as last_login_at,
  up.updated_at,
  null::text as avatar_url,
  null::jsonb as preferences,
  pcs.telegram_chat_id,
  pcs.notification_preferences,
  up.created_at,
  up.username,
  up.auditor_id
from app.user_profiles up
left join public.profile_compat_settings pcs on pcs.user_id = up.user_id;

create or replace function public.profiles_view_insert()
returns trigger
language plpgsql
set search_path = public, app
as $$
begin
  insert into app.user_profiles (user_id, full_name, email, app_role, username, auditor_id)
  values (new.id, coalesce(new.full_name, 'User'), new.email, 'client'::app.app_role, new.username, new.auditor_id)
  on conflict (user_id) do update
    set full_name  = coalesce(excluded.full_name, app.user_profiles.full_name),
        email      = coalesce(excluded.email, app.user_profiles.email),
        username   = coalesce(excluded.username, app.user_profiles.username),
        auditor_id = coalesce(excluded.auditor_id, app.user_profiles.auditor_id),
        updated_at = now();
  return new;
end;
$$;

create or replace function public.profiles_view_update()
returns trigger
language plpgsql
set search_path = public, app
as $$
begin
  if (new.username is distinct from old.username
      or new.auditor_id is distinct from old.auditor_id
      or new.is_active is distinct from old.is_active)
     and current_user <> 'service_role'
     and app.get_my_role() is distinct from 'admin'::app.app_role then
    raise exception 'Only admin may change username, auditor or active flag'
      using errcode = '42501';
  end if;
  update app.user_profiles
     set full_name  = new.full_name,
         email      = new.email,
         username   = new.username,
         auditor_id = new.auditor_id,
         is_active  = new.is_active,
         updated_at = now()
   where user_id = old.id;
  return new;
end;
$$;

create or replace function public.profiles_view_delete()
returns trigger
language plpgsql
set search_path = public, app
as $$
begin
  delete from app.user_profiles where user_id = old.id;
  return old;
end;
$$;

drop trigger if exists profiles_insert_tg on public.profiles;
create trigger profiles_insert_tg
instead of insert on public.profiles
for each row execute function public.profiles_view_insert();

drop trigger if exists profiles_update_tg on public.profiles;
create trigger profiles_update_tg
instead of update on public.profiles
for each row execute function public.profiles_view_update();

drop trigger if exists profiles_delete_tg on public.profiles;
create trigger profiles_delete_tg
instead of delete on public.profiles
for each row execute function public.profiles_view_delete();

create or replace function public.user_roles_guard()
returns boolean
language sql
stable
set search_path = public, app
as $$
  select current_user = 'service_role'
      or app.get_my_role() = 'admin'::app.app_role;
$$;

create or replace function public.user_roles_view_insert()
returns trigger
language plpgsql
set search_path = public, app
as $$
begin
  if not public.user_roles_guard() then
    raise exception 'Only admin may assign roles' using errcode = '42501';
  end if;
  update app.user_profiles
     set app_role = new.role::app.app_role, updated_at = now()
   where user_id = new.user_id;
  if not found then
    raise exception 'User not found: %', new.user_id using errcode = 'P0002';
  end if;
  return new;
end;
$$;

create or replace function public.user_roles_view_update()
returns trigger
language plpgsql
set search_path = public, app
as $$
begin
  if not public.user_roles_guard() then
    raise exception 'Only admin may change roles' using errcode = '42501';
  end if;
  update app.user_profiles
     set app_role = new.role::app.app_role, updated_at = now()
   where user_id = old.user_id;
  return new;
end;
$$;

create or replace function public.user_roles_view_delete()
returns trigger
language plpgsql
set search_path = public, app
as $$
begin
  if not public.user_roles_guard() then
    raise exception 'Only admin may remove roles' using errcode = '42501';
  end if;
  update app.user_profiles
     set app_role = 'client'::app.app_role, updated_at = now()
   where user_id = old.user_id
     and app_role = old.role::app.app_role;
  return old;
end;
$$;

drop trigger if exists user_roles_insert_tg on public.user_roles;
create trigger user_roles_insert_tg
instead of insert on public.user_roles
for each row execute function public.user_roles_view_insert();

drop trigger if exists user_roles_update_tg on public.user_roles;
create trigger user_roles_update_tg
instead of update on public.user_roles
for each row execute function public.user_roles_view_update();

drop trigger if exists user_roles_delete_tg on public.user_roles;
create trigger user_roles_delete_tg
instead of delete on public.user_roles
for each row execute function public.user_roles_view_delete();
