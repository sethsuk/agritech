-- H1: the same submission sent twice (a retry after a lost response) saves ONE log.
DO $$
DECLARE sub uuid := gen_random_uuid(); a jsonb; b jsonb;
BEGIN
  a := pg_temp.submit('watering_v1', 'watering', '{"duration_minutes": 10}', 1, sub);
  b := pg_temp.submit('watering_v1', 'watering', '{"duration_minutes": 10}', 2, sub);
  ASSERT a ? 'log_id' AND NOT (a ? 'duplicate'), 'first submit should insert: ' || a;
  ASSERT b->>'log_id' = a->>'log_id' AND (b->>'duplicate')::boolean, 'retry should return the first log: ' || b;
  ASSERT (SELECT count(*) FROM public.task_logs WHERE submission_id = sub) = 1, 'exactly one row';
END $$;
