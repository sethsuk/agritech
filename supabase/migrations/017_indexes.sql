-- Indexes for the per-row lookups left once the rollups removed the full scans: recent
-- logs, last log per tree/worker, a set's logs, the latest correction of a record, and the
-- alert queries (by source log, open per tree, listing by status). Re-runnable.
CREATE INDEX IF NOT EXISTS idx_task_logs_roots_recent
  ON public.task_logs(submitted_at DESC) WHERE correction_of_log_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_task_logs_roots_tree
  ON public.task_logs(tree_id, submitted_at DESC) WHERE correction_of_log_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_task_logs_roots_worker
  ON public.task_logs(worker_id, submitted_at DESC) WHERE correction_of_log_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_task_logs_roots_set
  ON public.task_logs(set_id, task_type, submitted_at) WHERE correction_of_log_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_task_logs_latest_correction
  ON public.task_logs(correction_of_log_id, submitted_at DESC) WHERE correction_type = 'correction';
CREATE INDEX IF NOT EXISTS idx_alerts_source_log ON public.alerts(triggered_by_log_id);
CREATE INDEX IF NOT EXISTS idx_alerts_active_tree ON public.alerts(tree_id) WHERE status IN ('open', 'reviewed');
CREATE INDEX IF NOT EXISTS idx_alerts_status_created ON public.alerts(status, created_at DESC);
