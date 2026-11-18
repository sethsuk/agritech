# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Mobile-first Next.js app for a Thai durian farm (ระบบบริหารสวนทุเรียน). Workers scan a QR code on a
tree and fill out task forms (watering, fertiliser, pest inspection, bloom logging, fruit count,
harvest).
Managers see a dashboard with alerts, worker reliability metrics, and tree health. UI strings are
mostly Thai; data model and code are English.

## Commands

```bash
npm run dev             # http://localhost:3000
npm run dev:test        # dev server with SKIP_VALIDATION=true (bypasses GPS/QR/timing checks)
npm run dev:https       # self-signed HTTPS — needed to test camera/QR scan on a phone
npm run build
npm run lint            # ESLint 9 flat config (eslint.config.mjs) — `next lint` is deprecated
npm run test:unit       # Vitest: lib/time, validation (incl. presence/timing), labels, PINs
npm run test:sql        # RPC/view tests in rolled-back transactions + a two-connection race test

npm run db:migrate      # runs supabase/migrations/*.sql in order via scripts/migrate.ts, then seeds task_definitions
npm run db:seed:trees   # inserts 1035 trees in zone A (AL1-1…AL23-23, AR1-1…AR22-23)
tsx scripts/seed-users.ts   # creates/repairs the 5 dummy accounts (owner, manager, 3 workers)
npm run setup:storage   # creates the `task-photos` Supabase Storage bucket
ALLOW_DB_RESET=true npm run db:reset:dev   # DEV ONLY: wipe public schema → migrate → both seeds

npm run test:e2e        # Playwright: starts `dev:test`, runs phone (Pixel 7, iPhone 14) + desktop projects
npx playwright test --project=pixel tests/e2e/bug-02-sets.spec.ts   # one spec, one device
```

`db:migrate` connects directly via `DATABASE_URL` (pg) and is re-runnable — it skips statements
that fail with "already exists" (and prints the message, because a name clash with a *different*
object also says "already exists"). `db:push` / `db:reset` (Supabase CLI) exist as package.json
scripts but the project's actual workflow is the custom `scripts/migrate.ts` runner.

Because table migrations are skipped once their objects exist, **editing an existing table migration
has no effect on an already-migrated DB** — use `db:reset:dev` (drops the app's tables, views,
functions and types, then re-runs migrate + both seeds). Views and functions (`013`, `014`) use
`CREATE OR REPLACE`, so re-running `db:migrate` does pick up edits to those. `seed-users.ts` is
idempotent and handles the fact that `auth.users` survives a public-schema wipe: it looks up the
existing auth user by email and re-upserts its profile rows *and password*.

**SQL tests** (`tests/sql/NN_*.sql`) run after `tests/sql/_prelude.sql` inside `BEGIN … ROLLBACK`
against the dev DB and assert with plpgsql `ASSERT`; the prelude gives a throwaway tree and
`pg_temp.submit/correct/void` helpers with explicit time offsets (`now()` is frozen inside a
transaction). Domain rules belong here — far cheaper than e2e. `scripts/test-sql.ts` also runs a
concurrency test that needs real commits (it cleans up its own zone-Z tree).

**E2E tests** (`tests/e2e/`) run against the dev Supabase project in `.env.local` — not an isolated
DB — with `workers: 1`. The `bug-*.spec.ts` files run on phone emulation; the rest on desktop.
Specs create their own trees in the e2e-only zone `Z` (`helpers.freshTree()`) and accounts with an
`e2e_` username prefix; `global-teardown.ts` deletes both and everything they logged. UI text in
tests comes from the dictionary (`th("key")`), not hardcoded Thai. `loginWith()` pins the UI to
Thai, because a worker's first sign-in otherwise switches to the language their manager set.

`scripts/*.ts` are standalone Node scripts (not Next.js runtime), so they must polyfill
`globalThis.WebSocket` with `ws` before constructing a Supabase client — supabase-js builds a
RealtimeClient eagerly and Node < 22 has no native WebSocket. The app itself doesn't need this.

Dummy logins (after seeding): `owner@farm.local` / `owner1234`, `manager@farm.local` /
`manager1234`, `worker1` / `1111` (and worker2/2222, worker3/3333). The login field takes a bare
username and appends `@farm.local`. Root `/` redirects by role: workers → `/scan`,
managers/owners → `/dashboard`.

**Worker PINs and Supabase's password minimum:** Supabase Auth rejects passwords under 6
characters, so a 4–6 digit PIN is stored as `pin-<PIN>` (`lib/auth/pin.ts` `toAuthPassword`).
Every path that sets or checks a password — account creation, PIN reset, login, `seed-users.ts` —
must go through it. Passwords are only ever stored hashed inside Supabase Auth; a forgotten PIN can
only be reset (manager → worker page → Reset PIN).

**Accepted risks (owner's decision — internal, non-commercial app):** 4-digit PINs can be
brute-forced against predictable usernames, limited only by Supabase's per-IP rate limit (no
lockout/CAPTCHA). The deterministic photo-audit draw (`lib/photoAudit.ts`) can be probed via
`start-log` to learn which trees need a photo today — the price of it not being re-rollable.

## Architecture

### Schema

- `supabase/migrations/*.sql` + `types/database.ts` (hand-written) are the **actual, live schema**.
  Tables: `users`, `workers`, `trees`, `task_definitions`, `assignments`, `task_logs`, `sets`,
  `alerts`. Views (`013_views.sql`): `effective_task_logs`, `set_state`, `worker_stats`,
  `tree_summary`. Functions (`014_functions.sql`): `submit_task_log`, `correct_task_log`,
  `void_task_log`, `sync_set`, `dashboard_snapshot`.
- `docs/PLAN.md` describes an **earlier iteration** of the data model (and `prisma/schema.prisma`,
  now deleted, described the same dead design). Don't use it as a reference for the current schema.
- `docs/durian_build_spec.md`, `docs/durian_schema.md`, and `docs/durian_system_docs.md` document the
  current (post-pivot) design in depth — fraud detection layers, alert tiers, trust tiers, photo
  audit policy. Read these for *why* a table/column exists, not just what it contains. Note these
  predate the JSONB→columns pass below, so their example rows show some fields as JSON blobs that
  are now real columns.
- Other docs: `docs/durian_mvp.md` (what's in and out of the current MVP cut), `docs/design-system.md`
  (separate rules for the worker and manager UIs; colour tokens live in `app/globals.css` `@theme`,
  so use token classes like `bg-surface` / `text-primary-ink` and never hardcode a hex value in a
  component), `docs/durian_todos.md` (the
  pilot-launch todo list).

### JSONB policy — fixed shape means columns

Only two JSONB columns remain, and both are genuinely polymorphic:
`task_definitions.fields` (a form *schema*; every task type has structurally different inputs) and
`task_logs.form_data` (the matching submitted values). Everything with a fixed shape is a real
column — `display_name_th/_my/_en` + `icon` on `task_definitions`, `resolution_*` on `alerts` — which
buys `NOT NULL` enforcement, real FKs (`alerts.resolution_resolved_by` → `users.id`), and no
key-typo class of bug. A set's history is the logs that reference it (`task_logs.set_id`), not an
array or a separate events table.
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
- **All authorization lives in `lib/auth/gate.ts`.** `getSession()` (React `cache()`d, so a layout
  and its page share one lookup per request) returns `{ userId, role, displayName, active }`.
  Layouts and `app/page.tsx` call it and redirect role mismatches (`/dashboard` ↔ `/scan`); the
  worker layout also sends deactivated workers to `/login?reason=inactive`. If you add a new
  top-level page route, give it a role check too — there's no shared guard for pages.
- **API routes** call `requireStaff()` (manager/owner), `requireOwner()` or `requireWorker()`
  (refuses deactivated workers). Each returns `{ ok: true, userId, role, admin }` or
  `{ ok: false, response }` to return directly. Since the admin client bypasses RLS, this check is
  the *only* authorization — every new API route must call one (a missing check once let workers
  read and dismiss their own fraud alerts).
- Two Supabase server clients exist in `lib/supabase/`: `server.ts` (`createClient`, cookie-bound,
  respects RLS, used to read `auth.getUser()`) and `admin.ts` (`createAdminClient`, service-role,
  bypasses RLS). The established pattern in every API route and server layout is: use the cookie
  client only to get `user`, then use the admin client for all actual data access plus a manual role
  check in TypeScript. RLS policies (`supabase/migrations/011_rls_policies.sql`) exist as
  defense-in-depth, not as the primary authorization mechanism.
- Never import `lib/supabase/admin.ts` into a client component — it holds the service-role key.

### Worker submission flow — `start-log` / `submit-log`

This is the core domain flow and spans several files:

1. Worker scans a QR (`components/worker/QrScanner.tsx` / `html5-qrcode`) or types a tree ID, landing on
   `/tree/[treeId]`, then opens a task at `/tree/[treeId]/task/[taskDefId]`.
2. Opening the form calls `POST /api/start-log` (`app/api/start-log/route.ts`). The server decides
   `photoRequired` right then (based on `task_definitions.photo_policy_mode`: `always`, `never`, or
   `audit_only`, where the random-sample rate comes from the worker's `trust_tier` and the
   `PHOTO_AUDIT_RATE_TRUSTED` / `_STANDARD` / `_AUDIT` env vars — deployment config, not DB data)
   and returns a signed token (`lib/logToken.ts`, HMAC-SHA256 keyed by the `LOG_TOKEN_SECRET` env
   var, constant-time verified). The token binds the photo decision, the form-open time and the
   QR-scan time, so a worker can't skip the photo or backdate timings by tampering with the
   client. (It used to be keyed off the first 32 chars of the service-role key — a public JWT
   header shared by every Supabase project, so tokens were forgeable.) The form
   always shows the photo picker; `photoRequired` only decides whether submit is blocked without
   one. (Most seeded task definitions currently use `never`.)
3. The form itself is schema-driven: `task_definitions.fields` is a JSON array of `TaskField`
   (`types/database.ts`), rendered generically by `components/worker/TaskFormRenderer.tsx` which
   dispatches per `field.type` (`numeric_counter`/`slider`, `dropdown`, `color_picker`,
   `severity_picker`, `grade_counter`, `set_picker`, `toggle`) to the matching
   `components/worker/*` widget. Adding a new field type means adding a case here *and* a widget
   *and* a case in `lib/validation/fields.ts` (and `bounds.ts` if it's numeric).
4. Submitting calls `POST /api/submit-log` (`app/api/submit-log/route.ts`), which verifies the
   token, enforces the server's earlier photo decision, runs `lib/validation/index.ts` (see
   Validation engine below), then calls the **`submit_task_log` RPC**. That Postgres function
   inserts the log *and every consequence in one transaction*: bloom → create the set (refusing a
   ribbon colour already open on the tree); fruit count / harvest → check the set is open on this
   tree, refuse a recount above what remains, flag an over-harvest; pest moderate/severe, fraud
   flags and over-harvests → `alerts` rows; then `sync_set()`. There are no fire-and-forget side
   effects (they used to be, and could be lost when Vercel froze the function after responding).
   RPCs never raise for domain errors — they return `{ error: "<code>", ...details }`.
   - **Idempotent:** the token carries a random `submissionId`, stored in
     `task_logs.submission_id` (unique). A retry after a lost response returns the original log
     (`duplicate: true`) instead of inserting a second one.
   - **Token renewal:** `start-log` accepts `previousToken` (an expired or draft-restored token for
     the same worker/tree/task, ≤ 12 h old) and keeps its form-open/QR-scan times, photo decision
     and submission id — so a timed-out or restored form isn't flagged "too fast" and can't be
     duplicated. The task-page draft stores the token for this.
   - **Lock order:** every set-touching RPC (`submit`, `correct`, `void`, `manager_set_failed`)
     locks the **tree row first**, so writes to one tree serialize and `sync_set` sees them all.
5. `SKIP_VALIDATION=true` (env var, also toggled by `npm run dev:test`) skips the photo-audit roll
   and the **presence and timing** checks — the ones a laptop can't satisfy. Field and bounds
   checks, and the RPC's domain rules, always run. Never set in production.

### Validation engine (`lib/validation/`)

`validate()` in `index.ts` composes independent checks and returns `{ status, flags,
gpsDistanceMeters, rejection? }`. A `rejection` is structured — `{ code, field, option?, limit? }`
(`rejection.ts`) — never prose, so the form can name the field in the worker's language and
highlight it.
- `presence.ts` — QR value must match `tree.qr_code`; a typed tree ID gets `manual_entry`
  (reviewable, not fraud); GPS distance (haversine) vs. `GPS_TOLERANCE_METERS` (default 15m) →
  `qr_mismatch` / `gps_missing` / `gps_off_tree` flags. Only `qr_mismatch` / `gps_off_tree` raise a
  tier-1 fraud alert.
- `timing.ts` — completion time and QR-to-submit time below `task_definitions.min_*_seconds` →
  `completion_too_fast` / `qr_to_submit_too_fast` flags.
- `fields.ts` — every `required` field is present and option-backed fields (`dropdown`,
  `color_picker`, `severity_picker`) hold one of their declared `options[].value`s → **hard
  reject**. Exists because the API is callable directly, bypassing the form's client-side checks.
- `bounds.ts` — non-numbers, non-integers (when `step` is whole) and values outside
  `field.min`/`field.max` are a **hard reject** (422); outside `warn_below`/`warn_above` is a
  **soft flag** only (`value_out_of_warn_range:<field>`).
- Flags accumulate into `validation_status`: `rejected` (fields/bounds violation, not saved) vs.
  `flagged` (any other flag present, saved) vs. `passed` (no flags). This is one layer of the
  multi-layer fraud detection system described in `docs/durian_system_docs.md` §8 — behavioral
  pattern checks (Layer 5) are not implemented yet.

### Corrections & voids — `task_logs` stays append-only

Workers can fix or retract their own submissions (`/my-logs`, `app/api/my-logs/[logId]/correct`
and `.../void`), but these never UPDATE or DELETE a `task_logs` row. They insert a new row with
`correction_type` = `correction` | `void`, `correction_of_log_id` = the **root** log's id (never
another correction), and a required `correction_reason` (migration `012_task_log_corrections.sql`).
A record's full history is therefore `log_id = :root OR correction_of_log_id = :root`; the latest
correction holds the current values, and any `void` row retracts the whole chain (further
corrections/voids return 409; a unique index makes a concurrent double void fail too).

Both go through RPCs (`correct_task_log`, `void_task_log`) that lock the root row and re-sync the
record's set. Corrections re-run field and bounds checks (presence/timing flags from the original
visit carry over). Fields that identify a set — a bloom's ribbon colour, a harvest's set — are
locked (`locked_field`): moving fruit between sets is void-and-relog. A bloom can't be voided once
its set has fruit counts or harvests. Voiding dismisses farm-health/compliance alerts the record
raised; fraud alerts are kept deliberately.

**To read logs for anything that counts or displays them, use the `effective_task_logs` view**:
one row per live record, latest correction applied, voided records removed. Reading `task_logs`
directly double-counts corrections and counts voided records.

### Derived state — computed in SQL, never stored

Nothing derived is cached in a column (see CONTEXT.md "Derived state"). The views in
`013_views.sql` compute on read:
- `worker_stats` — logs, flagged ("needs review"), average completion time; all-time + last 90 days.
- `tree_summary` — last log, open alerts (open + reviewed), tier-1 present, open sets.
- `set_state` — a set plus bloom flowers, latest fruit count, harvested, remaining, lost, stage.

Aggregate in SQL, not by fetching rows into JS: PostgREST silently caps every response at 1000
rows (a client `.range(0, 9999)` can't raise it). For a list that can exceed 1000 rows, page with
`lib/supabase/fetchAll.ts`.

### Sets — bloom → fruit count → harvest

A set is one bloom wave on one tree, identified in the field by a ribbon colour. `sets` holds only
identity and lifecycle dates; every count is derived (`set_state`). At most one **open** set per
ribbon colour per tree (partial unique index), so a harvest always maps to exactly one set.
- **Bloom** (`bloom_log_v1`) creates the set; harvest window = bloom date + variety ripening days
  (`maturation_days()`) ± 7.
- **Fruit count** (`fruit_count_v1`, repeatable) records fruit still on the tree; it can only go
  down. `remaining` = latest count (or bloom flowers) − harvested since that count.
  `set_available_at(set, at, exclude)` is the ONE definition of "available", used by submit
  (fruit-count ceiling, over-harvest flag) and by corrections, which re-apply the same rules as
  they were at the record's time (and re-sync the over-harvest and pest alerts both ways).
- **Harvest** (`harvest_log_v1`) picks an open set (`set_picker`). More than `remaining` is saved
  but flagged `harvest_exceeds_set` with a tier-2 alert. The set closes when `remaining` ≤ 0 or
  the worker ticks "last pick" (`final_pick`); leftovers count as `lost`.
- `sync_set()` is the only writer of `closed_at`/`close_reason` (except a manager's manual
  `failed` via `manager_set_failed`, from the set card on the tree page), and it reopens a set if
  a correction/void brings `remaining` back above 0. A last pick may have no fruit
  (`grade_counts.required_unless = "final_pick"`; see `isRequired` in `lib/validation/fields.ts`).

### Time — always Bangkok

All date formatting and day/week/month bucketing goes through `lib/time.ts` (`formatDateTime`,
`formatDate`, `todayBkk`, `rangeStart`, …), which always uses `Asia/Bangkok`, whatever the device
or server timezone (Vercel is UTC). In SQL, use `AT TIME ZONE 'Asia/Bangkok'`. Never call
`toLocaleString()`, `toISOString().slice(0, 10)` or `setHours(0)` on a date elsewhere. Dashboard
ranges are calendar periods (week starts Monday).

### Client data — TanStack Query

Pages fetch through hooks in `lib/client/queries.ts` (cache keys in `qk`), backed by a
`QueryClient` in `components/QueryProvider.tsx` with `staleTime: Infinity`. Data loads once and is
reused across pages until the user taps Refresh (`RefreshBar`) or a mutation invalidates it, so
filter/tab switches are instant. The manager overview is a single RPC (`dashboard_snapshot`)
pre-grouped by every zone × range, so switching zone/range on the dashboard makes no request. After
a write, invalidate every query whose numbers it changes (e.g. resolving an alert →
`qk.alerts`, `qk.overview`, `qk.trees`). Fetch with `lib/client/api.ts` `api()`, which throws an
`ApiError` carrying the response's error code. Sign out with `useSignOut()`
(`lib/client/useSignOut.ts`), which also clears the query cache and form drafts — farm phones
are shared.

### Errors — codes, not prose

API routes return `{ error: "<code>", ...details }` and never display text (some used to return
Thai or English strings that were shown verbatim to everyone). The client turns codes into text
with `errorMessage()` in `lib/i18n/labels.ts`, which looks up `err_<code>` in the dictionary.
Rejections become `rej_<code>`, flags `flag_<code>`, alert subtypes `alert_<subtype>`. A new error
code needs a dictionary entry in all three languages.

### i18n

Three languages (`th` default, `my` Burmese, `en`). `lib/i18n/t.ts` resolves an `I18nString`
(`{ th, my, en }`) to one display string.

- **Static UI text** lives in `lib/i18n/dictionary.ts` (`dict`, keyed by `DictKey`). Client
  components use `const { lang, tr } = useT()` and call `tr("key", { var })` (`{var}`
  placeholders are interpolated). Machine codes (task types, flags, alert subtypes, errors) become
  text only through `lib/i18n/labels.ts` — never render a raw code. Server components
  can't read the language, because it's stored in `localStorage` (`LanguageContext.tsx`, switched
  by `components/LanguageToggle.tsx`), so they use `<T k="key" />` (`components/T.tsx`). That makes
  only the text itself a client component. New UI strings belong in `dict` with all three
  languages, not hardcoded Thai. On a worker's first sign-in on a device, the UI switches to
  `workers.language` (set by their manager) unless they already picked one; `<html lang>` follows.
- **Task names and field labels** come from the DB (`I18nString` inside `fields`, or the
  `display_name_*` columns via `taskDisplayName()`).
- **Durian varieties** (`lib/i18n/varieties.ts`): `trees.variety` stores the romanized name
  (`Monthong`, …) whatever the UI language is. Translations are display-only, through
  `varietyName()`. Never store a translated variety.

### Route groups

`app/(worker)/` and `app/(manager)/` are Next.js route groups with independent layouts/role guards
(see Auth section). They don't share a navigation shell — worker is a bottom-nav-free mobile flow,
manager has a top nav plus a mobile bottom nav, both rendered from the one tab list in
`components/manager/ManagerBottomNav.tsx`. Manager pages are client components on the query
hooks; filters live in the URL (`?zone=AL&range=week`), so Back and shared links keep the view.
Shared form pieces: `components/FormField.tsx` (label + red `*` + hint/error),
`components/InfoTip.tsx` (ⓘ tap-to-explain — phones have no hover), `components/QueryState.tsx`.
