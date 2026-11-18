-- Idempotent submissions. Each opened form gets a random submission id inside its signed
-- token (lib/logToken.ts). submit_task_log stores it and, if the same id arrives again —
-- a retry after the response was lost on a patchy farm signal — returns the original log
-- instead of inserting a duplicate (a duplicated harvest would double-count fruit and
-- could wrongly close the set). Corrections and voids leave it NULL.
--
-- Additive and re-runnable: safe on a database that already has data.
ALTER TABLE public.task_logs ADD COLUMN IF NOT EXISTS submission_id UUID;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_task_logs_submission
  ON public.task_logs(submission_id) WHERE submission_id IS NOT NULL;
