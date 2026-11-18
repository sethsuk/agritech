-- Security hardening (018): pinned search paths, no anon access to helpers, RLS only for
-- signed-in users. Catches a future function/policy that quietly regresses any of these.
DO $$
DECLARE bad text;
BEGIN
  SELECT string_agg(p.proname, ', ') INTO bad
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.prokind = 'f'
    AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
    AND NOT EXISTS (SELECT 1 FROM unnest(COALESCE(p.proconfig, '{}')) c WHERE c LIKE 'search_path=%');
  ASSERT bad IS NULL, 'functions without a pinned search_path: ' || bad;

  ASSERT NOT has_function_privilege('anon', 'public.is_manager()', 'EXECUTE'), 'anon can call is_manager';
  ASSERT NOT has_function_privilege('anon', 'public.is_owner()', 'EXECUTE'), 'anon can call is_owner';
  ASSERT NOT has_function_privilege('anon', 'public.is_worker()', 'EXECUTE'), 'anon can call is_worker';
  ASSERT NOT has_function_privilege('anon', 'public.current_user_role()', 'EXECUTE'), 'anon can call current_user_role';
  ASSERT has_function_privilege('authenticated', 'public.is_manager()', 'EXECUTE'), 'RLS needs authenticated to call is_manager';
  ASSERT NOT has_function_privilege('authenticated', 'public.worker_zones(uuid)', 'EXECUTE'), 'signed-in users can call worker_zones';
  ASSERT NOT has_function_privilege('anon', 'public.worker_zones(uuid)', 'EXECUTE'), 'anon can call worker_zones';

  -- Every write RPC stays server-only.
  ASSERT NOT has_function_privilege('authenticated', 'public.submit_task_log(jsonb)', 'EXECUTE'), 'submit_task_log is callable by users';
  ASSERT NOT has_function_privilege('anon', 'public.dashboard_snapshot(integer)', 'EXECUTE'), 'dashboard_snapshot is callable by anon';

  ASSERT NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND roles = '{public}'),
    'a policy still applies to PUBLIC (should be TO authenticated)';
END $$;
