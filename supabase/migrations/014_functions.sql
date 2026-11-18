-- Write-side RPCs and the dashboard read model.
--
-- Every write that touches more than one row (a log plus its set, its alerts) goes
-- through one of these functions so it happens in a single transaction. Previously
-- submit-log inserted the log, responded, then ran the side effects fire-and-forget:
-- on serverless the function can be frozen right after the response, silently losing
-- the set/alert writes, and every one of those writes ignored its own error.
--
-- Fraud validation (GPS / QR / timing / bounds) stays in TypeScript (lib/validation) and
-- arrives here as validation_status + validation_flags. *Domain integrity* — a harvest
-- must target an open set on that tree, one open set per ribbon colour — is enforced
-- here, so it holds even with SKIP_VALIDATION=true.
--
-- Errors are returned as {"error": "<code>", ...}, never raised, so API routes can map
-- them to translated messages (lib/i18n/labels.ts errorMessage()).

CREATE OR REPLACE FUNCTION public.maturation_days(p_variety TEXT)
RETURNS INTEGER LANGUAGE sql IMMUTABLE AS $$
  -- Days from bloom to harvest. Farm-practice estimates; tune here.
  SELECT CASE lower(p_variety)
    WHEN 'monthong'   THEN 120
    WHEN 'kanyao'     THEN 125
    WHEN 'chanee'     THEN 105
    WHEN 'puangmanee' THEN 100
    ELSE 120
  END
$$;

-- ---------------------------------------------------------------------------------
-- sync_set — the ONLY writer of sets.closed_at / close_reason (besides a manager's
-- manual 'failed'). Idempotent: recomputes from set_state, so it is safe to call after
-- any log, correction or void that touches the set. A correction that lowers a harvest
-- reopens the set; reopening is skipped if a newer open set already uses that colour.
-- ---------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_set(p_set_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  st RECORD;
  v_reason set_close_reason;
BEGIN
  SELECT * INTO st FROM public.set_state WHERE set_id = p_set_id;
  IF NOT FOUND OR st.close_reason = 'failed' THEN
    RETURN;
  END IF;

  v_reason := CASE
    WHEN st.bloom_flowers IS NULL                                  THEN 'bloom_voided'
    WHEN st.final_pick                                             THEN 'final_pick'
    WHEN st.harvest_count > 0 AND st.remaining <= 0                THEN 'harvested_out'
    WHEN st.harvest_count = 0 AND st.latest_fruit_count IS NOT NULL
         AND st.remaining <= 0                                     THEN 'all_dropped'
    ELSE NULL
  END::set_close_reason;

  IF v_reason IS NOT DISTINCT FROM st.close_reason THEN
    RETURN;
  END IF;

  BEGIN
    UPDATE public.sets
    SET close_reason = v_reason,
        closed_at = CASE WHEN v_reason IS NULL THEN NULL ELSE NOW() END
    WHERE set_id = p_set_id;
  EXCEPTION WHEN unique_violation THEN
    NULL; -- reopening would collide with a newer open set of the same colour
  END;
END
$$;

-- ---------------------------------------------------------------------------------
-- set_available_at — fruit that should be on a set just before `p_at`: the latest
-- effective fruit count before then (or the bloom's flowers if never counted), minus
-- harvests between that count and `p_at`. `p_exclude` leaves one log out, so a
-- correction is checked against the state *as it was* when that record was made.
--
-- The single definition of "available" for both new submissions and corrections —
-- they used to disagree (corrections skipped the domain rules entirely).
-- ---------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_available_at(p_set UUID, p_at TIMESTAMPTZ, p_exclude UUID DEFAULT NULL)
RETURNS INTEGER LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_count INTEGER;
  v_since TIMESTAMPTZ;
  v_harvested INTEGER;
BEGIN
  SELECT (e.form_data->>'fruit_count')::int, e.submitted_at INTO v_count, v_since
  FROM public.effective_task_logs e
  WHERE e.set_id = p_set AND e.task_type = 'fruit_check' AND e.submitted_at < p_at
    AND e.log_id IS DISTINCT FROM p_exclude AND (e.form_data->>'fruit_count') ~ '^\d+$'
  ORDER BY e.submitted_at DESC
  LIMIT 1;

  IF v_since IS NULL THEN
    SELECT CASE WHEN (e.form_data->>'flower_count') ~ '^\d+$' THEN (e.form_data->>'flower_count')::int END
    INTO v_count
    FROM public.sets s JOIN public.effective_task_logs e ON e.log_id = s.bloom_log_id
    WHERE s.set_id = p_set;
    v_since := '-infinity';
  END IF;

  SELECT COALESCE(SUM(public.grade_total(e.form_data->'grade_counts')), 0)::int INTO v_harvested
  FROM public.effective_task_logs e
  WHERE e.set_id = p_set AND e.task_type = 'harvest'
    AND e.submitted_at > v_since AND e.submitted_at < p_at
    AND e.log_id IS DISTINCT FROM p_exclude;

  RETURN COALESCE(v_count, 0) - v_harvested;
END
$$;

-- ---------------------------------------------------------------------------------
-- sync_pest_alert — make a pest inspection's alert match its (current) severity:
-- moderate → tier 2, severe → tier 1, none/mild → no open alert. Used on submit and on
-- correction, so changing "mild" to "severe" raises the alert and the reverse clears it.
-- ---------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_pest_alert(
  p_root UUID, p_severity TEXT, p_tree TEXT, p_worker UUID
) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  v_alert UUID;
  v_tier alert_tier;
BEGIN
  SELECT alert_id INTO v_alert FROM public.alerts
  WHERE triggered_by_log_id = p_root AND category = 'farm_health' AND subtype LIKE 'pest\_%'
    AND status IN ('open', 'reviewed')
  LIMIT 1;

  IF p_severity IN ('moderate', 'severe') THEN
    v_tier := CASE WHEN p_severity = 'severe' THEN 'tier_1' ELSE 'tier_2' END;
    IF v_alert IS NULL THEN
      INSERT INTO public.alerts (tier, category, subtype, tree_id, worker_id, triggered_by_log_id)
      VALUES (v_tier, 'farm_health', 'pest_' || p_severity, p_tree, p_worker, p_root);
    ELSE
      UPDATE public.alerts SET tier = v_tier, subtype = 'pest_' || p_severity WHERE alert_id = v_alert;
    END IF;
  ELSIF v_alert IS NOT NULL THEN
    UPDATE public.alerts
    SET status = 'dismissed', resolution_action_taken = 'corrected', resolution_resolved_at = NOW()
    WHERE alert_id = v_alert;
  END IF;
END
$$;

-- Keep a harvest's over-harvest alert in step with its flag (raise once / clear on fix).
CREATE OR REPLACE FUNCTION public.sync_over_harvest_alert(
  p_root UUID, p_exceeds BOOLEAN, p_tree TEXT, p_worker UUID
) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  IF p_exceeds THEN
    IF NOT EXISTS (SELECT 1 FROM public.alerts WHERE triggered_by_log_id = p_root
                   AND subtype = 'harvest_exceeds_set' AND status IN ('open', 'reviewed')) THEN
      INSERT INTO public.alerts (tier, category, subtype, tree_id, worker_id, triggered_by_log_id)
      VALUES ('tier_2', 'compliance', 'harvest_exceeds_set', p_tree, p_worker, p_root);
    END IF;
  ELSE
    UPDATE public.alerts
    SET status = 'dismissed', resolution_action_taken = 'corrected', resolution_resolved_at = NOW()
    WHERE triggered_by_log_id = p_root AND subtype = 'harvest_exceeds_set' AND status IN ('open', 'reviewed');
  END IF;
END
$$;

-- ---------------------------------------------------------------------------------
-- submit_task_log(p) — insert a validated log and all its consequences atomically.
--
-- p: the task_logs columns as JSON (tree_id, task_def_id, task_type, worker_id,
--    submission_id, submitted_at, form_opened_at, qr_scanned_at, qr_value, gps_*,
--    form_data, photo_*, validation_status, validation_flags, notes_text).
-- Returns {log_id, validation_status, validation_flags, set_id[, duplicate]} or {error, ...}.
-- ---------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_task_log(p JSONB)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
  v_type       TEXT := p->>'task_type';
  v_tree       TEXT := p->>'tree_id';
  v_worker     UUID := (p->>'worker_id')::uuid;
  v_submission UUID := NULLIF(p->>'submission_id', '')::uuid;
  v_at         TIMESTAMPTZ := (p->>'submitted_at')::timestamptz;
  v_form       JSONB := COALESCE(p->'form_data', '{}'::jsonb);
  v_flags      TEXT[] := COALESCE(ARRAY(SELECT jsonb_array_elements_text(p->'validation_flags')), '{}');
  v_status     validation_status := (p->>'validation_status')::validation_status;
  v_variety    TEXT;
  v_color      generation_color;
  v_set_id     UUID;
  v_open       BOOLEAN;
  v_available  INTEGER;
  v_count      INTEGER;
  v_total      INTEGER;
  v_days       INTEGER;
  v_bloom      DATE;
  v_log_id     UUID;
  v_existing   RECORD;
  v_fraud      TEXT;
BEGIN
  -- Lock the tree row: serializes every set-touching write for one tree (submit, correct,
  -- void all take this lock first), so the checks below can't race. A submission token is
  -- bound to one tree, so this also serializes retries of the same submission.
  SELECT variety INTO v_variety FROM public.trees WHERE tree_id = v_tree FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'tree_not_found');
  END IF;

  -- Idempotency: the same form submitted twice returns the first result.
  IF v_submission IS NOT NULL THEN
    SELECT log_id, validation_status, validation_flags INTO v_existing
    FROM public.task_logs WHERE submission_id = v_submission;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'log_id', v_existing.log_id,
        'validation_status', v_existing.validation_status,
        'validation_flags', to_jsonb(v_existing.validation_flags),
        'set_id', public.set_of_log(v_existing.log_id),
        'duplicate', true
      );
    END IF;
  END IF;

  IF v_type = 'bloom_log' THEN
    IF (v_form->>'color') IS NULL
       OR NOT ((v_form->>'color') = ANY (enum_range(NULL::generation_color)::text[])) THEN
      RETURN jsonb_build_object('error', 'invalid_color');
    END IF;
    v_color := (v_form->>'color')::generation_color;
    IF EXISTS (SELECT 1 FROM public.sets
               WHERE tree_id = v_tree AND color = v_color AND closed_at IS NULL) THEN
      RETURN jsonb_build_object('error', 'ribbon_in_use', 'color', v_color);
    END IF;

  ELSIF v_type IN ('harvest', 'fruit_check') THEN
    BEGIN
      v_set_id := (v_form->>'set_id')::uuid;
    EXCEPTION WHEN others THEN
      v_set_id := NULL;
    END;
    SELECT (closed_at IS NULL) INTO v_open FROM public.sets WHERE set_id = v_set_id AND tree_id = v_tree;
    IF NOT COALESCE(v_open, FALSE) THEN
      RETURN jsonb_build_object('error', 'set_not_open');
    END IF;
    v_available := public.set_available_at(v_set_id, v_at);

    IF v_type = 'fruit_check' THEN
      v_count := CASE WHEN (v_form->>'fruit_count') ~ '^\d+$' THEN (v_form->>'fruit_count')::int END;
      IF v_count IS NULL THEN
        RETURN jsonb_build_object('error', 'invalid_fruit_count');
      END IF;
      -- A recount can only go down: fruit drops, it doesn't appear.
      IF v_count > GREATEST(v_available, 0) THEN
        RETURN jsonb_build_object('error', 'fruit_count_exceeds_remaining', 'remaining', GREATEST(v_available, 0));
      END IF;
    ELSE
      v_total := public.grade_total(v_form->'grade_counts');
      IF v_total = 0 AND COALESCE(v_form->>'final_pick', 'false') <> 'true' THEN
        RETURN jsonb_build_object('error', 'empty_harvest');
      END IF;
      -- Harvesting more than the bloom log accounts for is allowed (miscounts happen in
      -- the field) but flagged for the manager.
      IF v_total > v_available THEN
        v_flags := array_append(v_flags, 'harvest_exceeds_set');
        v_status := 'flagged';
      END IF;
    END IF;
  END IF;

  INSERT INTO public.task_logs (
    tree_id, task_def_id, task_type, worker_id, set_id, submission_id,
    submitted_at, form_opened_at, qr_scanned_at, qr_value,
    gps_lat, gps_long, gps_delta_meters,
    form_data, photo_required, photo_requirement_reason, photo_audit_selection_seed, photo_url,
    validation_status, validation_flags, notes_text
  ) VALUES (
    v_tree, p->>'task_def_id', v_type, v_worker, v_set_id, v_submission,
    v_at, (p->>'form_opened_at')::timestamptz,
    (p->>'qr_scanned_at')::timestamptz, p->>'qr_value',
    (p->>'gps_lat')::numeric, (p->>'gps_long')::numeric, (p->>'gps_delta_meters')::numeric,
    v_form, COALESCE((p->>'photo_required')::boolean, FALSE),
    COALESCE((p->>'photo_requirement_reason')::photo_requirement_reason, 'none'),
    p->>'photo_audit_selection_seed', p->>'photo_url',
    v_status, v_flags, p->>'notes_text'
  )
  RETURNING log_id INTO v_log_id;

  IF v_type = 'bloom_log' THEN
    v_days  := public.maturation_days(v_variety);
    v_bloom := (v_at AT TIME ZONE 'Asia/Bangkok')::date;
    INSERT INTO public.sets (tree_id, color, bloom_log_id, bloom_date, estimated_maturation_days,
                             harvest_window_start, harvest_window_end)
    VALUES (v_tree, v_color, v_log_id, v_bloom, v_days, v_bloom + (v_days - 7), v_bloom + (v_days + 7))
    RETURNING set_id INTO v_set_id;
  END IF;

  IF v_type = 'pest_inspection' THEN
    PERFORM public.sync_pest_alert(v_log_id, v_form->>'severity', v_tree, v_worker);
  END IF;

  SELECT f INTO v_fraud FROM unnest(v_flags) AS f WHERE f IN ('qr_mismatch', 'gps_off_tree') LIMIT 1;
  IF v_fraud IS NOT NULL THEN
    INSERT INTO public.alerts (tier, category, subtype, tree_id, worker_id, triggered_by_log_id)
    VALUES ('tier_1', 'fraud_signal', v_fraud, v_tree, v_worker, v_log_id);
  END IF;

  IF v_type = 'harvest' THEN
    PERFORM public.sync_over_harvest_alert(v_log_id, 'harvest_exceeds_set' = ANY (v_flags), v_tree, v_worker);
  END IF;

  IF v_type IN ('harvest', 'fruit_check') THEN
    PERFORM public.sync_set(v_set_id);
  END IF;

  RETURN jsonb_build_object(
    'log_id', v_log_id,
    'validation_status', v_status,
    'validation_flags', to_jsonb(v_flags),
    'set_id', v_set_id
  );
END
$$;

-- Shared guard for correct/void: resolves any row in a chain to its root and locks it.
-- Lock order is ALWAYS tree → root, the same as submit_task_log, so a correction/void and
-- a new submission on the same tree serialize: sync_set then always sees the other's
-- committed rows (otherwise a void and a set-emptying harvest could leave a set closed
-- with fruit remaining).
CREATE OR REPLACE FUNCTION public.lock_log_root(p_log_id UUID, p_worker UUID)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
  v_root_id UUID;
  v_tree    TEXT;
  v_owner   UUID;
BEGIN
  SELECT COALESCE(correction_of_log_id, log_id), tree_id INTO v_root_id, v_tree
  FROM public.task_logs WHERE log_id = p_log_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  PERFORM 1 FROM public.trees WHERE tree_id = v_tree FOR UPDATE;
  SELECT worker_id INTO v_owner FROM public.task_logs WHERE log_id = v_root_id FOR UPDATE;
  IF v_owner <> p_worker THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;
  IF EXISTS (SELECT 1 FROM public.task_logs
             WHERE correction_of_log_id = v_root_id AND correction_type = 'void') THEN
    RETURN jsonb_build_object('error', 'already_voided');
  END IF;
  RETURN jsonb_build_object('root_id', v_root_id);
END
$$;

-- The set a log belongs to: its set_id, or the set a bloom log created.
CREATE OR REPLACE FUNCTION public.set_of_log(p_root_id UUID)
RETURNS UUID LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    (SELECT set_id FROM public.task_logs WHERE log_id = p_root_id),
    (SELECT set_id FROM public.sets WHERE bloom_log_id = p_root_id)
  )
$$;

-- ---------------------------------------------------------------------------------
-- correct_task_log — append a correction row, re-applying the same domain rules as a
-- new submission:
--   * fruit count: can't exceed what was available when the count was made;
--   * harvest: the over-harvest flag (and its alert) is recomputed, both ways;
--   * pest: the pest alert follows the corrected severity.
-- Fields that identify a set (the bloom's ribbon colour, a harvest/fruit-check's set)
-- cannot be changed: that would silently move fruit between sets. Void and re-log.
--
-- p_flags carries the presence/timing flags of the original visit plus recomputed
-- value-range flags (from TypeScript); domain flags are owned here. p_status is ignored —
-- the status follows the final flags.
-- ---------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.correct_task_log(
  p_log_id UUID, p_worker UUID, p_form JSONB,
  p_status validation_status, p_flags TEXT[], p_reason TEXT
) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
  v_guard     JSONB;
  v_root      public.task_logs;
  v_eff       JSONB;
  v_new       UUID;
  v_set       UUID;
  v_flags     TEXT[] := array_remove(COALESCE(p_flags, '{}'), 'harvest_exceeds_set');
  v_available INTEGER;
  v_count     INTEGER;
  v_total     INTEGER;
  v_exceeds   BOOLEAN := FALSE;
BEGIN
  v_guard := public.lock_log_root(p_log_id, p_worker);
  IF v_guard ? 'error' THEN
    RETURN v_guard;
  END IF;
  SELECT * INTO v_root FROM public.task_logs WHERE log_id = (v_guard->>'root_id')::uuid;
  SELECT form_data INTO v_eff FROM public.effective_task_logs WHERE log_id = v_root.log_id;

  IF v_root.task_type = 'bloom_log' AND (p_form->>'color') IS DISTINCT FROM (v_eff->>'color') THEN
    RETURN jsonb_build_object('error', 'locked_field', 'field', 'color');
  END IF;
  IF v_root.task_type IN ('harvest', 'fruit_check')
     AND (p_form->>'set_id') IS DISTINCT FROM v_root.set_id::text THEN
    RETURN jsonb_build_object('error', 'locked_field', 'field', 'set_id');
  END IF;

  v_set := public.set_of_log(v_root.log_id);

  IF v_root.task_type = 'fruit_check' THEN
    v_count := CASE WHEN (p_form->>'fruit_count') ~ '^\d+$' THEN (p_form->>'fruit_count')::int END;
    IF v_count IS NULL THEN
      RETURN jsonb_build_object('error', 'invalid_fruit_count');
    END IF;
    v_available := public.set_available_at(v_set, v_root.submitted_at, v_root.log_id);
    IF v_count > GREATEST(v_available, 0) THEN
      RETURN jsonb_build_object('error', 'fruit_count_exceeds_remaining', 'remaining', GREATEST(v_available, 0));
    END IF;
  ELSIF v_root.task_type = 'harvest' THEN
    v_total := public.grade_total(p_form->'grade_counts');
    IF v_total = 0 AND COALESCE(p_form->>'final_pick', 'false') <> 'true' THEN
      RETURN jsonb_build_object('error', 'empty_harvest');
    END IF;
    v_exceeds := v_total > public.set_available_at(v_set, v_root.submitted_at, v_root.log_id);
    IF v_exceeds THEN
      v_flags := array_append(v_flags, 'harvest_exceeds_set');
    END IF;
  END IF;

  INSERT INTO public.task_logs (
    tree_id, task_def_id, task_type, assignment_id, worker_id, set_id,
    submitted_at, form_opened_at, qr_scanned_at, qr_value, gps_lat, gps_long, gps_delta_meters,
    form_data, photo_required, photo_requirement_reason, photo_url,
    validation_status, validation_flags,
    correction_of_log_id, correction_type, correction_reason
  ) VALUES (
    v_root.tree_id, v_root.task_def_id, v_root.task_type, v_root.assignment_id, p_worker, v_root.set_id,
    -- clock_timestamp(), not NOW(): two amendments in one transaction must still order.
    clock_timestamp(), clock_timestamp(), v_root.qr_scanned_at, v_root.qr_value, v_root.gps_lat, v_root.gps_long, v_root.gps_delta_meters,
    p_form, FALSE, 'none', v_root.photo_url,
    CASE WHEN cardinality(v_flags) > 0 THEN 'flagged' ELSE 'passed' END::validation_status, v_flags,
    v_root.log_id, 'correction', p_reason
  )
  RETURNING log_id INTO v_new;

  IF v_root.task_type = 'harvest' THEN
    PERFORM public.sync_over_harvest_alert(v_root.log_id, v_exceeds, v_root.tree_id, v_root.worker_id);
  ELSIF v_root.task_type = 'pest_inspection' THEN
    PERFORM public.sync_pest_alert(v_root.log_id, p_form->>'severity', v_root.tree_id, v_root.worker_id);
  END IF;

  IF v_set IS NOT NULL THEN
    PERFORM public.sync_set(v_set);
  END IF;

  RETURN jsonb_build_object('log_id', v_new, 'root_id', v_root.log_id);
END
$$;

-- ---------------------------------------------------------------------------------
-- void_task_log — append a void row. A bloom can't be voided once its set has fruit
-- checks or harvests (those would be orphaned). Open farm-health/compliance alerts the
-- log raised are dismissed with it; fraud alerts are deliberately kept, or voiding
-- would be a way to erase evidence.
-- ---------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.void_task_log(p_log_id UUID, p_worker UUID, p_reason TEXT)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
  v_guard JSONB;
  v_root  public.task_logs;
  v_new   UUID;
  v_set   UUID;
BEGIN
  v_guard := public.lock_log_root(p_log_id, p_worker);
  IF v_guard ? 'error' THEN
    RETURN v_guard;
  END IF;
  SELECT * INTO v_root FROM public.task_logs WHERE log_id = (v_guard->>'root_id')::uuid;
  v_set := public.set_of_log(v_root.log_id);

  IF v_root.task_type = 'bloom_log' AND EXISTS (
    SELECT 1 FROM public.effective_task_logs WHERE set_id = v_set
  ) THEN
    RETURN jsonb_build_object('error', 'set_has_activity');
  END IF;

  INSERT INTO public.task_logs (
    tree_id, task_def_id, task_type, assignment_id, worker_id, set_id,
    submitted_at, form_opened_at, qr_scanned_at, qr_value,
    form_data, photo_required, photo_requirement_reason,
    validation_status, validation_flags,
    correction_of_log_id, correction_type, correction_reason
  ) VALUES (
    v_root.tree_id, v_root.task_def_id, v_root.task_type, v_root.assignment_id, p_worker, v_root.set_id,
    clock_timestamp(), clock_timestamp(), v_root.qr_scanned_at, v_root.qr_value,
    '{}'::jsonb, FALSE, 'none',
    'passed', '{}',
    v_root.log_id, 'void', p_reason
  )
  RETURNING log_id INTO v_new;

  UPDATE public.alerts
  SET status = 'dismissed',
      resolution_action_taken = 'source_log_voided',
      resolution_resolved_at = NOW(),
      resolution_notes = p_reason
  WHERE triggered_by_log_id = v_root.log_id
    AND status IN ('open', 'reviewed')
    AND category IN ('farm_health', 'compliance');

  IF v_set IS NOT NULL THEN
    PERFORM public.sync_set(v_set);
  END IF;

  RETURN jsonb_build_object('log_id', v_new, 'root_id', v_root.log_id);
END
$$;

-- ---------------------------------------------------------------------------------
-- manager_set_failed — a manager closes a set by hand as 'failed' (tree died, storm…)
-- or reopens one they closed. sync_set never overrides 'failed'; reopening hands the
-- set back to sync_set, which may close it again for a derived reason. Takes the tree
-- lock like every other set write.
-- ---------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.manager_set_failed(p_set UUID, p_failed BOOLEAN)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
  v_set public.sets;
BEGIN
  SELECT * INTO v_set FROM public.sets WHERE set_id = p_set;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;
  PERFORM 1 FROM public.trees WHERE tree_id = v_set.tree_id FOR UPDATE;

  IF p_failed THEN
    IF v_set.closed_at IS NOT NULL THEN
      RETURN jsonb_build_object('error', 'set_not_open');
    END IF;
    UPDATE public.sets SET closed_at = NOW(), close_reason = 'failed' WHERE set_id = p_set;
  ELSE
    IF v_set.close_reason IS DISTINCT FROM 'failed' THEN
      RETURN jsonb_build_object('error', 'bad_request');
    END IF;
    BEGIN
      UPDATE public.sets SET closed_at = NULL, close_reason = NULL WHERE set_id = p_set;
    EXCEPTION WHEN unique_violation THEN
      RETURN jsonb_build_object('error', 'ribbon_in_use', 'color', v_set.color);
    END;
    PERFORM public.sync_set(p_set);
  END IF;
  RETURN jsonb_build_object('set_id', p_set);
END
$$;

-- ---------------------------------------------------------------------------------
-- dashboard_snapshot — everything the manager overview needs, in ONE round trip,
-- pre-grouped by (zone, side) and by every time range at once. The client picks a
-- zone/range locally, so switching filters needs no further requests.
--
-- Ranges are Bangkok calendar periods: today, this week (Mon–), this month, this year.
-- ---------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.dashboard_snapshot(p_stale_days INTEGER DEFAULT 3)
RETURNS JSONB LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_local TIMESTAMP := NOW() AT TIME ZONE 'Asia/Bangkok';
  v_today TIMESTAMPTZ := date_trunc('day',   v_local) AT TIME ZONE 'Asia/Bangkok';
  v_week  TIMESTAMPTZ := date_trunc('week',  v_local) AT TIME ZONE 'Asia/Bangkok';
  v_month TIMESTAMPTZ := date_trunc('month', v_local) AT TIME ZONE 'Asia/Bangkok';
  v_year  TIMESTAMPTZ := date_trunc('year',  v_local) AT TIME ZONE 'Asia/Bangkok';
  v_stale TIMESTAMPTZ := NOW() - make_interval(days => p_stale_days);
  v_result JSONB;
BEGIN
  WITH logs AS (
    SELECT zone, side, task_type, form_data, submitted_at FROM public.effective_task_logs
  ),
  log_counts AS (
    SELECT zone, side,
      COUNT(*) FILTER (WHERE submitted_at >= v_today) AS today,
      COUNT(*) FILTER (WHERE submitted_at >= v_week)  AS week,
      COUNT(*) FILTER (WHERE submitted_at >= v_month) AS month,
      COUNT(*) FILTER (WHERE submitted_at >= v_year)  AS year,
      COUNT(*)                                        AS "all"
    FROM logs GROUP BY zone, side
  ),
  fruit AS (
    SELECT l.zone, l.side, g.key AS grade,
      COALESCE(SUM(g.n) FILTER (WHERE l.submitted_at >= v_today), 0) AS today,
      COALESCE(SUM(g.n) FILTER (WHERE l.submitted_at >= v_week),  0) AS week,
      COALESCE(SUM(g.n) FILTER (WHERE l.submitted_at >= v_month), 0) AS month,
      COALESCE(SUM(g.n) FILTER (WHERE l.submitted_at >= v_year),  0) AS year,
      COALESCE(SUM(g.n), 0)                                          AS "all"
    FROM logs l
    CROSS JOIN LATERAL (
      SELECT key, CASE WHEN value ~ '^\d+$' THEN value::int ELSE 0 END AS n
      FROM jsonb_each_text(CASE WHEN jsonb_typeof(l.form_data->'grade_counts') = 'object'
                                THEN l.form_data->'grade_counts' ELSE '{}'::jsonb END)
    ) g
    WHERE l.task_type = 'harvest'
    GROUP BY l.zone, l.side, g.key
  ),
  stale AS (
    SELECT tree_id, zone, side, last_log_at,
      ROW_NUMBER() OVER (PARTITION BY zone, side ORDER BY last_log_at ASC NULLS FIRST, tree_id) AS rn
    FROM public.tree_summary
    WHERE status = 'active' AND (last_log_at IS NULL OR last_log_at < v_stale)
  ),
  recent AS (
    SELECT e.*, ROW_NUMBER() OVER (PARTITION BY e.zone, e.side ORDER BY e.submitted_at DESC) AS rn
    FROM public.effective_task_logs e
  )
  SELECT jsonb_build_object(
    'generatedAt', NOW(),
    'staleDays', p_stale_days,
    'bounds', jsonb_build_object('today', v_today, 'week', v_week, 'month', v_month, 'year', v_year),
    'zones', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('zone', zone, 'side', side, 'trees', n) ORDER BY zone, side)
      FROM (SELECT zone, side, COUNT(*) AS n FROM public.trees WHERE status = 'active' GROUP BY zone, side) z
    ), '[]'::jsonb),
    'logCounts', COALESCE((SELECT jsonb_agg(to_jsonb(lc)) FROM log_counts lc), '[]'::jsonb),
    'fruit', COALESCE((SELECT jsonb_agg(to_jsonb(f)) FROM fruit f), '[]'::jsonb),
    'alerts', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'alert_id', a.alert_id, 'tier', a.tier, 'category', a.category, 'subtype', a.subtype,
        'tree_id', a.tree_id, 'zone', t.zone, 'side', t.side, 'created_at', a.created_at
      ) ORDER BY a.created_at DESC)
      FROM public.alerts a LEFT JOIN public.trees t ON t.tree_id = a.tree_id
      WHERE a.status IN ('open', 'reviewed')
    ), '[]'::jsonb),
    'staleCounts', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('zone', zone, 'side', side, 'count', n))
      FROM (SELECT zone, side, COUNT(*) AS n FROM stale GROUP BY zone, side) sc
    ), '[]'::jsonb),
    'staleTrees', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'tree_id', tree_id, 'zone', zone, 'side', side, 'last_log_at', last_log_at
      ) ORDER BY last_log_at ASC NULLS FIRST, tree_id)
      FROM stale WHERE rn <= 20
    ), '[]'::jsonb),
    'overdueSets', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'set_id', s.set_id, 'tree_id', s.tree_id, 'zone', t.zone, 'side', t.side,
        'color', s.color, 'harvest_window_end', s.harvest_window_end, 'remaining', s.remaining
      ) ORDER BY s.harvest_window_end)
      FROM public.set_state s JOIN public.trees t ON t.tree_id = s.tree_id
      WHERE s.closed_at IS NULL AND s.harvest_window_end < v_local::date
    ), '[]'::jsonb),
    'recentLogs', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'log_id', r.log_id, 'tree_id', r.tree_id, 'zone', r.zone, 'side', r.side,
        'task_def_id', r.task_def_id, 'task_type', r.task_type, 'worker_name', r.worker_name,
        'submitted_at', r.submitted_at, 'validation_status', r.validation_status,
        'validation_flags', r.validation_flags
      ) ORDER BY r.submitted_at DESC)
      FROM recent r WHERE r.rn <= 20
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END
$$;

-- These RPCs are called only by the server with the service-role key. Supabase grants
-- EXECUTE on new public functions to anon/authenticated by default; revoke it so they
-- can't be called directly through PostgREST with a user's JWT.
REVOKE EXECUTE ON FUNCTION public.submit_task_log(JSONB) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.correct_task_log(UUID, UUID, JSONB, validation_status, TEXT[], TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.void_task_log(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.lock_log_root(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_set(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.dashboard_snapshot(INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_available_at(UUID, TIMESTAMPTZ, UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_pest_alert(UUID, TEXT, TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_over_harvest_alert(UUID, BOOLEAN, TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.manager_set_failed(UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;
