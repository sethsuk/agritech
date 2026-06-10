# Worker & Manager Account Setup

Workers and the manager are created manually in Supabase Auth, then their UUIDs are inserted into `public.users` and `public.workers`.

## Step 1 — Create accounts in Supabase Auth

Go to **Supabase Dashboard → Authentication → Users → Add user** for each person.

| Person | Email | Password | Role |
|:---|:---|:---|:---|
| Manager (K. Nong) | `manager@farm.local` | (set a strong password) | manager |
| Worker 1 | `worker1@farm.local` | (4-digit PIN) | worker |
| Worker 2 | `worker2@farm.local` | (4-digit PIN) | worker |
| Worker 3 | `worker3@farm.local` | (4-digit PIN) | worker |

> **Tip:** Disable email confirmation in Supabase Auth settings (Authentication → Email → Confirm email → OFF) so workers don't need to click a link.

## Step 2 — Copy the UUIDs

After creating each account, copy the UUID from the Users table.

## Step 3 — Insert profiles

Run this SQL in the **Supabase SQL editor**, replacing the UUIDs:

```sql
-- Replace each <uuid-N> with the actual UUID from Supabase Auth
INSERT INTO public.users (id, role, display_name) VALUES
  ('<manager-uuid>', 'manager', 'K. Nong'),
  ('<worker1-uuid>', 'worker',  'U Aung'),
  ('<worker2-uuid>', 'worker',  'Daw Khin'),
  ('<worker3-uuid>', 'worker',  'U Min');

INSERT INTO public.workers (worker_id, language, assigned_zones, trust_tier) VALUES
  ('<worker1-uuid>', 'my', ARRAY['North-A', 'North-B'], 'audit'),
  ('<worker2-uuid>', 'my', ARRAY['South-A'],            'audit'),
  ('<worker3-uuid>', 'my', ARRAY['South-B'],            'audit');
```

## Step 4 — Verify

```sql
SELECT u.display_name, u.role, w.assigned_zones, w.trust_tier
FROM public.users u
LEFT JOIN public.workers w ON w.worker_id = u.id;
```
