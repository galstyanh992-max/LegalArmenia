-- FOR SYNTHETIC DISPOSABLE FIXTURES ONLY.
-- Never run against production without a separately approved data-change plan.
-- The script intentionally leaves the transaction open for verification.

begin;

do $guard$
begin
  if current_setting('app.backfill_target', true)
       is distinct from 'synthetic_disposable_only' then
    raise exception
      'Set app.backfill_target=synthetic_disposable_only in this transaction'
      using errcode = '42501';
  end if;
end
$guard$;

create temporary table audio_transcriptions_dedup_backup
on commit drop
as
with ranked as (
  select id,
         row_number() over (
           partition by file_id
           order by created_at desc nulls last, id desc
         ) as duplicate_rank
  from public.audio_transcriptions
  where file_id is not null
)
select source.*
from public.audio_transcriptions source
join ranked on ranked.id = source.id
where ranked.duplicate_rank > 1;

delete from public.audio_transcriptions target
using audio_transcriptions_dedup_backup backup
where target.id = backup.id;

-- Verification: must return zero rows before COMMIT.
select file_id, count(*) as duplicate_count
from public.audio_transcriptions
where file_id is not null
group by file_id
having count(*) > 1;

-- Compensation before commit: ROLLBACK;
-- Approved disposable success path: COMMIT;
