-- Sets: bloom → fruit count → harvest, and corrections re-applying the same rules (M1).
DO $$
DECLARE r jsonb; s uuid; bloom uuid; fc uuid; h1 uuid; h2 uuid; st public.set_state;
BEGIN
  r := pg_temp.submit('bloom_log_v1', 'bloom_log', '{"color":"red","flower_count":30}', 1);
  s := (r->>'set_id')::uuid; bloom := (r->>'log_id')::uuid;
  ASSERT pg_temp.submit('bloom_log_v1', 'bloom_log', '{"color":"red","flower_count":5}', 2)->>'error' = 'ribbon_in_use', 'same ribbon blocked';

  r := pg_temp.submit('fruit_count_v1', 'fruit_check', jsonb_build_object('set_id', s, 'fruit_count', 31), 3);
  ASSERT r->>'error' = 'fruit_count_exceeds_remaining' AND (r->>'remaining')::int = 30, 'recount above flowers rejected: ' || r;
  fc := (pg_temp.submit('fruit_count_v1', 'fruit_check', jsonb_build_object('set_id', s, 'fruit_count', 12), 4)->>'log_id')::uuid;

  h1 := (pg_temp.submit('harvest_log_v1', 'harvest', jsonb_build_object('set_id', s, 'grade_counts', '{"A":7}'::jsonb), 5)->>'log_id')::uuid;
  r := pg_temp.submit('harvest_log_v1', 'harvest', jsonb_build_object('set_id', s, 'grade_counts', '{"A":9}'::jsonb), 6);
  h2 := (r->>'log_id')::uuid;
  ASSERT r->'validation_flags' ? 'harvest_exceeds_set', 'over-harvest flagged';
  ASSERT pg_temp.open_alerts('harvest_exceeds_set') = 1, 'over-harvest alert raised';
  ASSERT (pg_temp.set_row(s)).close_reason = 'harvested_out', 'set closed';

  -- Correct the over-harvest down to 4: flag and alert cleared, set reopens (12-7-4 = 1).
  r := pg_temp.correct(h2, jsonb_build_object('set_id', s, 'grade_counts', '{"A":4}'::jsonb));
  ASSERT r ? 'log_id', 'correction ok: ' || r;
  ASSERT NOT ((SELECT validation_flags FROM public.effective_task_logs WHERE log_id = h2) @> '{harvest_exceeds_set}'), 'flag removed';
  ASSERT (SELECT validation_status FROM public.effective_task_logs WHERE log_id = h2) = 'passed', 'status back to passed';
  ASSERT pg_temp.open_alerts('harvest_exceeds_set') = 0, 'alert dismissed by correction';
  st := pg_temp.set_row(s);
  ASSERT st.closed_at IS NULL AND st.remaining = 1, 'set reopened with 1 left, got ' || st.remaining;

  -- …and back up to 9: flagged and alerted again, closed again.
  PERFORM pg_temp.correct(h2, jsonb_build_object('set_id', s, 'grade_counts', '{"A":9}'::jsonb));
  ASSERT pg_temp.open_alerts('harvest_exceeds_set') = 1, 'alert re-raised';
  ASSERT (pg_temp.set_row(s)).close_reason = 'harvested_out', 'closed again';

  -- A fruit count can't be corrected above what was available when it was made (30).
  r := pg_temp.correct(fc, jsonb_build_object('set_id', s, 'fruit_count', 31));
  ASSERT r->>'error' = 'fruit_count_exceeds_remaining', 'upward recount correction rejected: ' || r;
  PERFORM pg_temp.correct(fc, jsonb_build_object('set_id', s, 'fruit_count', 20));
  st := pg_temp.set_row(s);
  ASSERT st.closed_at IS NULL AND st.remaining = 4, 'recount correction reopens the set (20-7-9=4), got ' || st.remaining;
  -- The over-harvest (9 vs 13 available after the corrected recount) is NOT re-evaluated by
  -- a correction to a different record — only correcting that harvest re-checks it.

  ASSERT pg_temp.correct(h1, jsonb_build_object('set_id', gen_random_uuid(), 'grade_counts', '{"A":7}'::jsonb))->>'error' = 'locked_field', 'set is locked';
  ASSERT pg_temp.void(bloom)->>'error' = 'set_has_activity', 'bloom with activity cannot be voided';

  -- M5: a last pick with zero fruit closes the set.
  r := pg_temp.submit('harvest_log_v1', 'harvest', jsonb_build_object('set_id', s, 'grade_counts', '{}'::jsonb, 'final_pick', true), 7);
  ASSERT r ? 'log_id', 'zero-fruit final pick accepted: ' || r;
  st := pg_temp.set_row(s);
  ASSERT st.close_reason = 'final_pick' AND st.lost = 30 - 16, 'closed by final pick, lost = ' || st.lost;
  ASSERT pg_temp.submit('harvest_log_v1', 'harvest', jsonb_build_object('set_id', s, 'grade_counts', '{"A":1}'::jsonb), 8)->>'error' = 'set_not_open', 'closed set rejects harvests';
END $$;
