-- Loaded before every SQL test, inside the same rolled-back transaction.
-- Fixtures: a throwaway tree 'ZQ1-1' and helpers to submit/correct/void logs at
-- controlled times (now() is frozen inside a transaction, so tests pass explicit offsets).

INSERT INTO public.trees (tree_id, qr_code, lat, long, zone, side, row_num, position, planted_date, variety)
VALUES ('ZQ1-1', 'QR_ZQ1-1_v1', 18.75, 98.95, 'Z', 'L', 1, 1, '2020-01-01', 'Monthong');

CREATE FUNCTION pg_temp.worker() RETURNS uuid LANGUAGE sql AS
$$ SELECT worker_id FROM public.workers ORDER BY created_at LIMIT 1 $$;

-- Submit a log on ZQ1-1 `secs` seconds after the transaction's now().
CREATE FUNCTION pg_temp.submit(task_def text, task_type text, form jsonb, secs int, submission uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql AS $$
  SELECT public.submit_task_log(jsonb_build_object(
    'tree_id', 'ZQ1-1', 'task_def_id', task_def, 'task_type', task_type,
    'worker_id', pg_temp.worker(), 'submission_id', submission,
    'submitted_at', now() + make_interval(secs => secs), 'form_opened_at', now(),
    'qr_scanned_at', now(), 'qr_value', 'QR_ZQ1-1_v1',
    'validation_status', 'passed', 'validation_flags', '[]'::jsonb, 'form_data', form))
$$;

CREATE FUNCTION pg_temp.correct(log_id uuid, form jsonb) RETURNS jsonb LANGUAGE sql AS
$$ SELECT public.correct_task_log(log_id, pg_temp.worker(), form, 'passed', '{}', 'sql test') $$;

CREATE FUNCTION pg_temp.void(log_id uuid) RETURNS jsonb LANGUAGE sql AS
$$ SELECT public.void_task_log(log_id, pg_temp.worker(), 'sql test') $$;

CREATE FUNCTION pg_temp.set_row(set_id uuid) RETURNS public.set_state LANGUAGE sql AS
$$ SELECT * FROM public.set_state WHERE set_state.set_id = set_row.set_id $$;

CREATE FUNCTION pg_temp.open_alerts(subtype text) RETURNS int LANGUAGE sql AS
$$ SELECT count(*)::int FROM public.alerts WHERE tree_id = 'ZQ1-1' AND alerts.subtype = open_alerts.subtype AND status IN ('open','reviewed') $$;
