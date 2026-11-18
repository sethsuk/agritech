-- Security hardening from Supabase's security advisor (run on production, Nov 2026).
-- Additive and re-runnable; it also runs AFTER 014/016 on every `db:migrate`, which matters
-- because CREATE OR REPLACE FUNCTION resets a function's settings — so this re-pins them.
--
-- 1. FUNCTION SEARCH PATH. A function without a pinned search_path resolves unqualified
--    names through the caller's search_path, so someone who can create objects in a schema
--    earlier on that path could shadow a function or table it uses. Every function in
--    `public` gets `search_path = public, pg_temp` (pg_temp last, so temp objects can't
--    shadow real ones). Generic loop: any function added later is covered automatically.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
      AND NOT EXISTS (SELECT 1 FROM unnest(COALESCE(p.proconfig, '{}')) c WHERE c LIKE 'search_path=%')
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', r.sig);
  END LOOP;
END $$;

-- 2. RLS POLICIES ARE FOR SIGNED-IN USERS ONLY. The policies in 011 had no TO clause, so
--    they applied to PUBLIC — including `anon` (visitors who aren't signed in) — which is
--    why the RLS helper functions had to be executable by anon. Restrict every policy that
--    applies to PUBLIC to `authenticated`; anon then matches no policy (sees nothing).
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname FROM pg_policies
    WHERE schemaname = 'public' AND roles = '{public}'
  LOOP
    EXECUTE format('ALTER POLICY %I ON %I.%I TO authenticated', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- 3. HELPER FUNCTIONS. The five SECURITY DEFINER helpers (they run with the owner's rights)
--    were callable by anyone through /rest/v1/rpc/…, signed in or not. Anon no longer needs
--    them (see 2). `authenticated` keeps the four that RLS policies call — a policy runs
--    with the querying user's privileges. worker_zones(uuid) is used by no active policy
--    (only a commented-out one) and let any signed-in user look up any worker's zones, so
--    nobody but the server (service role) may call it.
REVOKE EXECUTE ON FUNCTION public.current_user_role() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_worker()         FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_manager()        FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_owner()          FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.worker_zones(UUID)  FROM PUBLIC, anon, authenticated;
