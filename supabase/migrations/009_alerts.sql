CREATE TABLE public.alerts (
  alert_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier alert_tier NOT NULL,
  category alert_category NOT NULL,
  subtype TEXT NOT NULL,

  tree_id TEXT REFERENCES public.trees(tree_id),
  worker_id UUID REFERENCES public.workers(worker_id),
  triggered_by_log_id UUID REFERENCES public.task_logs(log_id),

  status alert_status NOT NULL DEFAULT 'open',

  -- Resolution as columns rather than a JSONB blob: the shape is fixed, and
  -- resolved_by is a real FK to the staff member who closed the alert.
  resolution_action_taken TEXT,
  resolution_resolved_by UUID REFERENCES public.users(id),
  resolution_resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,

  suggested_response_task_def_id TEXT REFERENCES public.task_definitions(task_def_id),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_alerts_open ON public.alerts(tier, created_at DESC) WHERE status = 'open';
CREATE INDEX idx_alerts_tree ON public.alerts(tree_id) WHERE status = 'open';
CREATE INDEX idx_alerts_worker ON public.alerts(worker_id) WHERE status = 'open';

-- Wire up deferred FK on assignments
ALTER TABLE public.assignments
  ADD CONSTRAINT fk_assignments_alert
  FOREIGN KEY (triggered_by_alert_id) REFERENCES public.alerts(alert_id);
