-- Forward migration (D7 / PB-003): defense-in-depth idempotency for transcriptions.
-- The application layer (audio-transcribe edge fn) already replays an existing row
-- per file_id, but the table has no DB-level guarantee. This adds one.
--
-- Fresh timestamp (2026-07-12); does NOT reuse or alter any remote-applied version.
-- Guarded so a pre-existing duplicate aborts loudly rather than silently skipping.

do $$
declare
  dup_count integer;
begin
  select count(*) into dup_count
  from (
    select file_id from public.audio_transcriptions
    where file_id is not null
    group by file_id having count(*) > 1
  ) d;

  if dup_count > 0 then
    raise exception
      'audio_transcriptions has % file_id value(s) with duplicate rows; run the dedup data migration before applying the unique index',
      dup_count;
  end if;
end $$;

create unique index if not exists audio_transcriptions_file_id_key
  on public.audio_transcriptions (file_id)
  where file_id is not null;

-- Rollback:
--   drop index if exists public.audio_transcriptions_file_id_key;
