# Durian Farm System — Project Todos

**Scope:** Everything from now → pilot launch (600 trees, 1–2 months)
**Companion docs:** `durian_system_docs.md` (conceptual), `durian_build_spec.md` (technical)

Items are grouped by phase. Each todo has:
- **Owner** (who should do it — `[?]` means undecided)
- **Blocks** (what depends on this being done)
- **Estimate** (rough effort)
- **Status** (TODO / IN PROGRESS / DONE / BLOCKED)

---

## Phase 0 — Pre-Build Decisions

Must be resolved before Week 1 of building. These are mostly meeting/decision items, not engineering work.

### 0.1 Resolve open questions from the conceptual doc

- [ ] **Decide worker authentication method** (Phone OTP / PIN / LINE login)
  - Owner: `[?]` team lead
  - Blocks: all worker app development
  - Estimate: 1 meeting + cost research (~2h)

- [ ] **Decide LIFF vs standalone web** for worker delivery
  - Owner: `[?]` team lead
  - Blocks: auth choice, deployment setup
  - Estimate: 1 meeting (depends on LINE Official Account status with farm/owner)

- [ ] **Confirm task type list with K. Nong**
  - Owner: Ben (per handoff doc)
  - Blocks: task_definitions seed data finalization
  - Estimate: 1 meeting (~1h)
  - Notes: Verify the 5 we picked are correct; ask about anything we missed

- [ ] **Confirm set color reuse rules**
  - Owner: ask K. Nong
  - Blocks: set schema constraints
  - Estimate: 5 minutes of the K. Nong meeting

- [ ] **Decide audit sampler starting rates**
  - Owner: team
  - Blocks: nothing critical (can tune in production), but ideally set before pilot
  - Estimate: 1 discussion (~30 min)
  - Default: 1% / 5% / 15% — confirm or adjust

- [ ] **Decide tree retirement criteria**
  - Owner: ask K. Nong
  - Blocks: manager UI for tree management
  - Estimate: 5 minutes of the K. Nong meeting

- [ ] **Decide owner alert routing** (which Tier 1 alerts page the owner directly)
  - Owner: owner + team
  - Blocks: notification setup
  - Estimate: 1 discussion (~30 min)

### 0.2 Seed the protocol library

- [ ] **Document existing pest/disease response protocols** with K. Nong
  - Owner: Nam or Seth (per handoff doc)
  - Blocks: protocol seed data, alert-to-task pipeline being useful
  - Estimate: 2–3h of interview + 2h of writeup
  - Output: a list of (alert subtype → response action) mappings to seed `protocols` table

### 0.3 Operational decisions

- [ ] **Choose SMS provider** (if going Phone OTP)
  - Owner: `[?]`
  - Blocks: auth implementation
  - Estimate: 2h research + signup
  - Notes: Twilio is the Supabase default; check Thailand pricing and deliverability

- [ ] **Set up Supabase project**
  - Owner: `[?]` lead engineer
  - Blocks: all backend work
  - Estimate: 1h
  - Notes: Create project, get credentials, set up the team's access

- [ ] **Set up Vercel project**
  - Owner: `[?]` lead engineer
  - Blocks: deployment
  - Estimate: 30 min

- [ ] **Decide on a domain name**
  - Owner: `[?]`
  - Blocks: deployment, LIFF setup if applicable
  - Estimate: 15 min

- [ ] **Print QR codes for 600 trees**
  - Owner: `[?]` farm-side
  - Blocks: pilot launch (physical setup)
  - Estimate: 1 day of design + 1 week lead time for printing + lamination
  - Notes: This is a long-lead item; start early. Use the format `QR_<tree_id>_v1`

- [ ] **Order colored zip-ties + gold clips inventory**
  - Owner: Ben (already noted in handoff)
  - Blocks: pilot field operations
  - Estimate: 2 days research + 1–2 weeks shipping
  - Notes: Per Ben's handoff link — confirm color availability and durability

---

## Phase 1 — Foundation (Week 1)

### 1.1 Repository & tooling

- [ ] **Initialize Next.js + TypeScript repo**
  - Estimate: 1h
  - Notes: Follow structure in build spec section 2

- [ ] **Install and configure dependencies**
  - Estimate: 1h
  - Notes: Supabase JS client, Zod, React Hook Form, TanStack Query, Tailwind, html5-qrcode, exifr

- [ ] **Set up environment variables** (`.env.local.example` + actual `.env.local`)
  - Estimate: 30 min

- [ ] **Configure Supabase CLI + link to project**
  - Estimate: 30 min

- [ ] **Set up ESLint + Prettier + tsconfig strict mode**
  - Estimate: 1h

- [ ] **Add a basic CI workflow** (lint + typecheck on PR)
  - Estimate: 1h
  - Notes: GitHub Actions or Vercel preview deployments

### 1.2 Database schema

- [ ] **Write migration `001_enums.sql`** (all enum types)
  - Estimate: 30 min
  - Reference: build spec section 4.1

- [ ] **Write migration `002_users_workers.sql`**
  - Estimate: 30 min
  - Reference: build spec sections 4.2, 4.3

- [ ] **Write migration `003_trees.sql`**
  - Estimate: 30 min
  - Reference: build spec section 4.4

- [ ] **Write migration `004_task_definitions.sql`**
  - Estimate: 30 min
  - Reference: build spec section 4.5

- [ ] **Write migration `005_assignments.sql`**
  - Estimate: 30 min
  - Reference: build spec section 4.6

- [ ] **Write migration `006_task_logs.sql`** (most important)
  - Estimate: 1h
  - Reference: build spec section 4.7

- [ ] **Write migration `007_sets.sql`**
  - Estimate: 30 min
  - Reference: build spec section 4.8

- [ ] **Write migration `008_alerts.sql`** (includes deferred FK on assignments)
  - Estimate: 30 min
  - Reference: build spec section 4.10

- [ ] **Write migration `009_protocols.sql`**
  - Estimate: 30 min
  - Reference: build spec section 4.11

- [ ] **Write migration `010_updated_at_triggers.sql`**
  - Estimate: 30 min
  - Reference: build spec section 4.12

- [ ] **Write migration `011_rls_policies.sql`** (all RLS in one file)
  - Estimate: 2h
  - Reference: build spec section 5

- [ ] **Apply migrations to dev environment and verify schema**
  - Estimate: 1h

- [ ] **Generate TypeScript types from Supabase schema**
  - Estimate: 30 min
  - Notes: `supabase gen types typescript > types/database.ts`. Add to package.json scripts.

### 1.3 Shared schemas (Zod)

- [ ] **Write `lib/schemas/primitives.ts`**
  - Estimate: 30 min
  - Reference: build spec section 6.1

- [ ] **Write `lib/schemas/task-definition.ts`**
  - Estimate: 1h
  - Reference: build spec section 6.2

- [ ] **Write `lib/schemas/task-log.ts`**
  - Estimate: 30 min
  - Reference: build spec section 6.3

- [ ] **Write `lib/schemas/tree.ts`** (with derived state schema)
  - Estimate: 30 min

- [ ] **Write `lib/schemas/set.ts`**
  - Estimate: 30 min

- [ ] **Write `lib/schemas/alert.ts`**
  - Estimate: 30 min

### 1.4 Supabase client setup

- [ ] **Write `lib/supabase/client.ts`** (browser client)
  - Estimate: 30 min

- [ ] **Write `lib/supabase/server.ts`** (server-side client for RSC)
  - Estimate: 30 min

- [ ] **Write `lib/supabase/admin.ts`** (service-role client for edge functions)
  - Estimate: 30 min

### 1.5 Seed data

- [ ] **Write `supabase/seed/01_task_definitions.sql`** (5 task defs)
  - Estimate: 2h
  - Reference: build spec section 10

- [ ] **Write `supabase/seed/02_trees.ts`** (600-tree generator script)
  - Estimate: 1h
  - Reference: build spec section 11.1

- [ ] **Write `supabase/seed/03_protocols.sql`**
  - Estimate: 30 min
  - Reference: build spec section 11.3

- [ ] **Create initial user accounts** (3 workers, 1 manager, 1 owner) via Supabase Auth dashboard
  - Estimate: 30 min

- [ ] **Write `supabase/seed/04_users_workers.sql`** with the auth UUIDs
  - Estimate: 30 min

- [ ] **Run all seed scripts and verify in Supabase dashboard**
  - Estimate: 1h

### 1.6 Authentication

- [ ] **Implement chosen worker auth flow** (from Phase 0 decision)
  - Estimate: 4–8h depending on choice
  - Notes: Phone OTP is straightforward with Supabase native; PIN requires custom edge function; LINE requires LIFF integration

- [ ] **Implement email/password auth for manager and owner**
  - Estimate: 2h
  - Notes: Supabase native, standard flow

- [ ] **Write auth middleware** that routes users to correct dashboard based on role
  - Estimate: 2h

- [ ] **Test all three role logins end-to-end**
  - Estimate: 1h

---

## Phase 2 — Worker App Core (Week 2)

### 2.1 Worker layout & navigation

- [ ] **Build `/(worker)/layout.tsx`** (mobile-first, minimal chrome)
  - Estimate: 2h

- [ ] **Build language detection + i18n bootstrap** (Burmese as default)
  - Estimate: 2h
  - Notes: Simple `lib/i18n/` with JSON files for now; no full i18next needed

### 2.2 Task queue screen

- [ ] **Implement `GET /api/assignments/today`** endpoint
  - Estimate: 2h
  - Reference: build spec section 8.2
  - Notes: Includes audit sampler decision per assignment

- [ ] **Implement audit sampler** (`lib/audit-sampler.ts`)
  - Estimate: 2h
  - Notes: Deterministic seed per assignment so the same assignment always gets the same decision until completed

- [ ] **Build `/(worker)/tasks/page.tsx`** (task queue UI)
  - Estimate: 3h
  - Notes: Grouped by tree, sorted by priority. Visual-first; icons over text.

- [ ] **Add real-time refresh** when new assignments arrive (Supabase Realtime subscription)
  - Estimate: 2h

### 2.3 QR scanning

- [ ] **Build `/(worker)/scan/page.tsx`** using html5-qrcode
  - Estimate: 3h
  - Notes: Full-screen camera view, decoded value highlighted

- [ ] **Implement QR validation logic** (matches expected tree's `qr_code`)
  - Estimate: 1h

- [ ] **Test on iOS Safari and Android Chrome**
  - Estimate: 2h
  - Notes: Camera permissions, QR detection accuracy in various lighting

### 2.4 Generic task form renderer

- [ ] **Build `<TaskFormRenderer>`** that takes a `TaskDefinition` and renders fields dynamically
  - Estimate: 6h
  - Notes: Switch by field.type. Components per type: numeric_counter, dropdown, color_picker, severity_picker, slider

- [ ] **Build `<NumericCounter>`** component (large +/- buttons, big tap targets)
  - Estimate: 2h

- [ ] **Build `<IconDropdown>`** component (icon grid, not text list)
  - Estimate: 2h

- [ ] **Build `<ColorPicker>`** component (4 colored blocks)
  - Estimate: 1h

- [ ] **Build `<SeverityPicker>`** component (4 severity icons, ascending)
  - Estimate: 1h

- [ ] **Build `<SliderInput>`** component
  - Estimate: 2h

### 2.5 GPS capture

- [ ] **Build `lib/gps.ts`** with background GPS watching on app open
  - Estimate: 2h
  - Notes: Permission flow, error handling, freshness checks

### 2.6 Task detail flow

- [ ] **Build `/(worker)/tasks/[id]/page.tsx`** with the full state machine
  - Estimate: 4h
  - Reference: build spec section 12.3

- [ ] **Wire up form_opened_at timestamp** (set after QR scan, not page load)
  - Estimate: 30 min

- [ ] **Add scan gate** (form locked until QR validates)
  - Estimate: 1h

---

## Phase 3 — Submission Path (Week 3)

### 3.1 Photo capture

- [ ] **Build `<PhotoCapture>`** component using `<input capture="environment">`
  - Estimate: 2h
  - Notes: No gallery option, no file picker fallback

- [ ] **Implement EXIF parsing** with exifr on the client
  - Estimate: 2h
  - Notes: Reject immediately if EXIF missing

- [ ] **Implement `POST /functions/v1/upload-photo`** edge function
  - Estimate: 3h
  - Reference: build spec section 8.3
  - Notes: Multipart upload, file size + type validation, save to Storage bucket

- [ ] **Wire photo upload into task flow** (upload first, get URL, then include in submit-log)
  - Estimate: 2h

### 3.2 Submit log edge function

- [ ] **Implement `POST /functions/v1/submit-log`** edge function
  - Estimate: 6h
  - Reference: build spec section 8.1
  - Notes: This is the most important single piece of backend code

- [ ] **Implement task_def → form_data validation** (server-side Zod against fields)
  - Estimate: 2h

- [ ] **Implement photo_required cross-check** (server's earlier decision must match)
  - Estimate: 1h

### 3.3 Validation engine

- [ ] **Implement `lib/validation/presence.ts`** (qr_mismatch, gps_missing, gps_off_tree)
  - Estimate: 2h
  - Reference: build spec section 9.2, Layer 1

- [ ] **Implement `lib/validation/timing.ts`** (completion_too_fast, qr_to_submit_too_fast, impossible_travel, bulk_submission)
  - Estimate: 3h
  - Reference: build spec section 9.2, Layer 2

- [ ] **Implement `lib/validation/photo.ts`** (exif checks)
  - Estimate: 2h
  - Reference: build spec section 9.2, Layer 3

- [ ] **Implement `lib/validation/bounds.ts`** (numeric ranges, soft and hard)
  - Estimate: 2h
  - Reference: build spec section 9.2, Layer 4

- [ ] **Implement `lib/validation/index.ts`** orchestrator + status determination
  - Estimate: 1h
  - Reference: build spec section 9.1, 9.3

- [ ] **Write unit tests** for every flag code
  - Estimate: 4h
  - Notes: Use Vitest. Test passing and failing cases for each check.

### 3.4 Set creation on bloom logs

- [ ] **Implement bloom_log → set creation** in the submit-log edge function
  - Estimate: 2h
  - Notes: When task_type = 'bloom_log', insert into sets table after the log insert

- [ ] **Implement harvest_log → set status update**
  - Estimate: 2h

### 3.5 Storage configuration

- [ ] **Create `task-photos` bucket in Supabase Storage**
  - Estimate: 30 min

- [ ] **Set up bucket policies** (workers can upload; managers/owners can read)
  - Estimate: 1h

- [ ] **Configure CDN settings + lifecycle rules**
  - Estimate: 1h
  - Notes: Photos older than 1 year → cold storage tier

---

## Phase 4 — Manager Dashboard (Week 4)

### 4.1 Manager layout

- [ ] **Build `/(manager)/layout.tsx`** with navigation
  - Estimate: 2h
  - Notes: Thai-first UI strings

### 4.2 Dashboard home

- [ ] **Implement `GET /api/dashboard/manager/overview`**
  - Estimate: 3h
  - Reference: build spec section 8.4

- [ ] **Build `/(manager)/dashboard/page.tsx`** (alert counts, completion rate, farm health)
  - Estimate: 4h

### 4.3 Assignments

- [ ] **Build `/(manager)/assignments/page.tsx`** (today's queue + create new)
  - Estimate: 4h

- [ ] **Build assignment creation flow** (pick tree, pick task_def, pick worker, schedule)
  - Estimate: 4h

- [ ] **Build assignment reassign / cancel** actions
  - Estimate: 2h

### 4.4 Alerts

- [ ] **Build `/(manager)/alerts/page.tsx`** (tier 1 at top, with photo preview when present)
  - Estimate: 4h

- [ ] **Build alert detail view** (triggering log details, GPS map, photo, worker history)
  - Estimate: 4h

- [ ] **Build "Assign response task" one-tap action** (using protocol library)
  - Estimate: 3h

- [ ] **Build alert resolution flow** (mark reviewed / resolved / dismissed with notes)
  - Estimate: 2h

### 4.5 Workers

- [ ] **Build `/(manager)/workers/page.tsx`** (list with reliability metrics)
  - Estimate: 3h

- [ ] **Build worker detail page** (log history, trust tier override, zone assignment)
  - Estimate: 3h

- [ ] **Implement trust tier override** (writes to workers table, audit-logged)
  - Estimate: 1h

### 4.6 Trees

- [ ] **Build `/(manager)/trees/page.tsx`** (filterable list by zone, status, last activity)
  - Estimate: 3h

- [ ] **Build tree detail page** (full log timeline, active sets, alerts)
  - Estimate: 4h

### 4.7 Real-time updates

- [ ] **Subscribe manager dashboard to alerts table** for live Tier 1 push
  - Estimate: 2h
  - Notes: Supabase Realtime

---

## Phase 5 — Owner Dashboard + Alert Generation (Week 5)

### 5.1 Owner dashboard

- [ ] **Build `/(owner)/layout.tsx`**
  - Estimate: 1h

- [ ] **Implement `GET /api/dashboard/owner/overview`**
  - Estimate: 2h
  - Reference: build spec section 8.5

- [ ] **Build `/(owner)/dashboard/page.tsx`** (active sets, harvest windows, alert summary)
  - Estimate: 4h

- [ ] **Build `/(owner)/sets/page.tsx`** (all sets sorted by harvest window)
  - Estimate: 3h

### 5.2 Alert generation

- [ ] **Implement alert creation in submit-log** (severity ≥ moderate → Tier 1)
  - Estimate: 2h

- [ ] **Implement alert creation from validation flags** (gps_off_tree → Tier 1, etc.)
  - Estimate: 2h

- [ ] **Map flag codes → alert subtypes** (configuration table or inline)
  - Estimate: 1h

- [ ] **Suggest response task** based on protocol library lookup
  - Estimate: 1h

### 5.3 Background jobs

- [ ] **Set up Supabase cron** for nightly jobs
  - Estimate: 1h

- [ ] **Implement derived state recompute job** (Edge Function, runs on log insert + nightly catch-up)
  - Estimate: 3h

- [ ] **Implement worker reliability recompute job** (nightly)
  - Estimate: 2h

- [ ] **Implement trust tier auto-promotion/demotion logic**
  - Estimate: 2h
  - Reference: conceptual doc section 11

- [ ] **Implement inactive_tree alert generation** (daily check for trees with no logs in 2+ days)
  - Estimate: 1h

- [ ] **Implement set_overdue alert generation** (sets past harvest_window_end without harvest log)
  - Estimate: 1h

---

## Phase 6 — Hardening (Week 6)

### 6.1 Testing

- [ ] **Write end-to-end test for full worker submission flow** (Playwright)
  - Estimate: 4h

- [ ] **Write end-to-end test for manager alert response flow**
  - Estimate: 3h

- [ ] **Write integration tests for RLS policies** (verify worker can't read other workers' data)
  - Estimate: 3h

- [ ] **Verify derived state rebuild from logs** matches live derived state
  - Estimate: 2h

- [ ] **Load test the submit-log endpoint** (simulate 50 workers submitting concurrently)
  - Estimate: 3h

### 6.2 Performance

- [ ] **Review all dashboard queries with EXPLAIN ANALYZE**
  - Estimate: 2h

- [ ] **Add missing indexes** based on query plans
  - Estimate: 1h

- [ ] **Verify dashboard pages load in <2 seconds** on typical connection
  - Estimate: 1h
  - Notes: From acceptance criteria

### 6.3 Fraud detection demo

- [ ] **Script and rehearse fraud detection demo** for K. Nong
  - Estimate: 3h
  - Notes: Deliberate scenarios — rapid-fire, GPS off, sub-10-second completions, impossible travel. Each should trigger correctly within a 15-min demo.

### 6.4 Documentation for pilot

- [ ] **Write worker training one-pager** (visual, mostly icons, Burmese-first)
  - Estimate: 4h
  - Notes: K. Nong should be able to walk workers through it in 5 minutes

- [ ] **Write manager dashboard guide** (Thai)
  - Estimate: 4h

- [ ] **Write incident response runbook** (what to do if app breaks, photos fail to upload, etc.)
  - Estimate: 3h

- [ ] **Write QR code installation guide** (how to attach codes to trees, what height, what side)
  - Estimate: 1h

### 6.5 Acceptance criteria validation

- [ ] **Walk through every item in build spec section 16** and check off
  - Estimate: 4h
  - Notes: Treat as gating checklist before pilot launch

---

## Phase 7 — Pilot Launch (Weeks 7–8)

### 7.1 Physical setup

- [ ] **Install QR codes on all 600 pilot trees**
  - Owner: farm team
  - Estimate: 2–3 days (depends on farm team size)
  - Notes: Long-lead task; physical work

- [ ] **Distribute colored zip-tie stock to workers**
  - Estimate: 30 min

### 7.2 Worker onboarding

- [ ] **Run worker training session** (in Burmese, with translator if needed)
  - Estimate: half day
  - Notes: K. Nong leads; demo the full flow on a real tree

- [ ] **Each worker completes 5 supervised practice tasks**
  - Estimate: 2h per worker

- [ ] **Verify each worker can complete an unsupervised task** before going live
  - Estimate: 1h per worker

### 7.3 Soft launch

- [ ] **Run pilot on 50 trees for 3 days** (subset of the 600)
  - Estimate: 3 days elapsed
  - Notes: Tight feedback loop. Daily standup with K. Nong to surface issues.

- [ ] **Triage and fix all blocker bugs** from soft launch
  - Estimate: 2–3 days
  - Notes: Buffer here is critical

### 7.4 Full pilot launch

- [ ] **Roll out to all 600 trees**
  - Estimate: 1 day cutover

- [ ] **Daily check-in for first week** between team and K. Nong
  - Estimate: 30 min/day × 5 days

- [ ] **Weekly check-in for remainder of pilot**
  - Estimate: 1h/week

### 7.5 Pilot evaluation

- [ ] **Define pilot success metrics** before launch
  - Estimate: 1h discussion
  - Suggestions: % of assignments completed, % of submissions with flags, manager satisfaction, time-to-detect-issues vs baseline

- [ ] **Set evaluation review meeting** for end of pilot
  - Estimate: 2h
  - Notes: Decides whether to scale to 4000 trees

---

## Cross-cutting items (ongoing)

These don't fit a phase but matter throughout.

### Communication

- [ ] **Weekly sync between team and K. Nong** during build
  - Estimate: 1h/week

- [ ] **Bi-weekly progress update to owner**
  - Estimate: 30 min biweekly

### Risk management

- [ ] **Maintain risk register** with at least: SMS deliverability, GPS accuracy under tree canopy, worker phone compatibility, photo upload reliability on field 4G
  - Estimate: 1h to set up, then ongoing

- [ ] **Test on actual worker phones early** (week 2 or 3, not week 6)
  - Estimate: 4h
  - Notes: Critical. Workers' phones may be older Androids; what works on your iPhone may not work for them.

### Operational

- [ ] **Set up error monitoring** (Sentry or similar)
  - Estimate: 2h

- [ ] **Set up Supabase database backup verification**
  - Estimate: 1h
  - Notes: Supabase does daily backups; verify they're working and you can restore

- [ ] **Document on-call expectations** (who responds when the system breaks during the pilot)
  - Estimate: 30 min

---

## Post-pilot (deferred but worth tracking)

Listed so they're not forgotten.

- [ ] Grade A fruit tagging + `fruits` table
- [ ] Offline submission queue
- [ ] Voice note transcription pipeline
- [ ] Push notifications to workers
- [ ] Heat maps (alert density, Grade A concentration)
- [ ] Auto-generated recurring assignments
- [ ] Behavioral pattern detection (always_clean_worker, unusual_volume_spike)
- [ ] Worker-facing UI design polish
- [ ] Manager task_definitions editor UI
- [ ] Scale-up planning for 4000 trees
- [ ] ROI tracking dashboard for owner
- [ ] Protocol library expansion

---

## Effort summary (rough estimates)

| Phase | Engineering hours |
| :--- | :---: |
| Phase 0 (decisions) | ~8h (mostly meetings) |
| Phase 1 (foundation) | ~40h |
| Phase 2 (worker core) | ~45h |
| Phase 3 (submission) | ~40h |
| Phase 4 (manager) | ~45h |
| Phase 5 (owner + alerts) | ~30h |
| Phase 6 (hardening) | ~40h |
| Phase 7 (launch) | ~30h (mostly elapsed time, not eng hours) |
| **Total** | **~280 engineering hours** |

At 2 engineers × 30 hrs/week = ~5 weeks of build + 2 weeks of launch buffer. Matches the 1–2 month target if scope holds.

---

*End of todos.*
