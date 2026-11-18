-- Derived read models. Nothing here is stored: every view recomputes from task_logs /
-- sets / alerts on read, so there is no cache that can drift and no background job to
-- forget to write. Aggregation happens in Postgres rather than in JS, which also avoids
-- PostgREST's silent 1000-row response cap that used to undercount totals.
--
-- All views are security_invoker so RLS on the underlying tables still applies when an
-- authenticated (non-service-role) client queries them. Without it, a view runs with
-- its owner's privileges and would bypass RLS entirely.
--
-- CREATE OR REPLACE so re-running db:migrate picks up edits (unlike tables, which are
-- skipped once they exist).

-- Sum of a grade_counts object ({"A":3,"B":1}). Non-numeric values count as 0 rather
-- than throwing, so one malformed historical row can't break every aggregate.
CREATE OR REPLACE FUNCTION public.grade_total(grades JSONB)
RETURNS INTEGER LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(SUM(CASE WHEN value ~ '^\d+$' THEN value::int ELSE 0 END), 0)::int
  FROM jsonb_each_text(CASE WHEN jsonb_typeof(grades) = 'object' THEN grades ELSE '{}'::jsonb END)
$$;

-- ---------------------------------------------------------------------------------
-- effective_task_logs — THE way to read logs for anything that counts or displays them.
--
-- task_logs is append-only: a worker's correction or void is a *new row* pointing at the
-- root (012). Reading task_logs directly therefore double-counts corrected records and
-- still counts voided ones. This view yields exactly one row per live record: the root's
-- identity/presence data with the latest correction's values, and voided records removed.
-- ---------------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.effective_task_logs WITH (security_invoker = true) AS
SELECT
  r.log_id,
  r.tree_id,
  t.zone,
  t.side,
  r.task_def_id,
  r.task_type,
  r.set_id,
  r.worker_id,
  u.display_name AS worker_name,
  r.submitted_at,
  r.form_opened_at,
  r.qr_scanned_at,
  r.qr_value,
  r.gps_lat,
  r.gps_long,
  r.gps_delta_meters,
  COALESCE(c.form_data, r.form_data)                 AS form_data,
  COALESCE(c.validation_status, r.validation_status) AS validation_status,
  COALESCE(c.validation_flags, r.validation_flags)   AS validation_flags,
  r.photo_required,
  r.photo_url,
  r.notes_text,
  c.log_id       AS latest_correction_id,
  c.submitted_at AS corrected_at
FROM public.task_logs r
JOIN public.trees t ON t.tree_id = r.tree_id
LEFT JOIN public.users u ON u.id = r.worker_id
LEFT JOIN LATERAL (
  SELECT x.log_id, x.form_data, x.validation_status, x.validation_flags, x.submitted_at
  FROM public.task_logs x
  WHERE x.correction_of_log_id = r.log_id AND x.correction_type = 'correction'
  ORDER BY x.submitted_at DESC, x.created_at DESC
  LIMIT 1
) c ON TRUE
WHERE r.correction_of_log_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.task_logs v
    WHERE v.correction_of_log_id = r.log_id AND v.correction_type = 'void'
  );

-- ---------------------------------------------------------------------------------
-- set_state — a set plus every count derived from its logs.
--
--   bloom_flowers      flower_count on the (effective) bloom log; NULL if it was voided
--   latest_fruit_count most recent fruit-count check, if any
--   remaining          what should still be on the tree:
--                        (latest fruit count, or bloom flowers if never checked)
--                        − fruit harvested since that check
--   lost               once closed by harvesting: flowers that never became harvested fruit
--   stage              flowering → developing (checked) → harvesting → closed
-- ---------------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.set_state WITH (security_invoker = true) AS
WITH base AS (
  SELECT
    s.*,
    CASE WHEN (b.form_data->>'flower_count') ~ '^\d+$'
         THEN (b.form_data->>'flower_count')::int END AS bloom_flowers,
    fc.fruit_count                               AS latest_fruit_count,
    fc.submitted_at                              AS last_checked_at,
    COALESCE(h.harvested_total, 0)               AS harvested_total,
    COALESCE(h.harvested_since_check, 0)         AS harvested_since_check,
    COALESCE(h.harvest_count, 0)                 AS harvest_count,
    COALESCE(h.final_pick, FALSE)                AS final_pick,
    h.last_harvest_at
  FROM public.sets s
  LEFT JOIN public.effective_task_logs b ON b.log_id = s.bloom_log_id
  LEFT JOIN LATERAL (
    SELECT (e.form_data->>'fruit_count')::int AS fruit_count, e.submitted_at
    FROM public.effective_task_logs e
    WHERE e.set_id = s.set_id
      AND e.task_type = 'fruit_check'
      AND (e.form_data->>'fruit_count') ~ '^\d+$'
    ORDER BY e.submitted_at DESC
    LIMIT 1
  ) fc ON TRUE
  LEFT JOIN LATERAL (
    SELECT
      SUM(public.grade_total(e.form_data->'grade_counts'))::int AS harvested_total,
      (SUM(public.grade_total(e.form_data->'grade_counts'))
         FILTER (WHERE fc.submitted_at IS NULL OR e.submitted_at > fc.submitted_at))::int
                                                                AS harvested_since_check,
      COUNT(*)::int                                             AS harvest_count,
      BOOL_OR(e.form_data->>'final_pick' = 'true')              AS final_pick,
      MAX(e.submitted_at)                                       AS last_harvest_at
    FROM public.effective_task_logs e
    WHERE e.set_id = s.set_id AND e.task_type = 'harvest'
  ) h ON TRUE
)
SELECT
  base.*,
  COALESCE(base.latest_fruit_count, base.bloom_flowers, 0) - base.harvested_since_check AS remaining,
  CASE
    WHEN base.close_reason IN ('harvested_out', 'final_pick')
      THEN GREATEST(COALESCE(base.bloom_flowers, 0) - base.harvested_total, 0)
  END AS lost,
  CASE
    WHEN base.closed_at IS NOT NULL         THEN 'closed'
    WHEN base.harvest_count > 0             THEN 'harvesting'
    WHEN base.latest_fruit_count IS NOT NULL THEN 'developing'
    ELSE 'flowering'
  END AS stage
FROM base;

-- ---------------------------------------------------------------------------------
-- worker_stats — reliability, all-time and trailing 90 days side by side (see
-- CONTEXT.md "Reliability window"). "Needs review" = validation_status 'flagged';
-- rejected submissions are never written, so they can't appear here.
-- ---------------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.worker_stats WITH (security_invoker = true) AS
SELECT
  w.worker_id,
  COUNT(e.log_id)::int                                                     AS logs_total,
  (COUNT(e.log_id) FILTER (WHERE e.validation_status = 'flagged'))::int    AS logs_flagged,
  COALESCE(AVG(EXTRACT(EPOCH FROM e.submitted_at - e.form_opened_at))
           FILTER (WHERE e.submitted_at >= e.form_opened_at), 0)::float8   AS avg_completion_seconds,
  (COUNT(e.log_id) FILTER (WHERE e.submitted_at >= NOW() - INTERVAL '90 days'))::int
                                                                           AS recent_logs_total,
  (COUNT(e.log_id) FILTER (WHERE e.submitted_at >= NOW() - INTERVAL '90 days'
                             AND e.validation_status = 'flagged'))::int    AS recent_logs_flagged,
  COALESCE(AVG(EXTRACT(EPOCH FROM e.submitted_at - e.form_opened_at))
           FILTER (WHERE e.submitted_at >= e.form_opened_at
                     AND e.submitted_at >= NOW() - INTERVAL '90 days'), 0)::float8
                                                                           AS recent_avg_completion_seconds,
  MAX(e.submitted_at)                                                      AS last_log_at
FROM public.workers w
LEFT JOIN public.effective_task_logs e ON e.worker_id = w.worker_id
GROUP BY w.worker_id;

-- ---------------------------------------------------------------------------------
-- tree_summary — per-tree facts the lists and dashboard need. "Active" alerts are
-- open or reviewed (acknowledged but not yet resolved).
-- ---------------------------------------------------------------------------------
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
LEFT JOIN (
  SELECT tree_id, MAX(submitted_at) AS last_log_at
  FROM public.effective_task_logs
  GROUP BY tree_id
) l ON l.tree_id = t.tree_id
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
