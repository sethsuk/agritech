-- Managers and owners can both create/edit/retire trees (matches every other manager-facing
-- write policy, which already allows both roles).
DROP POLICY IF EXISTS trees_write_by_manager ON public.trees;
CREATE POLICY trees_write_by_manager ON public.trees FOR ALL
  USING (public.is_manager() OR public.is_owner());
