-- Local-only authorization hardening. Do not apply to production without
-- disposable role-matrix verification and an explicit release approval.

begin;

-- The browser may read its RLS-visible source row, but all writes must pass
-- through constrained compatibility triggers or admin RPCs.
revoke insert, update, delete on table app.user_profiles from authenticated;
revoke insert (
  user_id,
  full_name,
  email,
  app_role,
  is_active,
  created_at,
  updated_at,
  username,
  auditor_id
) on table app.user_profiles from authenticated;
revoke update (
  user_id,
  full_name,
  email,
  app_role,
  is_active,
  created_at,
  updated_at,
  username,
  auditor_id
) on table app.user_profiles from authenticated;
grant select on table app.user_profiles to authenticated;

drop policy if exists up_update on app.user_profiles;
drop policy if exists up_delete on app.user_profiles;

-- The live compatibility view has two UPDATE triggers. Keep only the hardened
-- profiles_update_tg path defined below.
drop trigger if exists profiles_compat_update on public.profiles;

create or replace function public.profiles_view_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_is_service boolean := coalesce(auth.jwt() ->> 'role', '') = 'service_role';
  caller_is_admin boolean := app.get_my_role() = 'admin'::app.app_role;
begin
  if new.id is null then
    raise exception 'Profile id is required' using errcode = '23502';
  end if;

  if not caller_is_service
     and not caller_is_admin
     and new.id is distinct from auth.uid() then
    raise exception 'Cannot create another user profile' using errcode = '42501';
  end if;

  insert into app.user_profiles (
    user_id,
    full_name,
    email,
    app_role,
    username,
    auditor_id
  )
  values (
    new.id,
    coalesce(new.full_name, 'User'),
    new.email,
    'client'::app.app_role,
    case when caller_is_service or caller_is_admin then new.username else null end,
    case when caller_is_service or caller_is_admin then new.auditor_id else null end
  )
  on conflict (user_id) do update
    set full_name = coalesce(excluded.full_name, app.user_profiles.full_name),
        email = coalesce(excluded.email, app.user_profiles.email),
        username = case
          when caller_is_service or caller_is_admin then excluded.username
          else app.user_profiles.username
        end,
        auditor_id = case
          when caller_is_service or caller_is_admin then excluded.auditor_id
          else app.user_profiles.auditor_id
        end,
        updated_at = now();

  return new;
end;
$$;

create or replace function public.profiles_view_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_is_service boolean := coalesce(auth.jwt() ->> 'role', '') = 'service_role';
  caller_is_admin boolean := app.get_my_role() = 'admin'::app.app_role;
begin
  if not caller_is_service
     and not caller_is_admin
     and old.id is distinct from auth.uid() then
    raise exception 'Cannot update another user profile' using errcode = '42501';
  end if;

  if not caller_is_service
     and not caller_is_admin
     and (
       new.username is distinct from old.username
       or new.auditor_id is distinct from old.auditor_id
       or new.is_active is distinct from old.is_active
       or new.id is distinct from old.id
     ) then
    raise exception 'Only admin may change protected profile fields'
      using errcode = '42501';
  end if;

  update app.user_profiles
     set full_name = new.full_name,
         email = new.email,
         username = case
           when caller_is_service or caller_is_admin then new.username
           else app.user_profiles.username
         end,
         auditor_id = case
           when caller_is_service or caller_is_admin then new.auditor_id
           else app.user_profiles.auditor_id
         end,
         is_active = case
           when caller_is_service or caller_is_admin then new.is_active
           else app.user_profiles.is_active
         end,
         updated_at = now()
   where user_id = old.id;

  if not found then
    raise exception 'User not found: %', old.id using errcode = 'P0002';
  end if;

  return new;
end;
$$;

create or replace function public.admin_set_user_role(
  p_user_id uuid,
  p_role app.app_role
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  caller_is_service boolean := coalesce(auth.jwt() ->> 'role', '') = 'service_role';
  old_role app.app_role;
begin
  if not caller_is_service
     and app.get_my_role() is distinct from 'admin'::app.app_role then
    raise exception 'Only admin can change roles' using errcode = '42501';
  end if;

  if not caller_is_service
     and p_user_id = caller_id
     and p_role is distinct from 'admin'::app.app_role then
    raise exception 'Admin cannot remove their own admin role' using errcode = '42501';
  end if;

  select app_role
    into old_role
    from app.user_profiles
   where user_id = p_user_id
   for update;

  if not found then
    raise exception 'User not found: %', p_user_id using errcode = 'P0002';
  end if;

  if old_role is not distinct from p_role then
    return;
  end if;

  update app.user_profiles
     set app_role = p_role,
         updated_at = now()
   where user_id = p_user_id;

  insert into public.audit_logs (user_id, action, table_name, record_id, details)
  values (
    caller_id,
    'authorization.role_changed',
    'app.user_profiles',
    p_user_id,
    jsonb_build_object('old_role', old_role::text, 'new_role', p_role::text)
  );
end;
$$;

create or replace function public.admin_set_user_active(
  p_user_id uuid,
  p_is_active boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  caller_is_service boolean := coalesce(auth.jwt() ->> 'role', '') = 'service_role';
  old_is_active boolean;
begin
  if not caller_is_service
     and app.get_my_role() is distinct from 'admin'::app.app_role then
    raise exception 'Only admin can change user active state' using errcode = '42501';
  end if;

  if not caller_is_service and p_user_id = caller_id and not p_is_active then
    raise exception 'Admin cannot deactivate their own account' using errcode = '42501';
  end if;

  select is_active
    into old_is_active
    from app.user_profiles
   where user_id = p_user_id
   for update;

  if not found then
    raise exception 'User not found: %', p_user_id using errcode = 'P0002';
  end if;

  if old_is_active is not distinct from p_is_active then
    return;
  end if;

  update app.user_profiles
     set is_active = p_is_active,
         updated_at = now()
   where user_id = p_user_id;

  insert into public.audit_logs (user_id, action, table_name, record_id, details)
  values (
    caller_id,
    'authorization.user_active_changed',
    'app.user_profiles',
    p_user_id,
    jsonb_build_object('old_is_active', old_is_active, 'new_is_active', p_is_active)
  );
end;
$$;

revoke all on function public.profiles_view_insert() from public, anon, authenticated;
revoke all on function public.profiles_view_update() from public, anon, authenticated;

revoke all on function public.admin_set_user_role(uuid, app.app_role) from public, anon;
grant execute on function public.admin_set_user_role(uuid, app.app_role) to authenticated, service_role;

revoke all on function public.admin_set_user_active(uuid, boolean) from public, anon;
grant execute on function public.admin_set_user_active(uuid, boolean) to authenticated, service_role;

comment on function public.admin_set_user_role(uuid, app.app_role)
  is 'Admin/service-only role transition with audit logging. Never trusts request metadata.';
comment on function public.admin_set_user_active(uuid, boolean)
  is 'Admin/service-only activation transition with audit logging.';

commit;
