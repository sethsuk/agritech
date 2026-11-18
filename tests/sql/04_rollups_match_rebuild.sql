-- Scaling: the daily rollups maintained incrementally by submit/correct/void must always
-- equal a from-scratch recomputation (rollup_rebuild). Starts from a rebuild so only drift
-- introduced by the write RPCs in this scenario is measured.
SELECT public.rollup_rebuild();
DO $$
DECLARE r jsonb; s uuid; h uuid; w uuid; p uuid; diff int; a0 int; c0 int;
BEGIN
  SELECT COALESCE(SUM(n) FILTER (WHERE grade = 'A'), 0), COALESCE(SUM(n) FILTER (WHERE grade = 'C'), 0) INTO a0, c0
  FROM public.daily_fruit WHERE zone = 'Z' AND worker_id = pg_temp.worker() AND day = (now() AT TIME ZONE 'Asia/Bangkok')::date;
  r := pg_temp.submit('bloom_log_v1', 'bloom_log', '{"color":"yellow","flower_count":20}', 1);
  s := (r->>'set_id')::uuid;
  h := (pg_temp.submit('harvest_log_v1', 'harvest', jsonb_build_object('set_id', s, 'grade_counts', '{"A":3,"B":2}'::jsonb), 2)->>'log_id')::uuid;
  w := (pg_temp.submit('watering_v1', 'watering', '{"duration_minutes": 30}', 3)->>'log_id')::uuid;
  p := (pg_temp.submit('pest_inspection_v1', 'pest_inspection', '{"severity":"mild"}', 4)->>'log_id')::uuid;
  PERFORM pg_temp.correct(h, jsonb_build_object('set_id', s, 'grade_counts', '{"A":4,"C":1}'::jsonb));
  PERFORM pg_temp.void(w);
  PERFORM pg_temp.submit('harvest_log_v1', 'harvest', jsonb_build_object('set_id', s, 'grade_counts', '{"A":30}'::jsonb), 5); -- flagged

  CREATE TEMP TABLE inc_counts AS
    SELECT day, zone, side, task_type, worker_id, validation_status, n, completion_samples, round(completion_seconds_sum::numeric, 3) AS secs
    FROM public.daily_log_counts WHERE n <> 0;
  CREATE TEMP TABLE inc_fruit AS SELECT * FROM public.daily_fruit WHERE n <> 0;

  PERFORM public.rollup_rebuild();

  SELECT count(*) INTO diff FROM (
    (SELECT * FROM inc_counts EXCEPT
     SELECT day, zone, side, task_type, worker_id, validation_status, n, completion_samples, round(completion_seconds_sum::numeric, 3) FROM public.daily_log_counts)
    UNION ALL
    (SELECT day, zone, side, task_type, worker_id, validation_status, n, completion_samples, round(completion_seconds_sum::numeric, 3) FROM public.daily_log_counts
     EXCEPT SELECT * FROM inc_counts)
  ) x;
  ASSERT diff = 0, 'daily_log_counts drifted from a rebuild in ' || diff || ' rows';

  SELECT count(*) INTO diff FROM (
    (SELECT * FROM inc_fruit EXCEPT SELECT * FROM public.daily_fruit)
    UNION ALL (SELECT * FROM public.daily_fruit EXCEPT SELECT * FROM inc_fruit)
  ) x;
  ASSERT diff = 0, 'daily_fruit drifted from a rebuild in ' || diff || ' rows';

  -- And the corrected harvest is what's counted: A4 + C1 (not A3 + B2), plus the A30.
  ASSERT (SELECT SUM(n) FILTER (WHERE grade = 'A') - a0 = 34 AND SUM(n) FILTER (WHERE grade = 'C') - c0 = 1
          FROM public.daily_fruit WHERE zone = 'Z' AND worker_id = pg_temp.worker()
            AND day = (now() AT TIME ZONE 'Asia/Bangkok')::date), 'corrected grades counted';
END $$;
