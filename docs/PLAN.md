# Durian Farm Worker QR Inspection App — Prototype Plan

## Context
Greenfield prototype (repo currently contains only a one-line README). Goal: test the end-to-end workflow of a Thai-speaking farm worker scanning a tree QR code on their phone, filling an inspection form, attaching a photo + GPS, and saving to a database. Mobile-first, one-handed operation, works in iOS Safari + Android Chrome.

The plan deliberately keeps the stack tight so the prototype can be run locally and demoed on a phone over HTTPS within a single evening.

---

## Tech Stack (recommended)

| Layer | Choice | Why |
|-------|--------|-----|
| Framework | **Next.js 15 (App Router) + TypeScript** | One process for UI + API, file-based routing, trivial Vercel deploy, TS matches Prisma |
| Styling | **Tailwind CSS** | Fastest way to hit the 48px touch targets / mobile-first layout |
| DB | **Supabase Postgres** via **Prisma** | Prisma migrations + typed client; Supabase hosts the Postgres |
| Photo storage | **Supabase Storage** (bucket: `inspection-photos`) | Durable, CDN-backed, public URLs returned to DB `photoUrl` |
| QR scanner | **html5-qrcode** | Specified in prompt; mature, works on iOS Safari 14.3+ |
| Image compression | **browser-image-compression** | Client-side resize to 1200px / JPEG 0.8 before upload |
| Toasts | **sonner** | Lightweight notifications (see "Toast inventory" section below) |
| Backend | **Next.js Route Handlers** (`app/api/**`) | No need for a dedicated server or Supabase Edge Functions for this scope |

### Do we need a dedicated backend or Supabase Edge Functions?
**No — use Next.js Route Handlers.** Edge Functions (Deno) add a second runtime, a separate deploy pipeline, and awkward local dev. Our API surface is 4 routes, all trivial CRUD + one multipart upload. Next.js API routes keep everything in one TypeScript codebase and one `next dev` process. If the project later grows background jobs (scheduled tree-health aggregates, webhook fan-out), revisit Edge Functions then.

### Photo storage — confirmed
The prompt mentioned both "Supabase for image storage" and "Upload photo to /public/uploads" (these conflict). **Decision: Supabase Storage everywhere.** No local-disk fallback. The README will document the bucket + RLS policy setup so the user can create them in a fresh Supabase project.

---

## Architecture

```
app/
  page.tsx                      # / — worker selection
  scan/page.tsx                 # /scan — QR scanner + manual entry
  inspect/[treeId]/page.tsx     # /inspect/[id] — inspection form
  history/page.tsx              # /history — today's inspections (worker-scoped)
  alerts/page.tsx               # /alerts — notifications list (worker-facing)
  admin/page.tsx                # /admin — read-only dashboard (see Admin Dashboard section)
  api/
    health/route.ts             # GET — liveness
    workers/route.ts            # GET — list workers
    trees/route.ts              # GET — list trees (admin)
    trees/[id]/route.ts         # GET — tree detail for prefill
    uploads/route.ts            # POST — accepts one image, returns Supabase Storage URL
    inspections/route.ts        # GET (list) + POST (JSON create with photoUrls[])
    fruit-batches/route.ts      # POST — create a new bloom batch
    fruit-batches/[id]/harvest/route.ts  # POST — mark batch harvested
    notifications/route.ts      # GET — derived alerts (no DB writes)
    stats/summary/route.ts      # GET — admin dashboard aggregates
  layout.tsx                    # font (Noto Sans Thai), Tailwind, Toaster
  globals.css

components/
  WorkerCard.tsx
  QrScanner.tsx                 # wraps html5-qrcode, handles permission denial
  HealthGradeButtons.tsx        # A/B/C large coloured buttons
  NumberStepper.tsx             # +/- with large tap targets
  IssueChips.tsx                # multi-select chips
  PhotoCapture.tsx              # camera button + preview + compression
  GpsCapture.tsx                # silent hook; shows “ไม่สามารถระบุตำแหน่ง” if denied
  InspectionHistoryRow.tsx
  InspectionDetailModal.tsx
  StatCard.tsx                  # admin dashboard tile (label + big number)
  ZoneHealthBars.tsx            # admin dashboard: % A/B/C per zone (CSS bars, no chart lib)
  IssueFrequencyList.tsx        # admin dashboard: top issues this week
  FarmMap.tsx                   # admin dashboard: Leaflet map, dynamic imported (ssr:false)
  AlertBadge.tsx                # bell icon + count, used in /scan header
  AlertRow.tsx                  # one notification row (severity dot, icon, message, time)
  FruitBatchSection.tsx         # bloom + harvest UI block on inspection form
  ColorSwatch.tsx               # red/green/blue ribbon visual

lib/
  prisma.ts                     # singleton Prisma client
  supabase.ts                   # server-side Supabase client (service role) for Storage uploads
  workerSession.ts              # localStorage helpers: currentWorker, recentTrees[]
  compressImage.ts              # wraps browser-image-compression
  config.ts                     # editable thresholds (harvest days, fertilizer interval, etc.)
  notifications.ts              # pure function: takes trees+inspections+batches → Notification[]

prisma/
  schema.prisma                 # exact models from prompt
  seed.ts                       # 20 trees, 5 workers, ~5 sample inspections
```

### State / session model
No auth. `localStorage.currentWorkerId` is set on Page 1 and read on every subsequent page. Server endpoints trust the `workerId` the client sends (prototype-grade — fine for this demo; flagged as not production-safe).

`localStorage.recentTrees[workerId]` holds the last 3 scanned tree IDs for the quick-access buttons on `/scan`.

### API contracts

| Route | Method | Input | Output |
|---|---|---|---|
| `/api/health` | GET | — | `{ ok: true }` |
| `/api/workers` | GET | — | `Worker[]` |
| `/api/trees` | GET | optional `?zone=A` | `Tree[]` (used by admin dashboard) |
| `/api/trees/[id]` | GET | path `id` | `Tree & { lastInspectionAt: Date \| null }` or 404 |
| `/api/uploads` | POST | `multipart/form-data` with single `file` (image) | `{ url, path }` |
| `/api/inspections` | POST | JSON body (incl. optional `photoUrls: string[]`) | `{ id }` |
| `/api/inspections` | GET | `?workerId&date=today` OR `?date=today` (admin) | `Inspection[]` with tree + worker + photoUrls |
| `/api/stats/summary` | GET | optional `?range=today\|week` | `{ totalInspections, byHealthGrade, byZone, topIssues, photoCount }` |

### Two-step photo flow (replaces multipart inspection POST)
1. Worker taps camera button → `PhotoCapture` compresses image client-side.
2. Component calls `POST /api/uploads` with the compressed file → server uploads to Supabase Storage bucket `inspection-photos`, path `${treeId}/${randomId}.jpg`, returns `{ url, path }`.
3. URL is added to local form state (`photoUrls: string[]`); thumbnail shown immediately. Worker can take more photos or remove existing ones.
4. On submit, `POST /api/inspections` sends a clean JSON payload with `photoUrls` already as URLs. No multipart on the main create endpoint.

### Schema tweak (one field)
`Inspection.photoUrl String?` → `Inspection.photoUrls String?` (JSON-encoded array, same convention as `issuesFound`). Photos remain entirely optional. If the user later prefers a proper relation, we can introduce a `Photo` model — overkill for the prototype.

### QR payload
Trees are seeded with IDs `TREE-001`…`TREE-020`. QR codes encode the raw ID string (so `qr-code-generator.com` → text → `TREE-001` works). Scanner extracts the decoded string directly; if it matches `/^TREE-\d{3}$/`, navigate to `/inspect/<id>`, else show toast "รหัสไม่ถูกต้อง".

### Toast inventory (sonner)
Setup: `<Toaster position="top-center" richColors />` in `app/layout.tsx`. Anywhere in the app: `import { toast } from "sonner"; toast.success("...")` / `toast.error("...")` / `toast.info("...")`.

| Page | Trigger | Variant | Message (Thai) |
|---|---|---|---|
| `/scan` | Camera permission denied | info | ไม่สามารถเข้าถึงกล้อง ใช้การพิมพ์รหัสแทน |
| `/scan` | QR scanned but not `TREE-###` format | error | รหัส QR ไม่ถูกต้อง |
| `/scan` | Manual entry — tree not found (404 from API) | error | ไม่พบต้นไม้รหัสนี้ |
| `/inspect` | GPS denied | info (small, dismissable) | ไม่สามารถระบุตำแหน่ง |
| `/inspect` | Photo upload in progress | loading toast (auto-replaced on done) | กำลังอัปโหลดรูป… |
| `/inspect` | Photo upload failed | error | อัปโหลดรูปไม่สำเร็จ |
| `/inspect` | Submit pressed without health grade | error | กรุณาเลือกสุขภาพต้น |
| `/inspect` | Save success | success | บันทึกข้อมูลเรียบร้อย |
| `/inspect` | Save failed (network/server) | error (form data preserved) | บันทึกไม่สำเร็จ ลองอีกครั้ง |
| `/history` | Fetch failed | error | โหลดประวัติไม่สำเร็จ |
| `/admin` | Stats fetch failed | error | โหลดสถิติไม่สำเร็จ |
| `/inspect` | New bloom batch saved | success | บันทึกการออกดอกเรียบร้อย |
| `/inspect` | Bloom color already in use on this tree | error | สีนี้ถูกใช้แล้วบนต้นนี้ |
| `/inspect` | Harvest confirmed | success | บันทึกการเก็บเกี่ยวเรียบร้อย |
| `/alerts` | Fetch failed | error | โหลดการแจ้งเตือนไม่สำเร็จ |

### Admin dashboard (`/admin`) — read-only, desktop-friendly
Single-page dashboard at `/admin`. **No link from worker UI** — discoverable only by typing the URL. No auth gate. Mobile-responsive but designed primarily for desktop/tablet.

**Sections (top to bottom):**
1. **Summary tiles** (4 across): trees total · inspections today · inspections this week · % grade-C this week
2. **Farm map** — full-width Leaflet map showing all 20 trees as colored markers (green=A / yellow=B / red=C / grey=never inspected), based on each tree's most recent inspection grade. Click marker → popup with tree ID, zone, variety, last inspection date + grade, link to start a new inspection. Satellite tile layer (Esri World Imagery, no API key required) since a farm view is more useful than a road map.
3. **Zone health overview** — for each zone A–E: stacked bar showing % grade A/B/C from this week's inspections
4. **Top issues this week** — bar list of `issuesFound` frequencies (e.g. "เพลี้ย — 12 ครั้ง")
5. **Worker activity** — table: worker name · inspections this week · last active
6. **Recent unhealthy trees** — list of latest 10 grade-C inspections with thumbnail, tree ID, zone, worker, time. Tap thumbnail → lightbox.

Data: `GET /api/stats/summary` for sections 1, 3, 4, 5 · `GET /api/trees` (with each tree's latest grade joined server-side) for section 2 · `GET /api/inspections?date=week&healthGrade=C` for section 6.

**Map stack:** `leaflet` + `react-leaflet`. Tile layer: Esri World Imagery (free, no key). Bundle cost ~45KB gzipped — only loaded on `/admin` via dynamic import so worker pages stay light.

### Schema additions for the map
`Tree` model gains:
- `latitude   Float?`
- `longitude  Float?`

Both nullable so trees without GPS still render (in a "no location" list under the map). Seed script will scatter the 20 trees inside a ~100m × 100m box around a real durian-growing area in Chanthaburi (≈ 12.6100°N, 102.1040°E) so the satellite map has a recognizable backdrop.

---

## Notifications & fruit batches

### Domain concept: fruit batches
A single durian tree can hold up to **3 simultaneous fruit batches**, each from a different bloom event. The grower physically ties a coloured ribbon (red / green / blue) around each batch when the flowers bloom. Harvest readiness = `bloomDate + 120 days` (configurable). Once a batch is harvested, that color is freed up for the next bloom.

### New schema model: `FruitBatch`
```prisma
model FruitBatch {
  id            String    @id @default(cuid())
  treeId        String
  tree          Tree      @relation(fields: [treeId], references: [id])
  colorTag      String    // "red" | "green" | "blue"  (matches config.fruitBatchColors)
  bloomDate     DateTime
  harvestedAt   DateTime?
  harvestedById String?
  notes         String?
  createdAt     DateTime  @default(now())

  @@index([treeId, harvestedAt])
}
```
`Tree` gains: `fruitBatches FruitBatch[]`. Schema invariant (enforced in app layer, not DB): at most one *unharvested* batch per `(treeId, colorTag)` pair.

### Two new fields on `Inspection` (for fertilizer/pesticide tracking)
- `fertilizerApplied  Boolean  @default(false)`
- `pesticideApplied   Boolean  @default(false)`

Worker checks these on the inspection form when they perform the action during the visit. Notifications use the most recent inspection per tree to compute "overdue" status.

### Bloom & harvest UX (added to inspection form, not a separate flow)
Two new collapsible sections at the bottom of the inspection form (above the sticky Save button):

**🌸 บันทึกการออกดอกใหม่** — appears only if tree has fewer than 3 active batches:
- Color picker showing only currently-free colors (red/green/blue)
- Date picker, defaults to today
- Optional notes
- Adds a `FruitBatch` row on submit

**🥭 ผลที่พร้อมเก็บเกี่ยว** — appears only if tree has at least one batch past `bloomDate + harvestDaysAfterBloom`:
- Lists each ready batch with its color swatch and "เก็บเกี่ยวแล้ว" button
- Tap → sets `harvestedAt = now()`, `harvestedById = currentWorker`

This keeps the worker's mental model simple: one form per tree visit handles inspection + bloom logging + harvest confirmation.

### Editable config: `lib/config.ts`
Single TypeScript file at the repo root with exported constants. Easy to grep, type-checked, change-and-restart. No JSON parsing, no DB round-trip. This is the "config file for now" the user asked for.

```ts
export const config = {
  // Days after bloom until fruit is ready to harvest
  harvestDaysAfterBloom: 120,

  // Days between fertilizer applications before a tree is "overdue"
  fertilizerIntervalDays: 30,

  // Inspection issuesFound entries that should trigger a pesticide alert
  pesticideTriggerIssues: ["เพลี้ย", "แมลงศัตรูพืช", "โรครา", "รากเน่า"],

  // Days since last inspection before a tree is flagged "stale"
  staleInspectionDays: 14,

  // Heads-up window: alert this many days BEFORE harvest readiness
  harvestWarningDaysBefore: 7,

  // The three physical ribbon colors used in the field
  fruitBatchColors: [
    { id: "red",   labelTh: "แดง",     hex: "#ef4444" },
    { id: "green", labelTh: "เขียว",    hex: "#22c55e" },
    { id: "blue",  labelTh: "น้ำเงิน",  hex: "#3b82f6" },
  ],
} as const;
```

If we later need live config without a redeploy, we move this to a `Config` table or a Supabase row. Out of scope for v1.

### Notification types (computed, not stored)
| Type | Severity | Trigger |
|---|---|---|
| `harvest_ready` | high | Any unharvested `FruitBatch` where `bloomDate + harvestDaysAfterBloom ≤ today` |
| `harvest_soon` | medium | `bloomDate + harvestDaysAfterBloom` is within `harvestWarningDaysBefore` |
| `pesticide_needed` | high | Tree's most recent inspection has an `issuesFound` entry in `pesticideTriggerIssues` AND no later inspection has `pesticideApplied = true` |
| `fertilizer_overdue` | medium | No inspection with `fertilizerApplied = true` in the last `fertilizerIntervalDays` |
| `inspection_stale` | low | No inspection at all in the last `staleInspectionDays` |

**Computation strategy: derive on read, no cron, no Notification table.** Each `GET /api/notifications` call runs a few SQL queries + JS aggregation. For 20 trees + a few hundred inspections this is microseconds. If we ever scale up, materialize into a table with a daily Supabase scheduled function. Keeping it derived means there's no notification staleness, no cron infra, and no "dismiss" state to manage in v1.

### New API endpoints
| Route | Method | Purpose |
|---|---|---|
| `/api/notifications` | GET | Optional `?workerId=X` (none = all). Returns `{ type, severity, treeId, message, payload }[]`, sorted by severity then date |
| `/api/fruit-batches` | POST | Create batch `{ treeId, colorTag, bloomDate, notes? }`. Rejects if color already in use on that tree. |
| `/api/fruit-batches/[id]/harvest` | POST | Mark harvested `{ workerId }` |

### New page: `/alerts`
- Linked from a bell icon in the `/scan` header showing a red badge with the count of high-severity alerts for the current worker (or all trees, since workers aren't zone-scoped in the prototype).
- Filter chips: ทั้งหมด · เก็บเกี่ยว · ยาฆ่าแมลง · ปุ๋ย · ตรวจช้า
- Each row: severity dot · icon · Thai message ("TREE-005 ผลสีแดงพร้อมเก็บเกี่ยว · บานเมื่อ 4 เดือนที่แล้ว") · tap → opens `/inspect/[treeId]` with the relevant form section pre-expanded.

### Admin dashboard additions
- New summary tile: **alerts active** (count of high+medium severity)
- New section above "Recent unhealthy trees": **🔔 ต้องดำเนินการวันนี้** — same data as `/alerts` but desktop layout
- Map markers gain a small overlay dot if the tree has any active alert (color = highest severity)

### Mobile & accessibility notes baked into components
- All interactive elements `min-h-12` (48px).
- Submit button `sticky bottom-0` with safe-area inset padding for iOS notch/home bar.
- Viewport meta `user-scalable=no` on inspection form to prevent accidental zoom on double-tap.
- Loading states on every async action (scanner init, photo compress, submit, history fetch) via disabled buttons + spinner.
- Camera permission denial → fall back to manual tree-ID input, no dead-end.
- GPS permission denial → silently submit without coords (field is optional in schema).

---

## Critical files to create
- [prisma/schema.prisma](prisma/schema.prisma) — models as given in prompt
- [prisma/seed.ts](prisma/seed.ts) — 20 trees / 5 workers / ~5 inspections
- [app/page.tsx](app/page.tsx), [app/scan/page.tsx](app/scan/page.tsx), [app/inspect/[treeId]/page.tsx](app/inspect/[treeId]/page.tsx), [app/history/page.tsx](app/history/page.tsx)
- [app/api/inspections/route.ts](app/api/inspections/route.ts) — multipart + Supabase Storage upload
- [components/QrScanner.tsx](components/QrScanner.tsx), [components/PhotoCapture.tsx](components/PhotoCapture.tsx)
- [lib/supabase.ts](lib/supabase.ts) — server client with `SUPABASE_SERVICE_ROLE_KEY`
- [README.md](README.md) — setup, `.env.example`, HTTPS instructions, QR generation tips

## Reusable libraries to install (not reinvent)
- `html5-qrcode` — QR decoding
- `browser-image-compression` — client photo compression
- `sonner` — toasts
- `@supabase/supabase-js` — Storage uploads
- `@prisma/client` + `prisma`
- `leaflet` + `react-leaflet` — admin map (dynamic-imported on `/admin` only)

## Build order (matches user's request)
1. Scaffold Next.js + Tailwind + Prisma
2. **Supabase setup (user does this in dashboard, I'll document each click in README):**
   - Create new project (region: Singapore for low latency to Thailand)
   - Copy `Project URL`, `anon key`, `service_role key`, and `Connection string` (Session pooler) → into `.env.local`
   - Storage → create public bucket `inspection-photos`
   - SQL editor → paste the storage policy snippet from README (allow public read, authenticated/service-role insert)
3. `npx prisma migrate dev` → schema applied to Supabase Postgres; run seed
4. `/api/health` + `/api/workers` + Page 1 (worker selection)
5. `/api/trees/[id]` + Page 2 (scan, with manual-entry fallback first so it's testable on desktop)
6. Page 3 (inspection form) + `POST /api/inspections` + Supabase Storage upload
7. `GET /api/inspections` + Page 4 (history)
8. **Notifications subsystem:** `lib/config.ts` → `lib/notifications.ts` (pure derive function, unit-testable) → `GET /api/notifications` → `/alerts` page + bell badge in `/scan` header
9. **Fruit batches:** `FruitBatch` migration → seed a few in-progress batches at varied bloom dates (some ready, some not) → POST + harvest endpoints → `FruitBatchSection` on inspection form
10. `/admin` dashboard: stats endpoint → tiles → zone bars → top issues → worker activity → recent unhealthy → alerts section → farm map with alert overlays (last because it's the heaviest)
11. Polish: loading states, sticky submit, Thai font, HTTPS docs, test on actual phone

---

## Verification plan

### Automated-ish checks
- `npm run build` passes with no TS errors.
- `curl http://localhost:3000/api/health` returns `{"ok":true}`.
- `curl http://localhost:3000/api/workers` returns 5 seeded workers.
- `curl http://localhost:3000/api/trees/TREE-001` returns zone/variety/age.

### End-to-end (desktop, manual-entry path)
1. Open `/`, pick worker → localStorage set, routed to `/scan`.
2. On `/scan`, type `TREE-001` into manual entry → routed to `/inspect/TREE-001`.
3. Form prefilled with zone/variety/age. Pick grade A, set flowers=10, fruits=3, tick "เพลี้ย", attach a photo via file input, leave notes blank.
4. Tap "บันทึก" → toast "บันทึกข้อมูลเรียบร้อย" → routed back to `/scan`.
5. Visit `/history` → new row appears with A badge + thumbnail. Tap row → modal shows full details.

### End-to-end (mobile, real QR)
1. Run `next dev --experimental-https` (or `ngrok http 3000`).
2. Print/display QR for `TREE-001` via qr-code-generator.com.
3. On phone: open HTTPS URL → accept camera + location prompts → scan QR → form opens → take 2 photos → submit.
4. Verify in Supabase dashboard: row in `Inspection`, both photos in `inspection-photos` bucket, both URLs in `photoUrls` resolvable in browser.

### Admin dashboard
1. Open `/admin` directly (no link from worker UI).
2. Verify 4 summary tiles populate with seeded + freshly-submitted data.
3. Map loads with 20 markers over the Chanthaburi satellite imagery; markers colored by latest grade. Click one → popup shows correct tree info.
4. Zone bars sum to 100% per zone. Top issues match seed + new data. Worker activity table shows the worker who just submitted with incremented count.
5. Recent unhealthy list shows grade-C inspections with thumbnails that open a lightbox.

### Edge cases to verify
- Camera denied → manual entry still works.
- GPS denied → submit still works, lat/lng null.
- Malformed QR → toast, no navigation.
- Duplicate rapid taps on submit → disabled-while-pending prevents double insert.
- Offline submit → toast error, form data retained (not dropped).
- Notifications: edit `lib/config.ts` to set `harvestDaysAfterBloom: 1`, restart, refresh `/alerts` → freshly seeded blooms now show as "harvest_ready". Restore to 120.
- Fruit batch color reuse: try to add a "red" batch when one already exists on the tree → error toast, no row created.
- Harvest a batch → that color becomes available for a new bloom on the same tree.
- Pesticide alert clears: tree with `เพลี้ย` issue → submit a new inspection with `pesticideApplied=true` → alert disappears on next refresh.

---

## Out of scope for this prototype (flagging explicitly)
- Auth / worker PIN login — `localStorage` + trusted `workerId` in POST body is sufficient for the demo. Admin dashboard is also unauthenticated.
- Offline queueing / service worker — submit requires online.
- Charting library (recharts/chart.js) — CSS bars only. Add later if a real chart is needed.
- Editing trees / workers from the admin UI — read-only dashboard for v1; mutate via Prisma Studio or seed if needed.
- i18n framework — UI strings are hardcoded Thai, matching the prompt.
- Rate limiting / abuse protection.
- **Push notifications** (PWA / web push / SMS / LINE) — alerts are pull-only via `/alerts` page + bell badge. Push needs a service worker, VAPID keys, and explicit permission UX — too much for v1. Worth adding LINE notify in v2 since it's standard in Thai farm operations.
- **Notification dismissal / snooze** — alerts are recomputed every read. Once the underlying condition is resolved (harvest done, fertilizer applied), the alert disappears naturally.
- **Editable config UI** — edit `lib/config.ts` and restart for now. A `Config` table with admin form is v2.
