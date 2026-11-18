CREATE TABLE public.trees (
  tree_id TEXT PRIMARY KEY,           -- e.g. 'AL13-7'
  qr_code TEXT NOT NULL UNIQUE,       -- e.g. 'QR_AL13-7_v1'

  lat NUMERIC(10,7) NOT NULL,
  long NUMERIC(10,7) NOT NULL,
  zone TEXT NOT NULL,                 -- zone letter, e.g. 'A'
  side TEXT NOT NULL CHECK (side IN ('L', 'R')),
  row_num INTEGER NOT NULL,
  position INTEGER NOT NULL,

  planted_date DATE NOT NULL,
  variety TEXT NOT NULL,
  status tree_status NOT NULL DEFAULT 'active',
  retired_date DATE,

  -- No cached derived_* columns: last log, open alerts and open sets are computed live
  -- by the tree_status view (013_views.sql). Cached copies had no reliable writer.

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_trees_zone ON public.trees(zone);
CREATE INDEX idx_trees_zone_side ON public.trees(zone, side);
CREATE INDEX idx_trees_status ON public.trees(status) WHERE status = 'active';
CREATE INDEX idx_trees_location ON public.trees(lat, long);
CREATE INDEX idx_trees_qr_code ON public.trees(qr_code);
