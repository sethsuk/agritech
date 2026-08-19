-- Worker-initiated edits/deletes of a task_log are never UPDATEs or DELETEs on the
-- original row — task_logs stays append-only (see 006_task_logs.sql). A worker
-- "editing" or "deleting" a submitted record instead inserts a new row that
-- references the log it amends, so the original is preserved forever.
--
-- correction_of_log_id always points at the ROOT log_id (never at another
-- correction/void row), so the full history of one submitted record is always
-- `log_id = :root OR correction_of_log_id = :root` — one query, no recursion.
ALTER TABLE public.task_logs
  ADD COLUMN correction_of_log_id UUID REFERENCES public.task_logs(log_id),
  ADD COLUMN correction_type TEXT,
  ADD COLUMN correction_reason TEXT;

ALTER TABLE public.task_logs
  ADD CONSTRAINT task_logs_correction_type_valid
  CHECK (correction_type IS NULL OR correction_type IN ('correction', 'void'));

ALTER TABLE public.task_logs
  ADD CONSTRAINT task_logs_correction_type_requires_parent
  CHECK (correction_type IS NULL OR correction_of_log_id IS NOT NULL);

CREATE INDEX idx_task_logs_correction_of ON public.task_logs(correction_of_log_id)
  WHERE correction_of_log_id IS NOT NULL;
