-- Helper functions
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS user_role AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_worker()
RETURNS BOOLEAN AS $$
  SELECT public.current_user_role() = 'worker';
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_manager()
RETURNS BOOLEAN AS $$
  SELECT public.current_user_role() = 'manager';
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS BOOLEAN AS $$
  SELECT public.current_user_role() = 'owner';
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.worker_zones(worker_uuid UUID)
RETURNS TEXT[] AS $$
  SELECT assigned_zones FROM public.workers WHERE worker_id = worker_uuid;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY users_read_own ON public.users FOR SELECT USING (id = auth.uid());
CREATE POLICY users_read_all_for_staff ON public.users FOR SELECT USING (public.is_manager() OR public.is_owner());

-- workers
ALTER TABLE public.workers ENABLE ROW LEVEL SECURITY;
CREATE POLICY workers_read_own ON public.workers FOR SELECT USING (worker_id = auth.uid());
CREATE POLICY workers_read_all_for_staff ON public.workers FOR SELECT USING (public.is_manager() OR public.is_owner());
CREATE POLICY workers_update_by_manager ON public.workers FOR UPDATE USING (public.is_manager());

-- trees: workers read trees in assigned zones; managers/owners read all
ALTER TABLE public.trees ENABLE ROW LEVEL SECURITY;
CREATE POLICY trees_read_for_workers ON public.trees FOR SELECT
  USING (public.is_worker() AND zone = ANY(public.worker_zones(auth.uid())));
CREATE POLICY trees_read_for_staff ON public.trees FOR SELECT
  USING (public.is_manager() OR public.is_owner());
CREATE POLICY trees_write_by_manager ON public.trees FOR ALL
  USING (public.is_manager() OR public.is_owner());

-- task_definitions: everyone reads active ones; only managers write
ALTER TABLE public.task_definitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY task_defs_read ON public.task_definitions FOR SELECT
  USING (active = TRUE OR public.is_manager() OR public.is_owner());
CREATE POLICY task_defs_write_by_manager ON public.task_definitions FOR ALL USING (public.is_manager());

-- assignments: workers read own; managers/owners read all; managers write
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY assignments_read_own ON public.assignments FOR SELECT USING (worker_id = auth.uid());
CREATE POLICY assignments_read_all_for_staff ON public.assignments FOR SELECT
  USING (public.is_manager() OR public.is_owner());
CREATE POLICY assignments_write_by_manager ON public.assignments FOR ALL USING (public.is_manager());

-- task_logs: workers read own; managers/owners read all; INSERTs via service role only
ALTER TABLE public.task_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY task_logs_read_own ON public.task_logs FOR SELECT USING (worker_id = auth.uid());
CREATE POLICY task_logs_read_all_for_staff ON public.task_logs FOR SELECT
  USING (public.is_manager() OR public.is_owner());

-- sets: workers read sets on accessible trees; managers/owners read all
ALTER TABLE public.sets ENABLE ROW LEVEL SECURITY;
CREATE POLICY sets_read_for_workers ON public.sets FOR SELECT
  USING (
    public.is_worker() AND
    tree_id IN (SELECT tree_id FROM public.trees WHERE zone = ANY(public.worker_zones(auth.uid())))
  );
CREATE POLICY sets_read_all_for_staff ON public.sets FOR SELECT
  USING (public.is_manager() OR public.is_owner());

-- set_events: same visibility as the parent set; INSERTs via service role only
ALTER TABLE public.set_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY set_events_read_for_workers ON public.set_events FOR SELECT
  USING (
    public.is_worker() AND
    set_id IN (
      SELECT set_id FROM public.sets
      WHERE tree_id IN (SELECT tree_id FROM public.trees WHERE zone = ANY(public.worker_zones(auth.uid())))
    )
  );
CREATE POLICY set_events_read_all_for_staff ON public.set_events FOR SELECT
  USING (public.is_manager() OR public.is_owner());

-- alerts: managers/owners read; managers update
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY alerts_read_for_staff ON public.alerts FOR SELECT
  USING (public.is_manager() OR public.is_owner());
CREATE POLICY alerts_update_by_manager ON public.alerts FOR UPDATE USING (public.is_manager());
