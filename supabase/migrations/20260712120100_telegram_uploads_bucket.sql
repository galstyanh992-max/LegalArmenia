-- Forward migration (D9): create the private `telegram-uploads` storage bucket that
-- supabase/functions/telegram-webhook writes to but which is absent in production
-- (AUDIT_REPORTS/16). Without it, Telegram uploads fail at the storage step.
--
-- GATED: apply only if Telegram uploads are a live feature (product decision).
-- Fresh timestamp; idempotent; private bucket; edge fn uses service_role to write,
-- owners read their own objects.

insert into storage.buckets (id, name, public, file_size_limit)
values ('telegram-uploads', 'telegram-uploads', false, 20971520)  -- 20 MB, matches edge fn cap
on conflict (id) do nothing;

-- Owner-scoped read; writes are performed by the edge function under service_role
-- (service_role bypasses RLS), so no authenticated INSERT policy is granted here.
drop policy if exists "telegram uploads owner read" on storage.objects;
create policy "telegram uploads owner read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'telegram-uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "telegram uploads owner delete" on storage.objects;
create policy "telegram uploads owner delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'telegram-uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Rollback:
--   drop policy if exists "telegram uploads owner read" on storage.objects;
--   drop policy if exists "telegram uploads owner delete" on storage.objects;
--   delete from storage.buckets where id = 'telegram-uploads';  -- only if empty
