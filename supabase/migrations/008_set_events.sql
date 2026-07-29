-- Per-set event timeline: bloom, thinning, natural drop, harvest, …
--
-- Previously a denormalized `sets.history` JSONB array. As a real table the
-- referenced log is a genuine FK, events are queryable/aggregatable with plain SQL,
-- and there's no risk of the array being double-JSON-encoded on write.
CREATE TABLE public.set_events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id TEXT NOT NULL REFERENCES public.sets(set_id) ON DELETE CASCADE,

  event_date DATE NOT NULL,
  event_type TEXT NOT NULL,           -- 'bloom' | 'thinning' | 'natural_drop' | 'harvest'
  fruit_count INTEGER NOT NULL,
  log_id UUID NOT NULL REFERENCES public.task_logs(log_id),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_set_events_set_date ON public.set_events(set_id, event_date);
CREATE INDEX idx_set_events_log ON public.set_events(log_id);
