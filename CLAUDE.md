# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Mobile-first Next.js app for a Thai durian farm (ระบบบริหารสวนทุเรียน). Workers scan a QR code on a
tree and fill out task forms (watering, fertiliser, pest inspection, bloom logging, harvest).
Managers see a dashboard with alerts, worker reliability metrics, and tree health. UI strings are
mostly Thai; data model and code are English.

## Commands

```bash
npm run dev             # http://localhost:3000
npm run dev:test        # dev server with SKIP_VALIDATION=true (bypasses GPS/QR/timing checks)
npm run dev:https       # self-signed HTTPS — needed to test camera/QR scan on a phone
npm run build
npm run lint

npm run db:migrate      # runs supabase/migrations/*.sql in order via scripts/migrate.ts, then seeds task_definitions
npm run db:seed:trees   # inserts 1035 trees in zone A (AL1-1…AL23-23, AR1-1…AR22-23)
tsx scripts/seed-users.ts   # creates/repairs the 4 dummy accounts (1 manager, 3 workers)
npm run setup:storage   # creates the `task-photos` Supabase Storage bucket
```

There is no test suite. `db:migrate` connects directly via `DATABASE_URL` (pg) and is re-runnable —
it skips statements that fail with "already exists". `db:push` / `db:reset` (Supabase CLI) exist as
package.json scripts but the project's actual workflow is the custom `scripts/migrate.ts` runner.

Because migrations are skipped once their objects exist, **editing an existing migration file has no
effect on an already-migrated DB** — during development the workflow is to drop the app's tables,
types and helper functions, then re-run `db:migrate` + both seeds. `seed-users.ts` is idempotent and
handles the fact that `auth.users` survives a public-schema wipe: it looks up the existing auth user
by email and re-upserts its `public.users`/`public.workers` rows.

`scripts/*.ts` are standalone Node scripts (not Next.js runtime), so they must polyfill
`globalThis.WebSocket` with `ws` before constructing a Supabase client — supabase-js builds a
RealtimeClient eagerly and Node < 22 has no native WebSocket. The app itself doesn't need this.

Dummy logins (after seeding): `manager@farm.local` / `manager1234`, `worker1@farm.local` / `1111`
(and worker2/2222, worker3/3333). Root `/` redirects by role: workers → `/scan`, managers/owners →
`/dashboard`.

## Architecture

### Schema

- `supabase/migrations/*.sql` + `types/database.ts` (hand-written) are the **actual, live schema**.
  Tables: `users`, `workers`, `trees`, `task_definitions`, `assignments`, `task_logs`, `sets`,
  `set_events`, `alerts`.
- `docs/PLAN.md` describes an **earlier iteration** of the data model (and `prisma/schema.prisma`,
  now deleted, described the same dead design). Don't use it as a reference for the current schema.
- `docs/durian_build_spec.md`, `docs/durian_schema.md`, and `docs/durian_system_docs.md` document the
  current (post-pivot) design in depth — fraud detection layers, alert tiers, trust tiers, photo
  audit policy. Read these for *why* a table/column exists, not just what it contains. Note these
  predate the JSONB→columns pass below, so their example rows show some fields as JSON blobs that
  are now real columns.

### JSONB policy — fixed shape means columns

Only two JSONB columns remain, and both are genuinely polymorphic:
`task_definitions.fields` (a form *schema*; every task type has structurally different inputs) and
`task_logs.form_data` (the matching submitted values). Everything with a fixed shape is a real
column — `display_name_th/_my/_en` + `icon` on `task_definitions`, `resolution_*` on `alerts` — which
buys `NOT NULL` enforcement, real FKs (`alerts.resolution_resolved_by` → `users.id`), and no
key-typo class of bug. Per-set event history is the `set_events` table, not an array.
**When adding a column, default to a real column; reach for JSONB only if the shape genuinely
varies per row.**

Note `I18nString` (`{th, my, en}`) still exists for translated text *inside* `fields` — task field
labels and option labels — resolved by `t()`. Table columns use `taskDisplayName()` instead.
Adding a 4th language is a code change either way (`Lang` in `lib/i18n/t.ts` is a closed union),
so JSONB bought no real flexibility there.

### Auth & role routing

Three roles: `worker`, `manager`, `owner` (stored in `users.role`). Auth is Supabase Auth
(email/password, email confirmation off since workers have no email access).

- `middleware.ts` only enforces "is there a logged-in user" and redirects anonymous requests to
  `/login` (except `/login`, `/auth`, and any `/api` path).
- Role-based routing happens **per-layout**, not in middleware: `app/(worker)/layout.tsx` and
  `app/(manager)/layout.tsx` each independently fetch the user's role via the admin client and
  redirect mismatches (`/dashboard` ↔ `/scan`). `app/page.tsx` does the same role lookup to decide
  the root redirect. If you add a new top-level route, give it a role check too — there's no shared
  guard.
- Two Supabase server clients exist in `lib/supabase/`: `server.ts` (`createClient`, cookie-bound,
  respects RLS, used to read `auth.getUser()`) and `admin.ts` (`createAdminClient`, service-role,
  bypasses RLS). The established pattern in every API route and server layout is: use the cookie
  client only to get `user`, then use the admin client for all actual data access plus a manual role
  check in TypeScript. RLS policies (`supabase/migrations/011_rls_policies.sql`) exist as
  defense-in-depth, not as the primary authorization mechanism.
- Never import `lib/supabase/admin.ts` into a client component — it holds the service-role key.

### Worker submission flow — `start-log` / `submit-log`

This is the core domain flow and spans several files:

1. Worker scans a QR (`components/QrScanner.tsx` / `html5-qrcode`) or types a tree ID, landing on
   `/tree/[treeId]`, then opens a task at `/tree/[treeId]/task/[taskDefId]`.
2. Opening the form calls `POST /api/start-log` (`app/api/start-log/route.ts`). The server decides
   `photoRequired` right then (based on `task_definitions.photo_policy_mode`: `always` vs.
   `audit_only`, where the random-sample rate comes from the worker's `trust_tier` and the
   `PHOTO_AUDIT_RATE_TRUSTED` / `_STANDARD` / `_AUDIT` env vars — deployment config, not DB data)
   and returns a signed token (`lib/logToken.ts`, HMAC-SHA256 keyed off a slice of
   `SUPABASE_SERVICE_ROLE_KEY`). This token — not client state — is the source of truth for whether
   a photo is required, so a worker can't skip the photo by tampering with the client.
3. The form itself is schema-driven: `task_definitions.fields` is a JSON array of `TaskField`
   (`types/database.ts`), rendered generically by `components/worker/TaskFormRenderer.tsx` which
   dispatches per `field.type` (`numeric_counter`/`slider`, `dropdown`, `color_picker`,
   `severity_picker`, `grade_counter`) to the matching `components/worker/*` widget. Adding a new
   field type means adding a case here *and* a widget *and* (if it needs bounds checking) a case in
   `lib/validation/bounds.ts`.
4. Submitting calls `POST /api/submit-log` (`app/api/submit-log/route.ts`), which: verifies the
   token, enforces the server's earlier photo decision, runs `lib/validation/index.ts` (presence →
   GPS/QR match, timing → too-fast submission, bounds → hard min/max reject + soft warn flags),
   inserts the `task_logs` row (append-only, service role only — RLS has no insert policy for
   regular users), then fires `handleSideEffects` *without awaiting it in the response path*
   (bloom log → upsert a `sets` row + insert a `set_events` row; harvest → mark the set harvested +
   insert a `set_events` row; moderate/severe pest severity → create an `alerts` row; fraud-flagged
   validation → create an `alerts` row; always bump the tree's `derived_*` columns). Side effects
   are deliberately fire-and-forget — don't make them blocking without a reason.
5. `SKIP_VALIDATION=true` (env var, also toggled by `npm run dev:test`) short-circuits both the
   photo-requirement roll in `start-log` and all checks in `lib/validation/index.ts` to `passed`.
   Useful for local iteration; never set in production.

### Validation engine (`lib/validation/`)

`validate()` in `index.ts` composes independent checks and returns `{ status, flags,
gpsDistanceMeters, rejectionReason? }`:
- `presence.ts` — QR value must match `tree.qr_code`; GPS distance (haversine) vs.
  `GPS_TOLERANCE_METERS` (default 15m) → `qr_mismatch` / `gps_missing` / `gps_off_tree` flags.
- `timing.ts` — completion time and QR-to-submit time below `task_definitions.min_*_seconds` →
  `completion_too_fast` / `qr_to_submit_too_fast` flags.
- `bounds.ts` — numeric fields outside `field.min`/`field.max` are a **hard reject** (whole
  submission bounced with 422); outside `warn_below`/`warn_above` is a **soft flag** only.
- Flags accumulate into `validation_status`: `rejected` (bounds violation, not saved) vs. `flagged`
  (any other flag present, saved) vs. `passed` (no flags). This is one layer of the multi-layer fraud
  detection system described in `docs/durian_system_docs.md` §8 — behavioral pattern checks
  (Layer 5) are not implemented yet, only presence/timing/bounds.

### i18n

`lib/i18n/t.ts` resolves an `I18nString` (`{ th, my, en }`) to a single display string, defaulting to
Thai. Task definitions and field labels are stored as `I18nString` in the DB so one schema serves
Thai/Burmese/English workers; most static UI chrome, however, is hardcoded Thai JSX rather than
routed through `t()`.

### Route groups

`app/(worker)/` and `app/(manager)/` are Next.js route groups with independent layouts/role guards
(see Auth section). They don't share a navigation shell — worker is a bottom-nav-free mobile flow,
manager has a top nav (`ManagerLayout`) plus `components/manager/ManagerBottomNav.tsx` for mobile
manager views.
