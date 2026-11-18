-- A set is one bloom wave on one tree, identified in the field by a ribbon colour.
--
-- This table holds only the set's *identity and lifecycle dates*. Every count (flowers
-- at bloom, latest fruit count, harvested, remaining, lost) is derived from the logs
-- that reference the set — see the set_state view in 013_views.sql. Storing counts here
-- previously meant a correction or void of a bloom/harvest log silently left the set
-- with stale numbers; deriving them makes corrections flow through automatically.
--
-- Identity used to be tree + colour + *calendar year*, which broke every December bloom
-- (harvested the following April under a different year, so the harvest never found its
-- set) and let a second same-colour bloom overwrite the first. Now a set has a UUID, and
-- a partial unique index allows at most one OPEN set per ribbon colour per tree.
CREATE TABLE public.sets (
  set_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tree_id TEXT NOT NULL REFERENCES public.trees(tree_id),
  color generation_color NOT NULL,

  bloom_log_id UUID NOT NULL UNIQUE REFERENCES public.task_logs(log_id),
  bloom_date DATE NOT NULL,                 -- Bangkok calendar date
  estimated_maturation_days INTEGER NOT NULL,
  harvest_window_start DATE NOT NULL,
  harvest_window_end DATE NOT NULL,

  -- Maintained only by sync_set() (014_functions.sql), except close_reason = 'failed',
  -- which a manager sets by hand and sync_set never overrides.
  closed_at TIMESTAMPTZ,
  close_reason set_close_reason,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT sets_closed_has_reason CHECK ((closed_at IS NULL) = (close_reason IS NULL))
);

CREATE UNIQUE INDEX uniq_open_set_per_tree_color
  ON public.sets(tree_id, color) WHERE closed_at IS NULL;
CREATE INDEX idx_sets_tree ON public.sets(tree_id);
CREATE INDEX idx_sets_open_window ON public.sets(harvest_window_end) WHERE closed_at IS NULL;

-- Fruit-count checks and harvests point at the set they were logged against. A real
-- column (not a form_data key) so it's a genuine FK and can't be retargeted by a
-- correction. task_logs is created before sets, hence the deferred ALTER.
ALTER TABLE public.task_logs ADD COLUMN set_id UUID REFERENCES public.sets(set_id);
CREATE INDEX idx_task_logs_set ON public.task_logs(set_id) WHERE set_id IS NOT NULL;
