-- When a tree's coordinates were captured on site (new-tree form or "re-capture location").
-- NULL means the coordinates are the seed's placeholder grid, not where the tree really
-- stands: the GPS presence check is skipped for that tree (no gps_off_tree fraud alert,
-- no gps_missing flag) until someone captures its real location. Additive and re-runnable;
-- existing trees stay NULL on purpose — none of them has been located yet.
ALTER TABLE public.trees ADD COLUMN IF NOT EXISTS location_set_at TIMESTAMPTZ;
