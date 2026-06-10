CREATE TABLE public.task_definitions (
  task_def_id TEXT PRIMARY KEY,       -- e.g. 'fertilizer_application_v1'
  task_type TEXT NOT NULL,            -- 'fertilizer', 'pest_inspection', etc.

  display_name JSONB NOT NULL,        -- {th, my, en, icon}

  photo_policy_mode photo_policy_mode NOT NULL,
  photo_policy_audit_rates JSONB,     -- {trusted, standard, audit} — NULL if mode != 'audit_only'

  requires_qr_scan BOOLEAN NOT NULL DEFAULT TRUE,
  min_completion_seconds INTEGER NOT NULL DEFAULT 10,
  min_qr_to_submit_seconds INTEGER NOT NULL DEFAULT 15,

  fields JSONB NOT NULL,              -- Array of field objects

  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_task_definitions_active ON public.task_definitions(active) WHERE active = TRUE;
CREATE INDEX idx_task_definitions_type ON public.task_definitions(task_type);
