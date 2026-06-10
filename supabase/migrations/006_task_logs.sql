-- The source of truth. Append-only — no UPDATEs or DELETEs except by service role.
CREATE TABLE public.task_logs (
  log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tree_id TEXT NOT NULL REFERENCES public.trees(tree_id),
  task_def_id TEXT NOT NULL REFERENCES public.task_definitions(task_def_id),
  task_type TEXT NOT NULL,            -- Denormalized for fast filtering
  assignment_id UUID REFERENCES public.assignments(assignment_id),

  worker_id UUID NOT NULL REFERENCES public.workers(worker_id),
  submitted_at TIMESTAMPTZ NOT NULL,
  form_opened_at TIMESTAMPTZ NOT NULL,

  -- Presence
  qr_scanned_at TIMESTAMPTZ NOT NULL,
  qr_value TEXT NOT NULL,
  gps_lat NUMERIC(10,7),
  gps_long NUMERIC(10,7),
  gps_delta_meters NUMERIC(8,2),

  -- Form data (shape varies by task_def)
  form_data JSONB NOT NULL,

  -- Photo requirement (decided server-side at form-open time)
  photo_required BOOLEAN NOT NULL,
  photo_requirement_reason photo_requirement_reason NOT NULL,
  photo_audit_selection_seed TEXT,

  -- Photo (NULL if not required or not submitted)
  photo_url TEXT,

  -- Validation
  validation_status validation_status NOT NULL,
  validation_flags TEXT[] NOT NULL DEFAULT '{}',

  -- Notes
  notes_text TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_task_logs_tree_submitted ON public.task_logs(tree_id, submitted_at DESC);
CREATE INDEX idx_task_logs_worker_submitted ON public.task_logs(worker_id, submitted_at DESC);
CREATE INDEX idx_task_logs_task_type ON public.task_logs(task_type);
CREATE INDEX idx_task_logs_validation ON public.task_logs(validation_status) WHERE validation_status != 'passed';
CREATE INDEX idx_task_logs_submitted_at ON public.task_logs(submitted_at DESC);

-- Wire up deferred FK on assignments
ALTER TABLE public.assignments
  ADD CONSTRAINT fk_assignments_completed_log
  FOREIGN KEY (completed_log_id) REFERENCES public.task_logs(log_id);
