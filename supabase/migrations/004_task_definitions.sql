CREATE TABLE public.task_definitions (
  task_def_id TEXT PRIMARY KEY,       -- e.g. 'fertilizer_application_v1'
  task_type TEXT NOT NULL,            -- 'fertilizer', 'pest_inspection', etc.

  -- One column per supported language. The set of languages is fixed in code
  -- (lib/i18n/t.ts `Lang`), so a JSONB blob bought no real flexibility while
  -- costing NOT NULL enforcement and key-typo protection.
  display_name_th TEXT NOT NULL,
  display_name_my TEXT NOT NULL,
  display_name_en TEXT NOT NULL,
  icon TEXT,

  photo_policy_mode photo_policy_mode NOT NULL,
  -- NOTE: audit sampling rates are deployment config, not domain data — they live
  -- in env (PHOTO_AUDIT_RATE_TRUSTED / _STANDARD / _AUDIT), read by /api/start-log.

  requires_qr_scan BOOLEAN NOT NULL DEFAULT TRUE,
  min_completion_seconds INTEGER NOT NULL DEFAULT 10,
  min_qr_to_submit_seconds INTEGER NOT NULL DEFAULT 15,

  -- Stays JSONB deliberately: every task type has a structurally different set of
  -- fields (watering has duration, harvest has per-grade counts, pest has severity),
  -- so there is no fixed column shape to model. This is a form schema, not a record.
  fields JSONB NOT NULL,

  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_task_definitions_active ON public.task_definitions(active) WHERE active = TRUE;
CREATE INDEX idx_task_definitions_type ON public.task_definitions(task_type);
