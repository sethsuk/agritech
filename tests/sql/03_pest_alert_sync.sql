-- M1: a pest alert follows the inspection's corrected severity.
DO $$
DECLARE id uuid;
  tiers text;
BEGIN
  id := (pg_temp.submit('pest_inspection_v1', 'pest_inspection', '{"severity":"mild"}', 1)->>'log_id')::uuid;
  ASSERT (SELECT count(*) FROM public.alerts WHERE triggered_by_log_id = id) = 0, 'mild: no alert';

  PERFORM pg_temp.correct(id, '{"severity":"severe"}');
  SELECT string_agg(tier::text || ':' || status::text, ',') INTO tiers FROM public.alerts WHERE triggered_by_log_id = id;
  ASSERT tiers = 'tier_1:open', 'severe: tier-1 alert, got ' || tiers;

  PERFORM pg_temp.correct(id, '{"severity":"moderate"}');
  SELECT string_agg(tier::text || ':' || status::text || ':' || subtype, ',') INTO tiers FROM public.alerts WHERE triggered_by_log_id = id;
  ASSERT tiers = 'tier_2:open:pest_moderate', 'moderate: same alert downgraded, got ' || tiers;

  PERFORM pg_temp.correct(id, '{"severity":"none"}');
  ASSERT (SELECT status FROM public.alerts WHERE triggered_by_log_id = id) = 'dismissed', 'none: alert dismissed';
END $$;
