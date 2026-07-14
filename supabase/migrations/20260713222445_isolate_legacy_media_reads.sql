-- Restrict the legacy private bucket to the authenticated user's top-level
-- folder. No application source currently references this bucket, so the
-- compatibility boundary is the existing <user-id>/... object convention.

drop policy if exists media_uploads_select on storage.objects;

create policy media_uploads_select
on storage.objects
as permissive
for select
to authenticated
using (
  bucket_id = 'media-uploads'
  and (storage.foldername(name))[1] = auth.uid()::text
);
