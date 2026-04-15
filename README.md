# 🌳 ระบบตรวจสวนทุเรียน — Durian Farm Inspection App

Mobile-first prototype for Thai durian farm workers. Workers scan a QR code on a tree, fill out an inspection form (health grade, fruit count, photos, GPS, fertilizer/pesticide tracking, bloom logging, harvest confirmation), and the data is persisted to Supabase. An admin dashboard at `/admin` shows summary stats, a satellite farm map, active alerts, and recent unhealthy trees.

The full design plan lives at [docs/PLAN.md](docs/PLAN.md).

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router) + React 19 + TypeScript |
| Styling | Tailwind CSS v4 |
| Database | Supabase Postgres via Prisma |
| Photo storage | Supabase Storage (bucket `inspection-photos`) |
| QR scanning | `html5-qrcode` |
| Image compression | `browser-image-compression` (1200px / JPEG 0.8) |
| Toasts | `sonner` |
| Map | `react-leaflet` + Esri World Imagery (no API key) |

---

## 1. Set up Supabase

You need a Supabase account (free tier is fine).

1. Sign in at https://supabase.com → **New Project**.
   - **Region**: Singapore (`ap-southeast-1`) for low latency to Thailand.
   - Save the database password somewhere safe; you'll need it in step 3.
2. Wait for the project to provision (~2 min).
3. **Project Settings → Database → Connection string**:
   - Copy the **Direct connection** URI → paste into `.env.local` as `DIRECT_URL`.
   - Copy the **Transaction pooler** URI → paste into `.env.local` as `DATABASE_URL`. Append `?pgbouncer=true&connection_limit=1` to the end.
   - Replace `[YOUR-PASSWORD]` with the password from step 1.
4. **Project Settings → API**:
   - Copy the **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`.
   - Copy the **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
   - Copy the **service_role** key → `SUPABASE_SERVICE_ROLE_KEY`. **This key is server-only — never commit it or expose it to the browser.**
5. **Storage → New bucket**:
   - Name: `inspection-photos`
   - **Public bucket**: ON (so photo URLs work in the browser without auth)
   - Create.
6. **SQL Editor → New query**, paste the snippet below to allow the service role to insert and the public to read. Run it.

   ```sql
   -- Allow anyone to read photos (URLs are unguessable UUIDs).
   create policy "Public read inspection photos"
     on storage.objects for select
     using (bucket_id = 'inspection-photos');

   -- Allow the service role to upload (used by /api/uploads).
   create policy "Service role can upload inspection photos"
     on storage.objects for insert
     with check (bucket_id = 'inspection-photos');
   ```

7. Copy `.env.example` → `.env.local` and paste in all the values from steps 3–4.

---

## 2. Run locally

```bash
npm install
npm run db:migrate    # creates tables in your Supabase Postgres
npm run db:seed       # adds 5 workers, 20 trees, sample inspections + bloom batches
npm run dev           # http://localhost:3000
```

Quick sanity checks:

```bash
curl http://localhost:3000/api/health      # → {"ok":true,"time":"..."}
curl http://localhost:3000/api/workers     # → 5 workers
curl http://localhost:3000/api/trees/TREE-001
```

Open Prisma Studio to browse the data:

```bash
npm run db:studio     # http://localhost:5555
```

---

## 3. Test on a real phone (HTTPS)

The QR scanner needs camera access, which browsers only grant on `localhost` or HTTPS. Two options:

### Option A — Next.js built-in HTTPS (recommended)

```bash
npm run dev:https
```

Next will generate a self-signed cert in `./certificates/` and bind to `https://localhost:3000`. To hit it from your phone:

1. Make sure phone and laptop are on the **same WiFi network**.
2. Find your Mac's LAN IP: `ipconfig getifaddr en0`.
3. On your phone, open `https://<that-ip>:3000`.
4. iOS / Android will warn about the self-signed cert — tap "Visit anyway" (Safari: Advanced → Visit website).

### Option B — ngrok (works from any network)

```bash
brew install ngrok           # one-time
ngrok http 3000              # in one terminal
npm run dev                  # in another terminal
```

Open the `https://*.ngrok.app` URL printed by ngrok on your phone.

---

## 4. Generate test QR codes

The trees are seeded with IDs `TREE-001` through `TREE-020`. The QR code just needs to encode the raw text (no URL prefix).

1. Go to https://www.qr-code-generator.com (or any QR tool).
2. Choose **Text** type.
3. Enter `TREE-001`, generate, download PNG.
4. Repeat for as many trees as you want, or print one and tape it to a screen.

Alternatively, use a CLI: `npx qrcode "TREE-001" -o tree-001.png` (`npm i -g qrcode`).

If you don't have a QR ready, the `/scan` page also has a **manual entry** field where you can type `TREE-001` directly — handy for desktop testing.

---

## 5. Editing notification thresholds

All notification rules live in [lib/config.ts](lib/config.ts). Edit and restart `npm run dev` to apply.

```ts
export const config = {
  harvestDaysAfterBloom: 120,        // change to 1 to test the harvest_ready alert
  fertilizerIntervalDays: 30,
  pesticideTriggerIssues: ["เพลี้ย", "แมลงศัตรูพืช", "โรครา", "รากเน่า"],
  staleInspectionDays: 14,
  harvestWarningDaysBefore: 7,
  fruitBatchColors: [
    { id: "red",   labelTh: "แดง",     hex: "#ef4444" },
    { id: "green", labelTh: "เขียว",    hex: "#22c55e" },
    { id: "blue",  labelTh: "น้ำเงิน",  hex: "#3b82f6" },
  ],
  issueChoices: [/* ... */],
};
```

The notification engine is a pure function in [lib/notifications.ts](lib/notifications.ts) — easy to unit-test.

---

## 6. Pages

| Path | Purpose |
|---|---|
| `/` | Worker selection (Thai names + avatar) |
| `/scan` | QR scanner with manual fallback, recent trees, alert bell |
| `/inspect/[treeId]` | Inspection form + bloom logging + harvest confirmation |
| `/history` | Today's inspections by current worker (tap row → modal) |
| `/alerts` | All active notifications with filters |
| `/admin` | Read-only dashboard (no link from worker UI; access via URL) |

API routes live under [app/api/](app/api/).

---

## 7. Deploying

The app deploys to Vercel as-is. Set the same five env vars from `.env.local` in **Project Settings → Environment Variables**, then push to GitHub and connect the repo.

Run `npm run db:migrate deploy` once after the first deploy to apply migrations to the production DB.

---

## What's intentionally NOT in this prototype

- Worker auth (anyone can pick a name on `/`)
- Push notifications (alerts are pull-only via `/alerts`)
- Offline support
- Editable config UI (edit `lib/config.ts` and restart)
- Rate limiting

See [docs/PLAN.md](docs/PLAN.md) "Out of scope" for the full list.
