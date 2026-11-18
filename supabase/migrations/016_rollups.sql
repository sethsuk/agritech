-- Daily rollups — the scaling layer.
--
-- The dashboard, workers list and tree statuses used to aggregate over EVERY log on every
-- load (worker_stats grouped all effective logs; dashboard_snapshot scanned them ~3 times).
-- Fine at today's volume, slow within a year or two at 50k–500k logs/year. These tables
-- hold per-day totals; the write RPCs (submit / correct / void) keep them current inside
-- the same transaction, so they are exact, never stale, and have exactly one writer.
--
-- `day` is the Bangkok calendar date of the record's submitted_at. Each record contributes
-- through its *effective* state (latest correction, nothing if voided): rollup_apply(root,
-- -1) removes the old contribution before an amendment, rollup_apply(root, +1) adds the new.
--
-- Additive and re-runnable; backfills itself the first time (rollup_rebuild).

CREATE TABLE IF NOT EXISTS public.daily_log_counts (
  day DATE NOT NULL,
  zone TEXT NOT NULL,
  side TEXT NOT NULL,
  task_type TEXT NOT NULL,
  worker_id UUID NOT NULL,
  validation_status validation_status NOT NULL,
  n INTEGER NOT NULL DEFAULT 0,
  completion_seconds_sum DOUBLE PRECISION NOT NULL DEFAULT 0,
  completion_samples INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, zone, side, task_type, worker_id, validation_status)
);
CREATE INDEX IF NOT EXISTS idx_daily_log_counts_worker ON public.daily_log_counts(worker_id, day);

CREATE TABLE IF NOT EXISTS public.daily_fruit (
  day DATE NOT NULL,
  zone TEXT NOT NULL,
  side TEXT NOT NULL,
  worker_id UUID NOT NULL,
  validation_status validation_status NOT NULL,
  grade TEXT NOT NULL,
  n INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, zone, side, worker_id, validation_status, grade)
);

-- Defense in depth (the app reads through the service role): staff read all, a worker
-- reads their own rows — which is what worker_stats (security_invoker) needs.
ALTER TABLE public.daily_log_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_fruit ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'daily_log_counts' AND policyname = 'dlc_read') THEN
    CREATE POLICY dlc_read ON public.daily_log_counts FOR SELECT
      USING (public.is_manager() OR public.is_owner() OR worker_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'daily_fruit' AND policyname = 'df_read') THEN
    CREATE POLICY df_read ON public.daily_fruit FOR SELECT
      USING (public.is_manager() OR public.is_owner() OR worker_id = auth.uid());
  END IF;
END $$;

-- Add (p_sign = 1) or remove (-1) one record's effective contribution.
CREATE OR REPLACE FUNCTION public.rollup_apply(p_root UUID, p_sign INTEGER)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  e    RECORD;
  v_day DATE;
  v_secs DOUBLE PRECISION;
BEGIN
  SELECT * INTO e FROM public.effective_task_logs WHERE log_id = p_root;
  IF NOT FOUND THEN
    RETURN; -- voided: contributes nothing
  END IF;
  v_day  := (e.submitted_at AT TIME ZONE 'Asia/Bangkok')::date;
  v_secs := EXTRACT(EPOCH FROM e.submitted_at - e.form_opened_at);

  INSERT INTO public.daily_log_counts AS d
    (day, zone, side, task_type, worker_id, validation_status, n, completion_seconds_sum, completion_samples)
  VALUES (v_day, e.zone, e.side, e.task_type, e.worker_id, e.validation_status, p_sign,
          CASE WHEN v_secs >= 0 THEN p_sign * v_secs ELSE 0 END,
          CASE WHEN v_secs >= 0 THEN p_sign ELSE 0 END)
  ON CONFLICT (day, zone, side, task_type, worker_id, validation_status) DO UPDATE SET
    n = d.n + EXCLUDED.n,
    completion_seconds_sum = d.completion_seconds_sum + EXCLUDED.completion_seconds_sum,
    completion_samples = d.completion_samples + EXCLUDED.completion_samples;

  IF e.task_type = 'harvest' AND jsonb_typeof(e.form_data->'grade_counts') = 'object' THEN
    INSERT INTO public.daily_fruit AS f (day, zone, side, worker_id, validation_status, grade, n)
    SELECT v_day, e.zone, e.side, e.worker_id, e.validation_status, g.key, p_sign * g.value::int
    FROM jsonb_each_text(e.form_data->'grade_counts') g
    WHERE g.value ~ '^\d+$' AND g.value::int > 0
    ON CONFLICT (day, zone, side, worker_id, validation_status, grade) DO UPDATE SET n = f.n + EXCLUDED.n;
  END IF;
END
$$;

-- Recompute both rollups from scratch — the backfill, and a repair tool. The SQL tests
-- assert that incremental maintenance always equals a rebuild.
CREATE OR REPLACE FUNCTION public.rollup_rebuild()
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  TRUNCATE public.daily_log_counts, public.daily_fruit;

  INSERT INTO public.daily_log_counts
    (day, zone, side, task_type, worker_id, validation_status, n, completion_seconds_sum, completion_samples)
  SELECT (e.submitted_at AT TIME ZONE 'Asia/Bangkok')::date, e.zone, e.side, e.task_type, e.worker_id, e.validation_status,
         COUNT(*),
         COALESCE(SUM(EXTRACT(EPOCH FROM e.submitted_at - e.form_opened_at)) FILTER (WHERE e.submitted_at >= e.form_opened_at), 0),
         COUNT(*) FILTER (WHERE e.submitted_at >= e.form_opened_at)
  FROM public.effective_task_logs e
  GROUP BY 1, 2, 3, 4, 5, 6;

  INSERT INTO public.daily_fruit (day, zone, side, worker_id, validation_status, grade, n)
  SELECT (e.submitted_at AT TIME ZONE 'Asia/Bangkok')::date, e.zone, e.side, e.worker_id, e.validation_status, g.key, SUM(g.value::int)
  FROM public.effective_task_logs e
  CROSS JOIN LATERAL jsonb_each_text(CASE WHEN jsonb_typeof(e.form_data->'grade_counts') = 'object'
                                          THEN e.form_data->'grade_counts' ELSE '{}'::jsonb END) g
  WHERE e.task_type = 'harvest' AND g.value ~ '^\d+$' AND g.value::int > 0
  GROUP BY 1, 2, 3, 4, 5, 6;
END
$$;

-- Fruit by grade for the Logs page filters, aggregated in SQL (it used to fetch every
-- harvest row on each page change and sum in JS).
CREATE OR REPLACE FUNCTION public.fruit_by_grade(
  p_since DATE DEFAULT NULL, p_zone TEXT DEFAULT NULL, p_side TEXT DEFAULT NULL,
  p_worker UUID DEFAULT NULL, p_status validation_status DEFAULT NULL
) RETURNS JSONB LANGUAGE sql STABLE AS $$
  SELECT COALESCE(jsonb_object_agg(grade, n), '{}'::jsonb)
  FROM (
    SELECT grade, SUM(n)::int AS n FROM public.daily_fruit
    WHERE (p_since IS NULL OR day >= p_since)
      AND (p_zone IS NULL OR (zone = p_zone AND side = p_side))
      AND (p_worker IS NULL OR worker_id = p_worker)
      AND (p_status IS NULL OR validation_status = p_status)
    GROUP BY grade HAVING SUM(n) > 0
  ) t
$$;

-- ---------------------------------------------------------------------------------
-- Readers rebuilt on the rollups / per-row index lookups (moved here from 013 because
-- they now depend on the rollup tables).
-- ---------------------------------------------------------------------------------

-- worker_stats — totals from daily_log_counts (one row per worker-day-type-status, not
-- one per log); last log via a top-1 index lookup. "Recent" = the last 90 Bangkok days.
CREATE OR REPLACE VIEW public.worker_stats WITH (security_invoker = true) AS
SELECT
  w.worker_id,
  COALESCE(SUM(d.n), 0)::int                                                    AS logs_total,
  COALESCE(SUM(d.n) FILTER (WHERE d.validation_status = 'flagged'), 0)::int     AS logs_flagged,
  COALESCE(SUM(d.completion_seconds_sum) / NULLIF(SUM(d.completion_samples), 0), 0)::float8
                                                                                AS avg_completion_seconds,
  COALESCE(SUM(d.n) FILTER (WHERE d.day >= (NOW() AT TIME ZONE 'Asia/Bangkok')::date - 90), 0)::int
                                                                                AS recent_logs_total,
  COALESCE(SUM(d.n) FILTER (WHERE d.day >= (NOW() AT TIME ZONE 'Asia/Bangkok')::date - 90
                              AND d.validation_status = 'flagged'), 0)::int     AS recent_logs_flagged,
  COALESCE(SUM(d.completion_seconds_sum) FILTER (WHERE d.day >= (NOW() AT TIME ZONE 'Asia/Bangkok')::date - 90)
           / NULLIF(SUM(d.completion_samples) FILTER (WHERE d.day >= (NOW() AT TIME ZONE 'Asia/Bangkok')::date - 90), 0), 0)::float8
                                                                                AS recent_avg_completion_seconds,
  l.last_log_at
FROM public.workers w
LEFT JOIN public.daily_log_counts d ON d.worker_id = w.worker_id
LEFT JOIN LATERAL (
  SELECT r.submitted_at AS last_log_at FROM public.task_logs r
  WHERE r.worker_id = w.worker_id AND r.correction_of_log_id IS NULL
    AND NOT EXISTS (SELECT 1 FROM public.task_logs v WHERE v.correction_of_log_id = r.log_id AND v.correction_type = 'void')
  ORDER BY r.submitted_at DESC LIMIT 1
) l ON TRUE
GROUP BY w.worker_id, l.last_log_at;

-- tree_summary — last log per tree as a top-1 index lookup (was a GROUP BY over all logs).
CREATE OR REPLACE VIEW public.tree_summary WITH (security_invoker = true) AS
SELECT
  t.tree_id,
  t.zone,
  t.side,
  t.status,
  l.last_log_at,
  COALESCE(a.open_alerts, 0)      AS open_alerts,
  COALESCE(a.has_tier1, FALSE)    AS has_tier1_alert,
  COALESCE(s.open_sets, 0)        AS open_sets
FROM public.trees t
LEFT JOIN LATERAL (
  SELECT r.submitted_at AS last_log_at FROM public.task_logs r
  WHERE r.tree_id = t.tree_id AND r.correction_of_log_id IS NULL
    AND NOT EXISTS (SELECT 1 FROM public.task_logs v WHERE v.correction_of_log_id = r.log_id AND v.correction_type = 'void')
  ORDER BY r.submitted_at DESC LIMIT 1
) l ON TRUE
LEFT JOIN (
  SELECT tree_id, COUNT(*)::int AS open_alerts, BOOL_OR(tier = 'tier_1') AS has_tier1
  FROM public.alerts
  WHERE status IN ('open', 'reviewed') AND tree_id IS NOT NULL
  GROUP BY tree_id
) a ON a.tree_id = t.tree_id
LEFT JOIN (
  SELECT tree_id, COUNT(*)::int AS open_sets
  FROM public.sets
  WHERE closed_at IS NULL
  GROUP BY tree_id
) s ON s.tree_id = t.tree_id;

REVOKE EXECUTE ON FUNCTION public.rollup_apply(UUID, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rollup_rebuild() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fruit_by_grade(DATE, TEXT, TEXT, UUID, validation_status) FROM PUBLIC, anon, authenticated;

-- Backfill once (a fresh or newly-upgraded database has empty rollups).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.daily_log_counts) THEN
    PERFORM public.rollup_rebuild();
  END IF;
END $$;
