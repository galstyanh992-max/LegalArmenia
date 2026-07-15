set statement_timeout = '5s';

explain (analyze, buffers, wal, settings, format json)
with identifier_lane(chunk_id, lane_rank, score) as (
  select gen_random_uuid(), value, 1.0::real from generate_series(1, 10) value
), metric_lane(chunk_id, lane_rank, score) as (
  select gen_random_uuid(), value, 0.9::real from generate_series(1, 30) value
), fts_lane(chunk_id, lane_rank, score) as (
  select gen_random_uuid(), value, 0.8::real from generate_series(1, 20) value
), lane_rows as (
  select chunk_id, 'identifier'::text lane, lane_rank, score from identifier_lane
  union all
  select chunk_id, 'metric_ann', lane_rank, score from metric_lane
  union all
  select chunk_id, 'armenian_fts', lane_rank, score from fts_lane
), fused as (
  select
    chunk_id,
    sum(case lane when 'identifier' then 3.0 / (60.0 + lane_rank)
      when 'metric_ann' then 1.5 / (60.0 + lane_rank)
      else 1.0 / (60.0 + lane_rank) end) as rrf_score,
    array_agg(lane order by lane) as routes
  from lane_rows
  group by chunk_id
)
select * from fused order by rrf_score desc, chunk_id limit 15;
