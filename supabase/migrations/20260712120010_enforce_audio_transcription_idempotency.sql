-- Forward migration: database-level idempotency for one transcription per file.
-- This fails closed if pre-existing duplicates require a reviewed data backfill.

do $block$
begin
  if exists (
    select 1
    from public.audio_transcriptions
    where file_id is not null
    group by file_id
    having count(*) > 1
  ) then
    raise exception
      'audio_transcriptions.file_id duplicates require the separate guarded backfill'
      using errcode = '23505';
  end if;
end
$block$;

create unique index audio_transcriptions_file_id_key
  on public.audio_transcriptions (file_id)
  where file_id is not null;

-- Verification (must return zero rows):
-- select file_id, count(*) from public.audio_transcriptions
-- where file_id is not null group by file_id having count(*) > 1;
-- Compensation: drop index public.audio_transcriptions_file_id_key;
