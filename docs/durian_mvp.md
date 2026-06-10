# Durian Farm System — MVP Scope

**Status:** Pre-implementation planning
**Pilot target:** 600 trees, worker + manager roles only
**Companion docs:** `durian_system_docs.md` (concepts), `durian_build_spec.md` (full spec), `durian_schema.md` (full schema)

---

## Guiding principle

Some decisions are **load-bearing** — skip them now and you rewrite later. Others are **additive** — bolt them on without touching the foundation. The MVP keeps all load-bearing decisions (even thinly) and defers everything additive.

---

## Scoping decisions

| Question | MVP decision | Deferred |
| :--- | :--- | :--- |
| Photo enforcement | Flat ~10% random audit, server-decided | Full trust tiers (trusted/standard/audit) + transitions |
| Worker task flow | Free-roam scanning, `assignment_id` null | Manager-assigned daily queue |
| Language | Thai + icons; `{th,my,en}` in data, `t()` defaults to `th` | Burmese labels (later data flip, no code change) |
| Owner visibility | Deferred — pilot proves it to manager K. Nong first | Full owner dashboard |
| Individual fruit tracking | Deferred — count-level premium tracking in `sets` stays | `fruits` table + gold-clip tagging flow |

---

## MVP — Build Now

### Database schema

All tables except `fruits`. Migrations in dependency order:

- [ ] `001_enums.sql` — all enum types
- [ ] `002_users_workers.sql` — `public.users` (profile) + `public.workers`
- [ ] `003_trees.sql` — includes `derived_state` columns
- [ ] `004_task_definitions.sql`
- [ ] `005_assignments.sql` — create table; `assignment_id` nullable/unused in MVP worker flow
- [ ] `006_task_logs.sql` — append-only; most important table
- [ ] `007_sets.sql` — fruit generations; includes `initial_fruit_count`, `current_fruit_count`, `premium_fruit_count` (count-level tracking stays; individual `fruits` table deferred)
- [ ] `008_alerts.sql` — includes deferred FKs on assignments
- [ ] `009_protocols.sql` — table created but empty for MVP; manager adds data later
- [ ] `010_updated_at_triggers.sql`
- [ ] `011_rls_policies.sql` — worker + manager roles only; owner role policies stubbed

### Authentication

- [ ] Worker auth — **Phone OTP** via Supabase native (recommended) or PIN (custom edge fn)
- [ ] Manager auth — email + password via Supabase native
- [ ] Auth middleware routing users to correct route group by role
- [ ] RLS helper functions (`is_worker()`, `is_manager()`, `worker_zones()`)

### Shared Zod schemas (`lib/schemas/`)

- [ ] `primitives.ts` — `GpsCoord`, `I18nString`, enums
- [ ] `task-definition.ts` — `TaskDefinition`, `TaskField`, `PhotoPolicy`
- [ ] `task-log.ts` — `TaskLogSubmission`
- [ ] `tree.ts` — includes derived state shape
- [ ] `set.ts`
- [ ] `alert.ts`

### i18n helper (`lib/i18n/`)

- [ ] `t(key, lang?)` — looks up `{th, my, en}` object, defaults to `th`
- [ ] `th.json`, `my.json` — Burmese left empty for MVP (Burmese strings added later without code changes)
- [ ] All UI labels and task definition fields go through `t()` — no hardcoded Thai strings inline

### Supabase clients (`lib/supabase/`)

- [ ] `client.ts` — browser client
- [ ] `server.ts` — server-side RSC client
- [ ] `admin.ts` — service-role client (edge functions only)

### Seed data

- [ ] `supabase/seed/01_task_definitions.sql` — 5 task defs (fertilizer, watering, bloom_log, pest_inspection, harvest_log)
- [ ] `supabase/seed/02_trees.ts` — 600-tree generator script
- [ ] `supabase/seed/03_protocols.sql` — table seeded but empty
- [ ] `supabase/seed/04_users_workers.sql` — 3 workers, 1 manager (auth UUIDs filled after Supabase Auth setup)

### Worker app `/(worker)/`

- [ ] `layout.tsx` — mobile-first, icon-heavy, minimal chrome
- [ ] `/login` — chosen worker auth flow
- [ ] `/scan` — QR scanner (`html5-qrcode`); free-roam (no pre-selected assignment)
- [ ] `/tasks` — task menu shown after QR scan succeeds; lists available task types for that tree
- [ ] `/tasks/[taskDefId]` — task detail, locked until QR scan passes; form rendered generically

**Generic form renderer** (`components/worker/TaskFormRenderer.tsx`):
- [ ] `numeric_counter` — large +/- buttons, configurable `step`
- [ ] `dropdown` / `color_picker` — icon grid, no text list
- [ ] `severity_picker` — 4 severity icons
- [ ] Reads `task_definition.fields`; new field types added later without component changes

**GPS capture** (`lib/gps.ts`):
- [ ] Starts watching on app open, not on submit
- [ ] Graceful deny — submits without coords, raises `gps_missing` flag

**Photo capture** (`components/worker/PhotoCapture.tsx`):
- [ ] `<input capture="environment">` — camera only, no gallery
- [ ] Shown only when `photo_required = true` (from `start-log` response)

### `start-log` endpoint (`/api/start-log`)

Key anti-tamper mechanism replacing assignment-fetch in the full design. Called when worker scans QR + opens a task form.

- [ ] `POST /api/start-log` — body: `{ tree_id, task_def_id, worker_id }`
- [ ] Server rolls random number; if ≤ 10% (flat rate for MVP) → `photo_required: true`
- [ ] Returns: `{ log_token, photo_required, photo_requirement_reason }` — client must include `log_token` in submit
- [ ] Server verifies token matches on submit (prevents client-side photo-skip)
- [ ] Slots into assignment flow later: `start-log` just looks up the assignment instead of rolling fresh

### Submit-log edge function (`/functions/v1/submit-log`)

- [ ] Auth: worker session required
- [ ] Validate body against `TaskLogSubmissionSchema`
- [ ] Verify `log_token` from `start-log` response
- [ ] Validate `form_data` against `task_def.fields` (server-side Zod)
- [ ] Cross-check `photo_required` matches token (cannot be overridden by client)
- [ ] Run **MVP fraud checks** (see below)
- [ ] INSERT into `task_logs` (append-only)
- [ ] If `task_type = 'bloom_log'`: INSERT into `sets`
- [ ] If `task_type = 'harvest_log'`: UPDATE `sets` status + `harvested_at`
- [ ] If severity ≥ moderate on pest/disease: INSERT into `alerts`
- [ ] Trigger derived state recompute (async)
- [ ] Return `{ log_id, validation_status, validation_flags }`

### Photo upload edge function (`/functions/v1/upload-photo`)

- [ ] Auth: worker session
- [ ] Multipart file upload; MIME + size (< 10MB) validation
- [ ] Save to Supabase Storage bucket `task-photos/`
- [ ] Return storage URL (included in `submit-log` body)
- [ ] EXIF parsing deferred — no EXIF checks in MVP

### Fraud checks — MVP only (`lib/validation/`)

**Layer 1 — Presence:**
- [ ] `qr_mismatch` — scanned `qr_value` ≠ tree's `qr_code`
- [ ] `gps_missing` — worker denied location permission
- [ ] `gps_off_tree` — submission GPS > 15m from tree's known location

**Layer 2 — Timing:**
- [ ] `completion_too_fast` — `submitted_at - form_opened_at` < `task_def.min_completion_seconds`
- [ ] `qr_to_submit_too_fast` — `submitted_at - qr_scanned_at` < `task_def.min_qr_to_submit_seconds`

**Layer 4 — Input bounds:**
- [ ] Hard range violation → **reject** submission
- [ ] Soft range violation → `value_out_of_warn_range:<field_id>` flag

*Layers 3 (EXIF), 2-extended (impossible_travel, bulk, metronome), and 5 (behavioral) deferred.*

### Derived state recompute

- [ ] Edge function or Next.js API route called after each `task_log` insert for a tree
- [ ] Updates `trees.derived_*` columns: `last_updated`, `active_set_ids`, `last_maintenance`, `health_score`, `open_alerts`, `days_since_last_log`
- [ ] Nightly catch-up job via Supabase cron

### Manager dashboard `/(manager)/`

- [ ] `layout.tsx` — Thai-first, desktop-friendly
- [ ] `/login` — email + password
- [ ] `/dashboard` — open alerts by tier, today's log count, farm health summary
- [ ] `/alerts` — triage open alerts; mark reviewed / resolved / dismissed; Tier 1 at top
- [ ] `/workers` — worker list with reliability metrics, trust tier display
- [ ] `/trees` — filterable by zone/status; click into tree → full log timeline + active sets

---

## Deferred — Add Later (no rewrites required)

### Auth & roles
- [ ] Owner role + RLS policies (schema stubs exist; just fill in)
- [ ] PIN-based worker auth (if OTP is chosen now, this is a swap)
- [ ] LINE / LIFF auth bridge

### Owner dashboard
- [ ] `/(owner)/` route group
- [ ] Overview: active sets, upcoming harvest windows, alert counts
- [ ] Sets list sorted by harvest window

### Trust tier system
- [ ] `trusted` / `standard` / `audit` tiers with per-tier audit rates (1% / 5% / 15%)
- [ ] Auto-promotion / demotion rules + flag decay (90-day rolling window)
- [ ] Manual manager override
- [ ] Worker reliability recompute nightly job
- [ ] `start-log` updated to use tier-specific rates instead of flat 10%

### Manager-assigned daily queue
- [ ] `GET /api/assignments/today` endpoint
- [ ] Worker `/tasks` shows assigned queue instead of free-roam scan
- [ ] Assignment status tracking (`pending` → `in_progress` → `completed` / `overdue`)
- [ ] Assignment creation flow in manager dashboard
- [ ] Recurring assignment templates

### Individual fruit tracking (`fruits` table)
- [ ] `fruits` table migration (deferred schema in build spec §4.9)
- [ ] Gold-clip scan field type in `TaskFormRenderer`
- [ ] "Tag premium fruit" task definition + flow
- [ ] Auto-generated targeted care assignments on tagging
- [ ] `fruits` lifecycle: `developing` → `dropped` / `harvested` / `downgraded`

### Extended fraud checks
- [ ] `impossible_travel` — implied speed between consecutive logs > 6 km/h
- [ ] `bulk_submission` — 20+ logs from one worker in 5 minutes
- [ ] `sequence_pattern_suspect` — metronome-even inter-log intervals over 10+ logs
- [ ] EXIF verification: `exif_missing`, `exif_timestamp_mismatch`, `exif_gps_mismatch`
- [ ] Behavioral (nightly): `suspicious_always_clean`, `unusual_volume_spike`

### Protocols + alert-to-task pipeline
- [ ] Protocol library seed data (K. Nong's domain knowledge)
- [ ] `protocols` table UI for manager (edit in Supabase dashboard for now)
- [ ] One-tap "assign response task" from alert detail view

### Offline support
- [ ] Service worker + submission queue in browser storage
- [ ] Sync on reconnect (chronological order)
- [ ] Conflict resolution for same-tree concurrent offline logs

### Language
- [ ] Burmese (`my`) label strings in `my.json`
- [ ] Language selector in worker app (reads `worker.language`, defaults to `my`)

### Voice notes
- [ ] Audio recording in Burmese on task form
- [ ] Storage of `notes_audio_url` in task log
- [ ] Transcription pipeline (separate concern)

### Push notifications
- [ ] Tier 1 push to manager (web push / LINE notify)
- [ ] Supabase Realtime subscription on manager dashboard for live alert feed
- [ ] Daily Tier 2 digest generation

### Analytics & visualizations
- [ ] Heat maps: alert density, Grade A concentration, zone health
- [ ] Leaflet satellite map with tree markers + alert overlays
- [ ] 120-day harvest projections
- [ ] ROI tracking
- [ ] Tier 3 weekly summaries

### Task definition editor UI
- [ ] Manager-facing form builder (edit task fields without touching Supabase dashboard JSON)

---

*When a deferred feature is ready to build, reference `durian_build_spec.md` for the detailed spec — everything above maps to a section in that document.*
