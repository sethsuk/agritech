CREATE TABLE public.protocols (
  protocol_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_subtype TEXT NOT NULL,
  response_task_def_id TEXT NOT NULL REFERENCES public.task_definitions(task_def_id),
  description JSONB NOT NULL,         -- {th, en}
  active BOOLEAN NOT NULL DEFAULT TRUE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_active_protocol_per_subtype
    UNIQUE (alert_subtype, active)
    DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX idx_protocols_subtype ON public.protocols(alert_subtype) WHERE active = TRUE;
