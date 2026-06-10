CREATE TABLE public.assignments (
  assignment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES public.workers(worker_id),
  tree_id TEXT NOT NULL REFERENCES public.trees(tree_id),
  task_def_id TEXT NOT NULL REFERENCES public.task_definitions(task_def_id),

  scheduled_for DATE NOT NULL,
  priority assignment_priority NOT NULL DEFAULT 'normal',
  source assignment_source NOT NULL,
  triggered_by_alert_id UUID,         -- FK added after alerts table created

  status assignment_status NOT NULL DEFAULT 'pending',
  completed_log_id UUID,              -- FK added after task_logs table created

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_assignments_worker_date ON public.assignments(worker_id, scheduled_for);
CREATE INDEX idx_assignments_status ON public.assignments(status);
CREATE INDEX idx_assignments_tree ON public.assignments(tree_id);
