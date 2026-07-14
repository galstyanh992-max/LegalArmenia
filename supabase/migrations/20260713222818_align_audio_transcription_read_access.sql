-- Align transcription visibility with the canonical case-read contract.
-- This includes direct client/lawyer ownership, explicit case membership,
-- and the approved admin path implemented by app.can_read_case().

drop policy if exists "Users can view audio transcriptions of their files"
on public.audio_transcriptions;

create policy "Users can view audio transcriptions of their files"
on public.audio_transcriptions
as permissive
for select
to authenticated
using (
  exists (
    select 1
    from app.client_documents cd
    where cd.doc_id = audio_transcriptions.file_id
      and app.can_read_case(cd.case_id)
  )
);
