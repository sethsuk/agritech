# ระบบบริหารสวนทุเรียน — Durian Farm Management System

Mobile-first app for Thai durian farm workers and managers. Workers scan a QR code on a tree and fill out task forms (watering, fertiliser, pest inspection, bloom logging, harvest). Managers see a dashboard with alerts, worker reliability metrics, and tree health.

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router) + React 19 + TypeScript |
| Styling | Tailwind CSS v4 |
| Database + Auth | Supabase (Postgres + RLS + Auth) |
| Photo storage | Supabase Storage (bucket `task-photos`) |
| QR scanning | `html5-qrcode` |
| Toasts | `sonner` |
| Validation | `zod` |

---

## 1. Set up Supabase

1. Sign in at [supabase.com](https://supabase.com) → **New Project** (region: Singapore for Thailand latency).
2. Copy `.env.example` → `.env.local` and fill in the values:
   - **Project Settings → API** → Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - **Project Settings → API** → anon key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **Project Settings → API** → service_role key → `SUPABASE_SERVICE_ROLE_KEY`
   - **Project Settings → Database → Connection string → URI → Direct connection** → `DATABASE_URL`
3. **Storage → New bucket**: name `task-photos`, Public ON.
4. **Authentication → Email → Confirm email** → turn **OFF** (workers don't have email access).

---

## 2. Run locally

```bash
npm install
npm run db:migrate      # creates all tables, types, RLS policies, seeds task definitions
npm run db:seed:trees   # inserts 600 trees across 4 zones
tsx scripts/seed-users.ts  # creates dummy accounts (see logins below)
npm run dev             # http://localhost:3000
```

---

## 3. Dummy logins

| Role | Email | Password | Notes |
|:---|:---|:---|:---|
| Manager | `manager@farm.local` | `master1234` | Sees dashboard, alerts, workers, trees |
| Worker 1 | `worker1@farm.local` | `1111` | U Aung — zones North-A, North-B |
| Worker 2 | `worker2@farm.local` | `2222` | Daw Khin — zone South-A |
| Worker 3 | `worker3@farm.local` | `3333` | U Min — zone South-B |

Login at [http://localhost:3000/login](http://localhost:3000/login).
The root `/` redirects workers to `/scan` and managers to `/dashboard` automatically.

---

## 4. Pages

### Worker (mobile)
| Path | Purpose |
|---|---|
| `/scan` | QR scanner + manual tree ID entry |
| `/tree/[treeId]` | Tree info, active fruit sets, task list |
| `/tree/[treeId]/task/[taskDefId]` | Task form + optional photo capture |

### Manager (desktop)
| Path | Purpose |
|---|---|
| `/dashboard` | Overview stats, recent alerts, recent logs |
| `/alerts` | Alert list with open/resolved/dismissed filter |
| `/workers` | Worker table with reliability metrics + trust tier |
| `/trees` | Tree table with zone filter + health score |

---

## 5. Test on a phone (HTTPS required for camera)

```bash
npm run dev:https   # generates a self-signed cert, binds to https://localhost:3000
```

Find your Mac's local IP: `ipconfig getifaddr en0`
Open `https://<that-ip>:3000` on your phone (tap through the cert warning).

Or use ngrok:
```bash
brew install ngrok
ngrok http 3000
```

---

## 6. Seeded trees

600 trees across 4 zones, inserted by `npm run db:seed:trees`.

| Zone | Prefix | Tree IDs | Count | QR code format |
|:---|:---|:---|:---:|:---|
| North-A | `NA` | `NA-001` → `NA-150` | 150 | `QR_NA001_v1` … `QR_NA150_v1` |
| North-B | `NB` | `NB-001` → `NB-150` | 150 | `QR_NB001_v1` … `QR_NB150_v1` |
| South-A | `SA` | `SA-001` → `SA-150` | 150 | `QR_SA001_v1` … `QR_SA150_v1` |
| South-B | `SB` | `SB-001` → `SB-150` | 150 | `QR_SB001_v1` … `QR_SB150_v1` |

Varieties randomly assigned: **Monthong**, **Chanee**, **Puangmanee**. All planted `2018-03-15`, status `active`.

---

## 7. QR codes for testing

Each tree has a QR code value of `QR_<prefix><number>_v1` (e.g. `QR_NA001_v1` for tree `NA-001`).
The scan page also has a manual entry field — type a tree ID like `NA-001` directly for desktop testing.

Generate a printable QR:
```bash
npx qrcode "QR_NA001_v1" -o tree-na001.png
```

---

## 8. Deploy to Vercel

Set the same env vars from `.env.local` in **Vercel → Project Settings → Environment Variables**, then connect the GitHub repo. Run `npm run db:migrate` once against production after first deploy.
