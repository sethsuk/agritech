CREATE TABLE public.sets (
  set_id TEXT PRIMARY KEY,            -- e.g. 'set_al137_2026_red'
  tree_id TEXT NOT NULL REFERENCES public.trees(tree_id),
  color generation_color NOT NULL,
  season TEXT NOT NULL,               -- e.g. '2026-main'

  bloom_log_id UUID NOT NULL REFERENCES public.task_logs(log_id),
  bloom_date DATE NOT NULL,
  estimated_maturation_days INTEGER NOT NULL DEFAULT 120,
  harvest_window_start DATE NOT NULL,
  harvest_window_end DATE NOT NULL,

  -- Fruit counts (count-level only; individual fruit tracking deferred)
  initial_fruit_count INTEGER NOT NULL DEFAULT 0,
  current_fruit_count INTEGER NOT NULL DEFAULT 0,
  premium_fruit_count INTEGER NOT NULL DEFAULT 0,

  status set_status NOT NULL DEFAULT 'flowering',
  harvest_log_ids UUID[] NOT NULL DEFAULT '{}',
  harvested_at TIMESTAMPTZ,

  -- Event timeline lives in public.set_events (see 008), not a JSONB array here.

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Same color cannot be active twice on one tree in one season
  CONSTRAINT unique_active_set_per_tree_color_season
    UNIQUE (tree_id, color, season)
);

CREATE INDEX idx_sets_tree ON public.sets(tree_id);
CREATE INDEX idx_sets_status ON public.sets(status);
CREATE INDEX idx_sets_harvest_window ON public.sets(harvest_window_start, harvest_window_end);
