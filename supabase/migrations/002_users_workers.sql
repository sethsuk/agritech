-- Public user profile (extends auth.users)
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_role ON public.users(role);

-- Workers (extends public.users)
CREATE TABLE public.workers (
  worker_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  language worker_language NOT NULL DEFAULT 'th',
  assigned_zones TEXT[] NOT NULL DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT TRUE,

  -- Reliability stats are NOT stored: they're computed live by the worker_stats view
  -- (013_views.sql). They used to be columns "recomputed by background job" that was
  -- never written, so every worker read 0 logs.
  trust_tier worker_trust_tier NOT NULL DEFAULT 'audit',
  trust_tier_set_by TEXT NOT NULL DEFAULT 'system_default',
  trust_tier_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_workers_active ON public.workers(active) WHERE active = TRUE;
CREATE INDEX idx_workers_trust_tier ON public.workers(trust_tier);
