-- Explicit left/right side within a zone, e.g. tree "AL13-7" = zone A, side L, row 13, column 7.
-- Default backfills existing rows so this is safe to run against a populated table; the dummy
-- seed data is expected to be wiped and regenerated separately (see supabase/seed/02_trees.ts).
ALTER TABLE public.trees ADD COLUMN side TEXT NOT NULL DEFAULT 'L' CHECK (side IN ('L', 'R'));
ALTER TABLE public.trees ALTER COLUMN side DROP DEFAULT;

CREATE INDEX idx_trees_zone_side ON public.trees(zone, side);
