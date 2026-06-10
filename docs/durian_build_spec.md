# Durian Farm System — Build Specification

**Companion to:** `durian_system_docs.md` (the conceptual reference)
**Audience:** The team (and coding agents) building the pilot
**Pilot target:** 600 trees, 1–2 months, all three roles stripped down
**Status:** Specification — implementation hasn't started

---

## How to use this document

This is the **implementation contract**. The conceptual doc explains *what and why*; this one defines *how and in what order*.

- **P0 = pilot-blocker.** Must work before launch. ~70% of effort.
- **P1 = pilot-nice-to-have.** Build if time allows; otherwise post-pilot.
- **P2 = post-pilot.** Specified for context but not built now.

If you're a builder reading this top-to-bottom, you can stop at the end of each section and have a complete picture of that subsystem.

---

## Table of Contents

1. [Tech Stack (committed)](#1-tech-stack-committed)
2. [Repository Structure](#2-repository-structure)
3. [Environment Setup](#3-environment-setup)
4. [Database Schema (SQL DDL)](#4-database-schema-sql-ddl)
5. [Row-Level Security Policies](#5-row-level-security-policies)
6. [TypeScript Types](#6-typescript-types)
7. [Authentication (three options)](#7-authentication-three-options)
8. [API Contracts](#8-api-contracts)
9. [Validation Engine](#9-validation-engine)
10. [Task Definitions — Seed Data](#10-task-definitions--seed-data)
11. [Seed Data — Trees, Workers, Protocols](#11-seed-data--trees-workers-protocols)
12. [Worker App — Web-First, LIFF-Compatible](#12-worker-app--web-first-liff-compatible)
13. [Manager Dashboard](#13-manager-dashboard)
14. [Owner Dashboard](#14-owner-dashboard)
15. [Build Order](#15-build-order)
16. [Acceptance Criteria](#16-acceptance-criteria)
17. [Deferred / Out of Scope](#17-deferred--out-of-scope)

---

## 1. Tech Stack (committed)

| Layer | Choice | Notes |
| :--- | :--- | :--- |
| Backend | **Supabase** | Postgres + Auth + Storage + Edge Functions + Realtime |
| Frontend framework | **Next.js 14+ (App Router)** | One repo, three apps (worker, manager, owner) |
| Language | **TypeScript** | Strict mode |
| Styling | **Tailwind CSS** | Design system deferred to team |
| Validation (runtime) | **Zod** | Shared schemas between client and server |
| Forms | **React Hook Form + Zod resolvers** | |
| Data fetching | **TanStack Query (React Query)** | Caching, retries, offline-friendly patterns |
| Maps / GPS | **Browser Geolocation API** | No external map provider for pilot |
| QR scanning | **`html5-qrcode` library** | Camera-based, works on mobile web |
| Camera capture | **`<input type="file" accept="image/*" capture="environment">`** | Native browser, no gallery option |
| EXIF parsing | **`exifr`** | Lightweight, browser-compatible |
| Hosting | **Vercel** | Pairs cleanly with Next.js |
| Worker app delivery | **Web-first, LIFF-compatible** | Add LIFF SDK as a thin wrapper layer; do not depend on LIFF-specific APIs in core logic |

**Why Supabase over Firebase:** Postgres gives you proper SQL, joins, and row-level security policies, which makes the multi-role access control (worker / manager / owner) much cleaner. The schema in this doc is SQL-native.

**Why Next.js for all three apps:** Shared types, shared Supabase client, shared validation. Three separate route groups (`/(worker)`, `/(manager)`, `/(owner)`) keep the bundles separate where it matters.

---

## 2. Repository Structure

```
durian-farm/
├── app/
│   ├── (worker)/                    # Worker PWA routes
│   │   ├── layout.tsx
│   │   ├── login/page.tsx
│   │   ├── tasks/page.tsx           # Task queue
│   │   ├── tasks/[id]/page.tsx      # Task form
│   │   └── scan/page.tsx            # QR scan screen
│   ├── (manager)/
│   │   ├── layout.tsx
│   │   ├── login/page.tsx
│   │   ├── dashboard/page.tsx
│   │   ├── assignments/page.tsx
│   │   ├── alerts/page.tsx
│   │   ├── workers/page.tsx
│   │   ├── trees/page.tsx
│   │   └── task-definitions/page.tsx
│   ├── (owner)/
│   │   ├── layout.tsx
│   │   ├── login/page.tsx
│   │   └── dashboard/page.tsx
│   └── api/
│       ├── logs/route.ts            # POST submission
│       ├── assignments/route.ts
│       └── alerts/route.ts
├── lib/
│   ├── supabase/
│   │   ├── client.ts                # Browser client
│   │   ├── server.ts                # Server client
│   │   └── admin.ts                 # Service-role client (server-only)
│   ├── schemas/                     # Zod schemas (shared)
│   │   ├── task-log.ts
│   │   ├── tree.ts
│   │   ├── set.ts
│   │   └── ...
│   ├── validation/                  # Fraud detection engine
│   │   ├── flags.ts
│   │   ├── timing.ts
│   │   ├── presence.ts
│   │   └── index.ts
│   ├── audit-sampler.ts             # Random photo-audit logic
│   └── i18n/
│       ├── th.json
│       ├── my.json                  # Burmese
│       └── en.json
├── components/
│   ├── worker/                      # Worker-specific (icon-heavy)
│   ├── manager/
│   ├── owner/
│   └── shared/
├── supabase/
│   ├── migrations/                  # SQL migrations (timestamped)
│   ├── seed.sql                     # Seed data for dev/pilot
│   └── functions/                   # Edge functions
│       ├── submit-log/index.ts
│       └── compute-derived-state/index.ts
├── types/
│   ├── database.ts                  # Generated from Supabase
│   └── domain.ts                    # Domain types
├── tests/
│   ├── validation.test.ts
│   └── api.test.ts
├── .env.local.example
├── package.json
└── tsconfig.json
```

---

## 3. Environment Setup

### Prerequisites

- Node.js 20+
- pnpm (preferred) or npm
- Supabase CLI (`npm install -g supabase`)
- A Supabase project (free tier is fine for pilot)

### Environment variables

`.env.local.example`:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=            # Server-only, NEVER expose to browser

# Auth (if using SMS OTP via Twilio)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

# LIFF (if using LINE delivery)
NEXT_PUBLIC_LIFF_ID=

# App config
NEXT_PUBLIC_APP_ENV=development       # development | staging | production
GPS_TOLERANCE_METERS=15
MAX_WALKING_SPEED_KMH=6
```

### First-time setup commands

```bash
pnpm install
supabase login
supabase link --project-ref <project-ref>
supabase db push                      # Apply migrations
supabase db seed                      # Load seed data
pnpm dev
```

---

## 4. Database Schema (SQL DDL)

Full Postgres schema. Each migration file lives in `supabase/migrations/` with timestamped filenames. The order below is the dependency order.

### 4.1 Enums

```sql
CREATE TYPE tree_status AS ENUM ('active', 'retired', 'dead');
CREATE TYPE set_status AS ENUM ('flowering', 'developing', 'harvesting', 'harvested', 'failed');
CREATE TYPE fruit_status AS ENUM ('developing', 'dropped', 'harvested', 'downgraded');
CREATE TYPE fruit_grade AS ENUM ('A', 'B', 'C', 'reject');
CREATE TYPE generation_color AS ENUM ('red', 'blue', 'yellow', 'white');
CREATE TYPE worker_trust_tier AS ENUM ('trusted', 'standard', 'audit');
CREATE TYPE worker_language AS ENUM ('my', 'th', 'en');
CREATE TYPE photo_policy_mode AS ENUM ('always', 'audit_only', 'never');
CREATE TYPE photo_requirement_reason AS ENUM ('task_default', 'random_audit', 'alert_followup', 'none');
CREATE TYPE assignment_source AS ENUM ('recurring', 'alert_triggered', 'manual');
CREATE TYPE assignment_status AS ENUM ('pending', 'in_progress', 'completed', 'overdue', 'skipped');
CREATE TYPE assignment_priority AS ENUM ('low', 'normal', 'high', 'urgent');
CREATE TYPE alert_tier AS ENUM ('tier_1', 'tier_2', 'tier_3');
CREATE TYPE alert_category AS ENUM ('farm_health', 'fraud_signal', 'inactivity', 'compliance');
CREATE TYPE alert_status AS ENUM ('open', 'reviewed', 'resolved', 'dismissed');
CREATE TYPE validation_status AS ENUM ('passed', 'flagged', 'rejected');
CREATE TYPE severity AS ENUM ('none', 'mild', 'moderate', 'severe');
CREATE TYPE leaf_condition AS ENUM ('healthy', 'yellowing', 'wilting', 'necrotic');
CREATE TYPE user_role AS ENUM ('worker', 'manager', 'owner');
```

### 4.2 `users` (extends `auth.users`)

Supabase's `auth.users` handles authentication. We add a `public.users` profile table.

```sql
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_role ON public.users(role);
```

### 4.3 `workers`

```sql
CREATE TABLE public.workers (
  worker_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  language worker_language NOT NULL DEFAULT 'my',
  assigned_zones TEXT[] NOT NULL DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT TRUE,

  -- Reliability metrics (recomputed by background job)
  reliability_last_computed TIMESTAMPTZ,
  reliability_logs_total INTEGER NOT NULL DEFAULT 0,
  reliability_logs_flagged INTEGER NOT NULL DEFAULT 0,
  reliability_flag_rate NUMERIC(5,4) NOT NULL DEFAULT 0.0,
  reliability_avg_completion_seconds NUMERIC(8,2) NOT NULL DEFAULT 0.0,
  trust_tier worker_trust_tier NOT NULL DEFAULT 'audit',  -- New workers start in audit
  trust_tier_set_by TEXT NOT NULL DEFAULT 'system_default',  -- 'system_default' | 'auto_promotion' | 'auto_demotion' | 'manual:<user_id>'
  trust_tier_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_workers_active ON public.workers(active) WHERE active = TRUE;
CREATE INDEX idx_workers_trust_tier ON public.workers(trust_tier);
```

### 4.4 `trees`

```sql
CREATE TABLE public.trees (
  tree_id TEXT PRIMARY KEY,           -- e.g. 'A-104'
  qr_code TEXT NOT NULL UNIQUE,       -- e.g. 'QR_A104_v2'

  lat NUMERIC(10,7) NOT NULL,
  long NUMERIC(10,7) NOT NULL,
  zone TEXT NOT NULL,
  row INTEGER NOT NULL,
  position INTEGER NOT NULL,

  planted_date DATE NOT NULL,
  variety TEXT NOT NULL,
  status tree_status NOT NULL DEFAULT 'active',
  retired_date DATE,

  -- Cached derived state (recomputed on each new task_log for this tree)
  derived_last_updated TIMESTAMPTZ,
  derived_active_set_ids TEXT[] NOT NULL DEFAULT '{}',
  derived_last_maintenance JSONB,     -- {type, date, task_log_id} or NULL
  derived_health_score NUMERIC(3,2) NOT NULL DEFAULT 1.0,
  derived_open_alerts INTEGER NOT NULL DEFAULT 0,
  derived_days_since_last_log INTEGER,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_trees_zone ON public.trees(zone);
CREATE INDEX idx_trees_status ON public.trees(status) WHERE status = 'active';
CREATE INDEX idx_trees_location ON public.trees(lat, long);
CREATE INDEX idx_trees_qr_code ON public.trees(qr_code);
```

### 4.5 `task_definitions`

```sql
CREATE TABLE public.task_definitions (
  task_def_id TEXT PRIMARY KEY,       -- e.g. 'fertilizer_application_v1'
  task_type TEXT NOT NULL,            -- 'fertilizer', 'pest_inspection', etc.

  display_name JSONB NOT NULL,        -- {th, my, en, icon}

  photo_policy_mode photo_policy_mode NOT NULL,
  photo_policy_audit_rates JSONB,     -- {trusted, standard, audit} — NULL if mode != 'audit_only'

  requires_qr_scan BOOLEAN NOT NULL DEFAULT TRUE,
  min_completion_seconds INTEGER NOT NULL DEFAULT 10,
  min_qr_to_submit_seconds INTEGER NOT NULL DEFAULT 15,

  fields JSONB NOT NULL,              -- Array of field objects (see section 10)

  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_task_definitions_active ON public.task_definitions(active) WHERE active = TRUE;
CREATE INDEX idx_task_definitions_type ON public.task_definitions(task_type);
```

### 4.6 `assignments`

```sql
CREATE TABLE public.assignments (
  assignment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES public.workers(worker_id),
  tree_id TEXT NOT NULL REFERENCES public.trees(tree_id),
  task_def_id TEXT NOT NULL REFERENCES public.task_definitions(task_def_id),

  scheduled_for DATE NOT NULL,
  priority assignment_priority NOT NULL DEFAULT 'normal',
  source assignment_source NOT NULL,
  triggered_by_alert_id UUID,         -- FK added after alerts table created

  status assignment_status NOT NULL DEFAULT 'pending',
  completed_log_id UUID,              -- FK added after task_logs table created

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_assignments_worker_date ON public.assignments(worker_id, scheduled_for);
CREATE INDEX idx_assignments_status ON public.assignments(status);
CREATE INDEX idx_assignments_tree ON public.assignments(tree_id);
```

### 4.7 `task_logs`

The most important table. Append-only.

```sql
CREATE TABLE public.task_logs (
  log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tree_id TEXT NOT NULL REFERENCES public.trees(tree_id),
  task_def_id TEXT NOT NULL REFERENCES public.task_definitions(task_def_id),
  task_type TEXT NOT NULL,            -- Denormalized for fast filtering
  assignment_id UUID REFERENCES public.assignments(assignment_id),

  worker_id UUID NOT NULL REFERENCES public.workers(worker_id),
  submitted_at TIMESTAMPTZ NOT NULL,
  form_opened_at TIMESTAMPTZ NOT NULL,

  -- Presence
  qr_scanned_at TIMESTAMPTZ NOT NULL,
  qr_value TEXT NOT NULL,
  gps_lat NUMERIC(10,7),
  gps_long NUMERIC(10,7),
  gps_delta_meters NUMERIC(8,2),

  -- Form data (shape varies by task_def)
  form_data JSONB NOT NULL,

  -- Photo requirement
  photo_required BOOLEAN NOT NULL,
  photo_requirement_reason photo_requirement_reason NOT NULL,
  photo_audit_selection_seed TEXT,

  -- Photo (NULL if not required or not submitted)
  photo_url TEXT,
  photo_exif_timestamp TIMESTAMPTZ,
  photo_exif_lat NUMERIC(10,7),
  photo_exif_long NUMERIC(10,7),
  photo_capture_method TEXT,          -- Always 'camera' if present

  -- Validation
  validation_status validation_status NOT NULL,
  validation_flags TEXT[] NOT NULL DEFAULT '{}',

  -- Notes
  notes_audio_url TEXT,
  notes_text TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Append-only enforcement: no UPDATEs or DELETEs except by service role
CREATE INDEX idx_task_logs_tree_submitted ON public.task_logs(tree_id, submitted_at DESC);
CREATE INDEX idx_task_logs_worker_submitted ON public.task_logs(worker_id, submitted_at DESC);
CREATE INDEX idx_task_logs_task_type ON public.task_logs(task_type);
CREATE INDEX idx_task_logs_validation_status ON public.task_logs(validation_status) WHERE validation_status != 'passed';
CREATE INDEX idx_task_logs_submitted_at ON public.task_logs(submitted_at DESC);

-- Now add the deferred FK on assignments
ALTER TABLE public.assignments
  ADD CONSTRAINT fk_assignments_completed_log
  FOREIGN KEY (completed_log_id) REFERENCES public.task_logs(log_id);
```

### 4.8 `sets`

```sql
CREATE TABLE public.sets (
  set_id TEXT PRIMARY KEY,            -- e.g. 'set_a104_2026_red'
  tree_id TEXT NOT NULL REFERENCES public.trees(tree_id),
  color generation_color NOT NULL,
  season TEXT NOT NULL,               -- e.g. '2026-main'

  bloom_log_id UUID NOT NULL REFERENCES public.task_logs(log_id),
  bloom_date DATE NOT NULL,
  estimated_maturation_days INTEGER NOT NULL DEFAULT 120,
  harvest_window_start DATE NOT NULL,
  harvest_window_end DATE NOT NULL,

  initial_fruit_count INTEGER NOT NULL,
  current_fruit_count INTEGER NOT NULL,
  premium_fruit_count INTEGER NOT NULL DEFAULT 0,

  status set_status NOT NULL DEFAULT 'flowering',
  harvest_log_ids UUID[] NOT NULL DEFAULT '{}',
  harvested_at TIMESTAMPTZ,

  -- Denormalized history (authoritative copy is in task_logs)
  history JSONB NOT NULL DEFAULT '[]',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Same color cannot be active twice on one tree in one season
  CONSTRAINT unique_active_set_per_tree_color_season
    UNIQUE (tree_id, color, season)
);

CREATE INDEX idx_sets_tree ON public.sets(tree_id);
CREATE INDEX idx_sets_status ON public.sets(status);
CREATE INDEX idx_sets_harvest_window ON public.sets(harvest_window_start, harvest_window_end);
```

### 4.9 `fruits` (P1 — deferred to post-pilot)

Specified for context, not created in pilot migration.

```sql
-- DEFERRED: Grade A tagging is post-pilot
-- CREATE TABLE public.fruits (...);
```

### 4.10 `alerts`

```sql
CREATE TABLE public.alerts (
  alert_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier alert_tier NOT NULL,
  category alert_category NOT NULL,
  subtype TEXT NOT NULL,

  tree_id TEXT REFERENCES public.trees(tree_id),
  worker_id UUID REFERENCES public.workers(worker_id),
  triggered_by_log_id UUID REFERENCES public.task_logs(log_id),

  status alert_status NOT NULL DEFAULT 'open',
  resolution JSONB,                   -- {action_taken, resolved_by, resolved_at, notes}
  suggested_response_task_def_id TEXT REFERENCES public.task_definitions(task_def_id),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_alerts_open ON public.alerts(tier, created_at DESC) WHERE status = 'open';
CREATE INDEX idx_alerts_tree ON public.alerts(tree_id) WHERE status = 'open';
CREATE INDEX idx_alerts_worker ON public.alerts(worker_id) WHERE status = 'open';

-- Now add the deferred FK on assignments
ALTER TABLE public.assignments
  ADD CONSTRAINT fk_assignments_alert
  FOREIGN KEY (triggered_by_alert_id) REFERENCES public.alerts(alert_id);
```

### 4.11 `protocols`

```sql
CREATE TABLE public.protocols (
  protocol_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_subtype TEXT NOT NULL,
  response_task_def_id TEXT NOT NULL REFERENCES public.task_definitions(task_def_id),
  description JSONB NOT NULL,         -- {th, en}
  active BOOLEAN NOT NULL DEFAULT TRUE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_active_protocol_per_subtype
    UNIQUE (alert_subtype, active)
    DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX idx_protocols_subtype ON public.protocols(alert_subtype) WHERE active = TRUE;
```

### 4.12 `updated_at` triggers

```sql
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at:
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_workers_updated_at BEFORE UPDATE ON public.workers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_trees_updated_at BEFORE UPDATE ON public.trees
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_task_definitions_updated_at BEFORE UPDATE ON public.task_definitions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_assignments_updated_at BEFORE UPDATE ON public.assignments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_sets_updated_at BEFORE UPDATE ON public.sets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_protocols_updated_at BEFORE UPDATE ON public.protocols
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

---

## 5. Row-Level Security Policies

Supabase RLS is how the three roles are enforced. **Enable RLS on every table.** Default deny; allow only what's specified.

### 5.1 Helper functions

```sql
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS user_role AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_worker()
RETURNS BOOLEAN AS $$
  SELECT public.current_user_role() = 'worker';
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_manager()
RETURNS BOOLEAN AS $$
  SELECT public.current_user_role() = 'manager';
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS BOOLEAN AS $$
  SELECT public.current_user_role() = 'owner';
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.worker_zones(worker_uuid UUID)
RETURNS TEXT[] AS $$
  SELECT assigned_zones FROM public.workers WHERE worker_id = worker_uuid;
$$ LANGUAGE sql SECURITY DEFINER STABLE;
```

### 5.2 Policies per table

```sql
-- users: everyone reads own row; managers/owners read all
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY users_read_own ON public.users FOR SELECT
  USING (id = auth.uid());
CREATE POLICY users_read_all_for_staff ON public.users FOR SELECT
  USING (public.is_manager() OR public.is_owner());

-- workers: workers read own row; managers/owners read all
ALTER TABLE public.workers ENABLE ROW LEVEL SECURITY;
CREATE POLICY workers_read_own ON public.workers FOR SELECT
  USING (worker_id = auth.uid());
CREATE POLICY workers_read_all_for_staff ON public.workers FOR SELECT
  USING (public.is_manager() OR public.is_owner());
CREATE POLICY workers_update_by_manager ON public.workers FOR UPDATE
  USING (public.is_manager());

-- trees: workers read trees in assigned zones; managers/owners read all
ALTER TABLE public.trees ENABLE ROW LEVEL SECURITY;
CREATE POLICY trees_read_for_workers ON public.trees FOR SELECT
  USING (
    public.is_worker() AND
    zone = ANY(public.worker_zones(auth.uid()))
  );
CREATE POLICY trees_read_for_staff ON public.trees FOR SELECT
  USING (public.is_manager() OR public.is_owner());
CREATE POLICY trees_write_by_manager ON public.trees FOR ALL
  USING (public.is_manager());

-- task_definitions: everyone reads active; only managers write
ALTER TABLE public.task_definitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY task_defs_read_active ON public.task_definitions FOR SELECT
  USING (active = TRUE OR public.is_manager() OR public.is_owner());
CREATE POLICY task_defs_write_by_manager ON public.task_definitions FOR ALL
  USING (public.is_manager());

-- assignments: workers read own; managers/owners read all; managers write
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY assignments_read_own ON public.assignments FOR SELECT
  USING (worker_id = auth.uid());
CREATE POLICY assignments_read_all_for_staff ON public.assignments FOR SELECT
  USING (public.is_manager() OR public.is_owner());
CREATE POLICY assignments_write_by_manager ON public.assignments FOR ALL
  USING (public.is_manager());

-- task_logs: workers INSERT only (through edge function); read own;
-- managers/owners read all. NO updates or deletes by anyone (append-only).
ALTER TABLE public.task_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY task_logs_read_own ON public.task_logs FOR SELECT
  USING (worker_id = auth.uid());
CREATE POLICY task_logs_read_all_for_staff ON public.task_logs FOR SELECT
  USING (public.is_manager() OR public.is_owner());
-- INSERTs happen via service role through the submit-log edge function only.
-- No CREATE POLICY for INSERT/UPDATE/DELETE — blocks everything except service role.

-- sets: workers read sets on accessible trees; managers/owners read all
ALTER TABLE public.sets ENABLE ROW LEVEL SECURITY;
CREATE POLICY sets_read_for_workers ON public.sets FOR SELECT
  USING (
    public.is_worker() AND
    tree_id IN (SELECT tree_id FROM public.trees WHERE zone = ANY(public.worker_zones(auth.uid())))
  );
CREATE POLICY sets_read_all_for_staff ON public.sets FOR SELECT
  USING (public.is_manager() OR public.is_owner());
-- Writes via edge function only.

-- alerts: managers/owners read; managers update
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY alerts_read_for_staff ON public.alerts FOR SELECT
  USING (public.is_manager() OR public.is_owner());
CREATE POLICY alerts_update_by_manager ON public.alerts FOR UPDATE
  USING (public.is_manager());
-- INSERTs via edge function only.

-- protocols: managers/owners read; managers write
ALTER TABLE public.protocols ENABLE ROW LEVEL SECURITY;
CREATE POLICY protocols_read_for_staff ON public.protocols FOR SELECT
  USING (public.is_manager() OR public.is_owner());
CREATE POLICY protocols_write_by_manager ON public.protocols FOR ALL
  USING (public.is_manager());
```

---

## 6. TypeScript Types

Live in `lib/schemas/` as Zod schemas. Inferred TypeScript types are derived from these.

### 6.1 Shared primitives

```typescript
// lib/schemas/primitives.ts
import { z } from "zod";

export const GpsCoordSchema = z.object({
  lat: z.number().min(-90).max(90),
  long: z.number().min(-180).max(180),
});

export const I18nStringSchema = z.object({
  th: z.string(),
  my: z.string(),
  en: z.string(),
});

export const SeveritySchema = z.enum(["none", "mild", "moderate", "severe"]);
export const GenerationColorSchema = z.enum(["red", "blue", "yellow", "white"]);
export const FruitGradeSchema = z.enum(["A", "B", "C", "reject"]);
export const TrustTierSchema = z.enum(["trusted", "standard", "audit"]);
```

### 6.2 Task definition

```typescript
// lib/schemas/task-definition.ts
import { z } from "zod";
import { I18nStringSchema, TrustTierSchema } from "./primitives";

export const FieldTypeSchema = z.enum([
  "numeric_counter",
  "dropdown",
  "slider",
  "color_picker",
  "severity_picker",
]);

export const TaskFieldSchema = z.object({
  field_id: z.string(),
  type: FieldTypeSchema,
  label_icon: z.string(),
  label: I18nStringSchema,
  required: z.boolean(),

  // numeric
  min: z.number().optional(),
  max: z.number().optional(),
  warn_below: z.number().optional(),
  warn_above: z.number().optional(),
  step: z.number().optional(),

  // dropdown
  options: z.array(z.object({
    value: z.string(),
    icon: z.string(),
    label: I18nStringSchema,
  })).optional(),
});

export const PhotoPolicySchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("always") }),
  z.object({ mode: z.literal("never") }),
  z.object({
    mode: z.literal("audit_only"),
    audit_rate_by_tier: z.object({
      trusted: z.number().min(0).max(1),
      standard: z.number().min(0).max(1),
      audit: z.number().min(0).max(1),
    }),
  }),
]);

export const TaskDefinitionSchema = z.object({
  task_def_id: z.string(),
  task_type: z.string(),
  display_name: z.object({
    th: z.string(),
    my: z.string(),
    en: z.string(),
    icon: z.string(),
  }),
  photo_policy: PhotoPolicySchema,
  requires_qr_scan: z.boolean(),
  min_completion_seconds: z.number().int().nonnegative(),
  min_qr_to_submit_seconds: z.number().int().nonnegative(),
  fields: z.array(TaskFieldSchema),
  active: z.boolean(),
});

export type TaskDefinition = z.infer<typeof TaskDefinitionSchema>;
```

### 6.3 Task log submission

```typescript
// lib/schemas/task-log.ts
import { z } from "zod";
import { GpsCoordSchema } from "./primitives";

export const TaskLogSubmissionSchema = z.object({
  // Required for all submissions
  tree_id: z.string(),
  task_def_id: z.string(),
  assignment_id: z.string().uuid().nullable(),

  submitted_at: z.string().datetime(),
  form_opened_at: z.string().datetime(),

  qr_scanned_at: z.string().datetime(),
  qr_value: z.string(),
  gps: GpsCoordSchema.nullable(),     // null if permission denied

  form_data: z.record(z.unknown()),   // Validated against task_def.fields at server

  // Photo (null if not required)
  photo: z.object({
    url: z.string().url(),            // Already uploaded to Supabase Storage
    exif_timestamp: z.string().datetime().nullable(),
    exif_gps: GpsCoordSchema.nullable(),
  }).nullable(),

  notes_audio_url: z.string().url().nullable(),
  notes_text: z.string().nullable(),
});

export type TaskLogSubmission = z.infer<typeof TaskLogSubmissionSchema>;
```

### 6.4 Database row types

Use `supabase gen types typescript` to generate `types/database.ts`. Run after each migration. These are the authoritative DB row types.

```bash
supabase gen types typescript --project-id <project-ref> > types/database.ts
```

---

## 7. Authentication (three options)

Auth is unresolved. The spec lays out all three so the team can decide before implementation.

### 7.1 Option A — Phone + SMS OTP (recommended for workers)

- Worker enters phone number → receives 6-digit SMS code → enters code → logged in.
- Supabase has native support: `supabase.auth.signInWithOtp({ phone })`.
- Requires Twilio (or equivalent SMS provider) configured in Supabase project settings.
- Cost: ~$0.04 per SMS in Thailand. ~$0.20/worker/month at one login per week.

**Pros:** Zero technical knowledge required. Workers don't need email.
**Cons:** Requires SMS provider setup. Some workers may not have stable phone numbers.

### 7.2 Option B — Worker ID + 4-digit PIN

- Manager creates worker record, system generates a 4-digit worker ID and a 4-digit PIN.
- Worker enters both on login screen.
- Custom auth (not Supabase native) — requires implementing a sign-in edge function that validates and issues a Supabase session token.

**Pros:** No SMS cost. Works without phone numbers.
**Cons:** Custom auth code (security risk if implemented wrong). Workers must remember PIN. PIN reset requires manager intervention.

### 7.3 Option C — LINE login (if committing to LIFF)

- If the worker app is delivered as a LIFF mini-app, LINE handles auth.
- LIFF SDK provides a user ID; the backend trusts it and creates a Supabase session.

**Pros:** Zero friction — already logged into LINE.
**Cons:** Locks you into LIFF. LIFF setup requires a LINE Developer account and a registered LINE Official Account.

### 7.4 Manager and owner auth

For both — **email + password** via Supabase native auth. Both roles are technical enough to handle this; no benefit from PIN or SMS.

### 7.5 Recommendation

Implement **Option A (Phone OTP) for workers** + **email/password for managers and owners**. This is the path of least resistance and gives the best worker UX. If SMS cost is prohibitive in production, switch to Option B post-pilot.

Mark the worker auth implementation behind an interface so swapping providers later doesn't require rewriting flows.

---

## 8. API Contracts

The backend exposes two patterns:
1. **Direct Supabase client queries** with RLS — for most read paths.
2. **Edge Functions** — for writes that need server-side validation (anything that writes to `task_logs`, `sets`, `alerts`).

### 8.1 `POST /functions/v1/submit-log` — Submit a task log

**Auth:** Worker session required.

**Request body:** `TaskLogSubmission` (see section 6.3).

**Flow:**
1. Authenticate worker via Supabase JWT.
2. Validate body against `TaskLogSubmissionSchema`.
3. Fetch task_definition; validate `form_data` against its `fields`.
4. Compute server-side fields:
   - `gps_delta_meters` from worker GPS vs. tree location.
   - `task_type` from task_def.
   - `photo_required` and `photo_requirement_reason` — must match what the server originally told the client when the assignment was fetched.
5. Run validation engine (section 9). Compute `validation_status` and `validation_flags`.
6. If `validation_status === 'rejected'`, return 400 with reason.
7. INSERT into `task_logs`.
8. If a `bloom_log` task: also INSERT into `sets`.
9. If task type implies alerts: INSERT into `alerts`.
10. Trigger derived state recompute (async).
11. Return the created log.

**Response (200):**
```json
{
  "log_id": "uuid",
  "validation_status": "passed" | "flagged",
  "validation_flags": ["..."],
  "alerts_created": ["..."]
}
```

**Response (400):**
```json
{
  "error": "validation_rejected",
  "details": { "field": "ph", "reason": "value out of hard range" }
}
```

### 8.2 `GET /api/assignments/today` — Worker's task queue

**Auth:** Worker session.

**Returns:** Array of assignments for today, with embedded task_definition and tree summary. The server attaches `photo_required` (with audit sampler decision) for each assignment so the client knows ahead of time which need photos.

```json
[
  {
    "assignment_id": "uuid",
    "tree": { "tree_id": "A-104", "zone": "North-A", "lat": ..., "long": ... },
    "task_definition": { ... },
    "photo_required": true,
    "photo_requirement_reason": "random_audit",
    "audit_selection_seed": "a3f8b2",
    "priority": "normal",
    "status": "pending"
  }
]
```

The audit sampler decision is made here and persisted in a short-lived `assignment_audit_decisions` cache (or directly in the assignment record). When the worker submits, the server cross-checks the decision matches.

### 8.3 `POST /functions/v1/upload-photo` — Photo upload

**Auth:** Worker session.

**Body:** `multipart/form-data` with the image file.

**Flow:**
1. Validate file is an image (MIME check + size <10MB).
2. Upload to Supabase Storage bucket `task-photos/`.
3. Return the storage URL.

The worker app uploads the photo first (gets a URL), then includes that URL in the `submit-log` call. This separation lets the photo upload happen in parallel with form filling.

### 8.4 `GET /api/dashboard/manager/overview` — Manager dashboard summary

**Auth:** Manager session.

**Returns:** Aggregated state for the dashboard home screen: open alerts by tier, today's task completion rate, trees with no recent logs, etc.

### 8.5 `GET /api/dashboard/owner/overview` — Owner dashboard summary

**Auth:** Owner session.

**Returns:** High-level farm state: total active sets, harvest window summary, alert counts, zone health scores.

---

## 9. Validation Engine

The validation engine runs in the `submit-log` edge function. Each check is a small pure function returning either `null` (pass) or a flag code (fail).

### 9.1 Engine signature

```typescript
// lib/validation/index.ts
import { TaskLogSubmission, TaskDefinition, Tree, Worker } from "@/types/domain";

type ValidationContext = {
  submission: TaskLogSubmission;
  taskDef: TaskDefinition;
  tree: Tree;
  worker: Worker;
  previousLog: { submitted_at: string; gps_lat: number; gps_long: number } | null;
  recentSubmissionCount: number;     // count from this worker in last 5 min
};

type ValidationResult = {
  status: "passed" | "flagged" | "rejected";
  flags: string[];
};

export function validateSubmission(ctx: ValidationContext): ValidationResult;
```

### 9.2 Checks

Each check lives in `lib/validation/<category>.ts`. Listed by flag code:

**Layer 1 — Presence**
- `qr_mismatch` — `submission.qr_value !== tree.qr_code` → flag.
- `gps_missing` — `submission.gps === null` → flag.
- `gps_off_tree` — `haversine(submission.gps, tree.location) > GPS_TOLERANCE_METERS` → flag.

**Layer 2 — Timing**
- `completion_too_fast` — `(submitted_at - form_opened_at) < taskDef.min_completion_seconds` → flag.
- `qr_to_submit_too_fast` — `(submitted_at - qr_scanned_at) < taskDef.min_qr_to_submit_seconds` → flag.
- `impossible_travel` — if `previousLog` exists, compute implied speed in km/h. If > `MAX_WALKING_SPEED_KMH` → flag.
- `bulk_submission` — if `recentSubmissionCount >= 20` → flag.

**Layer 3 — Photo (if photo present)**
- `exif_missing` — `submission.photo && submission.photo.exif_timestamp === null` → flag.
- `exif_timestamp_mismatch` — `|photo.exif_timestamp - submitted_at| > 2 minutes` → flag.
- `exif_gps_mismatch` — `haversine(photo.exif_gps, tree.location) > GPS_TOLERANCE_METERS` → flag.

**Layer 4 — Input bounds**
- For each numeric field in `taskDef.fields`:
  - If value `< min` or `> max` → **reject** (not just flag). Return early with status `rejected`.
  - If value `< warn_below` or `> warn_above` → flag `value_out_of_warn_range:<field_id>`.

### 9.3 Status determination

```typescript
function determineStatus(flags: string[]): "passed" | "flagged" {
  return flags.length === 0 ? "passed" : "flagged";
}
```

(`rejected` is returned early before this function is called.)

### 9.4 Behavioral checks (background job, not in submit path)

Run nightly via Supabase cron:
- `suspicious_always_clean` — worker has 30+ logs in last 30 days, all with severity=none on pest/disease, while their zone has >5 mild+ reports from other workers.
- `unusual_volume_spike` — worker's daily log count is >3× their 14-day median.

These create Tier 2 alerts, not log-level flags.

---

## 10. Task Definitions — Seed Data

Five task definitions for the pilot. Insert into `task_definitions` via seed migration.

### 10.1 `fertilizer_application_v1`

```json
{
  "task_def_id": "fertilizer_application_v1",
  "task_type": "fertilizer",
  "display_name": {
    "th": "ใส่ปุ๋ย",
    "my": "မြေဩဇာထည့်ခြင်း",
    "en": "Fertilizer application",
    "icon": "fertilizer_bag"
  },
  "photo_policy": {
    "mode": "audit_only",
    "audit_rate_by_tier": { "trusted": 0.01, "standard": 0.05, "audit": 0.15 }
  },
  "requires_qr_scan": true,
  "min_completion_seconds": 12,
  "min_qr_to_submit_seconds": 20,
  "fields": [
    {
      "field_id": "fertilizer_type",
      "type": "dropdown",
      "label_icon": "fertilizer_bag",
      "label": { "th": "ชนิดปุ๋ย", "my": "မြေဩဇာအမျိုးအစား", "en": "Fertilizer type" },
      "required": true,
      "options": [
        { "value": "NPK-16-16-16", "icon": "npk_balanced", "label": { "th": "NPK 16-16-16", "my": "NPK 16-16-16", "en": "NPK 16-16-16" } },
        { "value": "NPK-8-24-24", "icon": "npk_bloom", "label": { "th": "NPK 8-24-24", "my": "NPK 8-24-24", "en": "NPK 8-24-24" } },
        { "value": "organic_compost", "icon": "compost", "label": { "th": "ปุ๋ยหมัก", "my": "မြေဩဇာ", "en": "Organic compost" } }
      ]
    },
    {
      "field_id": "amount_kg",
      "type": "numeric_counter",
      "label_icon": "weight_kg",
      "label": { "th": "ปริมาณ (กก.)", "my": "ပမာဏ (ကီလို)", "en": "Amount (kg)" },
      "required": true,
      "min": 0, "max": 50, "warn_above": 20, "step": 0.5
    }
  ]
}
```

### 10.2 `watering_v1`

```json
{
  "task_def_id": "watering_v1",
  "task_type": "watering",
  "display_name": {
    "th": "รดน้ำ", "my": "ရေလောင်းခြင်း", "en": "Watering", "icon": "water_drop"
  },
  "photo_policy": {
    "mode": "audit_only",
    "audit_rate_by_tier": { "trusted": 0.01, "standard": 0.05, "audit": 0.15 }
  },
  "requires_qr_scan": true,
  "min_completion_seconds": 8,
  "min_qr_to_submit_seconds": 15,
  "fields": [
    {
      "field_id": "duration_minutes",
      "type": "numeric_counter",
      "label_icon": "clock",
      "label": { "th": "ระยะเวลา (นาที)", "my": "အချိန် (မိနစ်)", "en": "Duration (minutes)" },
      "required": true,
      "min": 0, "max": 120, "warn_above": 60, "step": 5
    }
  ]
}
```

### 10.3 `bloom_log_v1`

```json
{
  "task_def_id": "bloom_log_v1",
  "task_type": "bloom_log",
  "display_name": {
    "th": "บันทึกการออกดอก", "my": "ပန်းပွင့်မှတ်တမ်း", "en": "Bloom logging", "icon": "flower"
  },
  "photo_policy": { "mode": "always" },
  "requires_qr_scan": true,
  "min_completion_seconds": 15,
  "min_qr_to_submit_seconds": 25,
  "fields": [
    {
      "field_id": "color",
      "type": "color_picker",
      "label_icon": "color_swatch",
      "label": { "th": "สี", "my": "အရောင်", "en": "Color" },
      "required": true,
      "options": [
        { "value": "red", "icon": "red_block", "label": { "th": "แดง", "my": "အနီ", "en": "Red" } },
        { "value": "blue", "icon": "blue_block", "label": { "th": "น้ำเงิน", "my": "အပြာ", "en": "Blue" } },
        { "value": "yellow", "icon": "yellow_block", "label": { "th": "เหลือง", "my": "အဝါ", "en": "Yellow" } },
        { "value": "white", "icon": "white_block", "label": { "th": "ขาว", "my": "အဖြူ", "en": "White" } }
      ]
    },
    {
      "field_id": "flower_count",
      "type": "numeric_counter",
      "label_icon": "flower",
      "label": { "th": "จำนวนดอก", "my": "ပန်းအရေအတွက်", "en": "Flower count" },
      "required": true,
      "min": 0, "max": 500, "warn_above": 200, "step": 1
    }
  ]
}
```

### 10.4 `pest_inspection_v1`

```json
{
  "task_def_id": "pest_inspection_v1",
  "task_type": "pest_inspection",
  "display_name": {
    "th": "ตรวจหาศัตรูพืช", "my": "ပိုးမွှားစစ်ဆေးခြင်း", "en": "Pest inspection", "icon": "bug"
  },
  "photo_policy": { "mode": "always" },
  "requires_qr_scan": true,
  "min_completion_seconds": 15,
  "min_qr_to_submit_seconds": 25,
  "fields": [
    {
      "field_id": "severity",
      "type": "severity_picker",
      "label_icon": "severity_meter",
      "label": { "th": "ความรุนแรง", "my": "ပြင်းထန်မှု", "en": "Severity" },
      "required": true,
      "options": [
        { "value": "none", "icon": "check_circle", "label": { "th": "ไม่พบ", "my": "မရှိ", "en": "None" } },
        { "value": "mild", "icon": "warning_light", "label": { "th": "เล็กน้อย", "my": "အနည်းငယ်", "en": "Mild" } },
        { "value": "moderate", "icon": "warning_medium", "label": { "th": "ปานกลาง", "my": "အလယ်အလတ်", "en": "Moderate" } },
        { "value": "severe", "icon": "warning_severe", "label": { "th": "รุนแรง", "my": "ပြင်းထန်", "en": "Severe" } }
      ]
    }
  ]
}
```

### 10.5 `soil_acidity_check_v1`

```json
{
  "task_def_id": "soil_acidity_check_v1",
  "task_type": "soil_check",
  "display_name": {
    "th": "ตรวจค่ากรดดิน", "my": "မြေဆီလွှာစစ်ဆေးခြင်း", "en": "Soil acidity check", "icon": "soil_ph"
  },
  "photo_policy": {
    "mode": "audit_only",
    "audit_rate_by_tier": { "trusted": 0.01, "standard": 0.05, "audit": 0.15 }
  },
  "requires_qr_scan": true,
  "min_completion_seconds": 15,
  "min_qr_to_submit_seconds": 25,
  "fields": [
    {
      "field_id": "ph",
      "type": "numeric_counter",
      "label_icon": "ph_meter",
      "label": { "th": "ค่า pH", "my": "pH တန်ဖိုး", "en": "pH" },
      "required": true,
      "min": 3.5, "max": 8.0, "warn_below": 4.5, "warn_above": 7.5, "step": 0.1
    },
    {
      "field_id": "moisture_pct",
      "type": "numeric_counter",
      "label_icon": "water_drop",
      "label": { "th": "ความชื้น (%)", "my": "စိုထိုင်းမှု (%)", "en": "Moisture (%)" },
      "required": true,
      "min": 0, "max": 100, "warn_above": 90, "step": 1
    }
  ]
}
```

### 10.6 `harvest_log_v1`

```json
{
  "task_def_id": "harvest_log_v1",
  "task_type": "harvest",
  "display_name": {
    "th": "บันทึกการเก็บเกี่ยว", "my": "ရိတ်သိမ်းမှတ်တမ်း", "en": "Harvest logging", "icon": "harvest_basket"
  },
  "photo_policy": { "mode": "always" },
  "requires_qr_scan": true,
  "min_completion_seconds": 20,
  "min_qr_to_submit_seconds": 30,
  "fields": [
    {
      "field_id": "set_color",
      "type": "color_picker",
      "label_icon": "color_swatch",
      "label": { "th": "สีของชุด", "my": "အရောင်", "en": "Set color" },
      "required": true,
      "options": [
        { "value": "red", "icon": "red_block", "label": { "th": "แดง", "my": "အနီ", "en": "Red" } },
        { "value": "blue", "icon": "blue_block", "label": { "th": "น้ำเงิน", "my": "အပြာ", "en": "Blue" } },
        { "value": "yellow", "icon": "yellow_block", "label": { "th": "เหลือง", "my": "အဝါ", "en": "Yellow" } },
        { "value": "white", "icon": "white_block", "label": { "th": "ขาว", "my": "အဖြူ", "en": "White" } }
      ]
    },
    {
      "field_id": "fruit_count",
      "type": "numeric_counter",
      "label_icon": "fruit",
      "label": { "th": "จำนวนผล", "my": "သီးအရေအတွက်", "en": "Fruit count" },
      "required": true,
      "min": 0, "max": 200, "step": 1
    },
    {
      "field_id": "grade",
      "type": "dropdown",
      "label_icon": "star",
      "label": { "th": "เกรด", "my": "အဆင့်", "en": "Grade" },
      "required": true,
      "options": [
        { "value": "A", "icon": "grade_a", "label": { "th": "A", "my": "A", "en": "A" } },
        { "value": "B", "icon": "grade_b", "label": { "th": "B", "my": "B", "en": "B" } },
        { "value": "C", "icon": "grade_c", "label": { "th": "C", "my": "C", "en": "C" } },
        { "value": "reject", "icon": "grade_reject", "label": { "th": "ไม่ผ่าน", "my": "ပယ်ဖျက်", "en": "Reject" } }
      ]
    }
  ]
}
```

---

## 11. Seed Data — Trees, Workers, Protocols

### 11.1 Trees (sample for pilot)

Generate 600 tree records spread across 4 zones (`North-A`, `North-B`, `South-A`, `South-B`). Use a script:

```typescript
// supabase/seed-trees.ts
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

const ZONES = ["North-A", "North-B", "South-A", "South-B"];
const TREES_PER_ZONE = 150;
const BASE_LAT = 18.7000;
const BASE_LONG = 98.9000;

async function seed() {
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const trees = [];
  for (const zone of ZONES) {
    for (let row = 1; row <= 15; row++) {
      for (let pos = 1; pos <= 10; pos++) {
        const zoneLetter = zone.split("-")[1];
        const treeNum = (row - 1) * 10 + pos;
        const tree_id = `${zoneLetter}-${treeNum.toString().padStart(3, "0")}`;
        trees.push({
          tree_id,
          qr_code: `QR_${tree_id}_v1`,
          lat: BASE_LAT + (row * 0.00005) + (Math.random() * 0.00001),
          long: BASE_LONG + (pos * 0.00005) + (Math.random() * 0.00001),
          zone, row, position: pos,
          planted_date: "2018-03-15",
          variety: "Monthong",
          status: "active",
        });
      }
    }
  }

  const { error } = await supabase.from("trees").insert(trees);
  if (error) throw error;
  console.log(`Seeded ${trees.length} trees`);
}

seed();
```

### 11.2 Workers (sample for pilot)

Three workers, one manager, one owner.

```sql
-- These must be created via Supabase Auth first (manually or via script);
-- the auth.users IDs go into public.users and public.workers.

INSERT INTO public.users (id, role, display_name) VALUES
  ('<auth-uuid-1>', 'worker', 'U Aung'),
  ('<auth-uuid-2>', 'worker', 'Daw Khin'),
  ('<auth-uuid-3>', 'worker', 'U Min'),
  ('<auth-uuid-4>', 'manager', 'K. Nong'),
  ('<auth-uuid-5>', 'owner', 'Khun Sirichai');

INSERT INTO public.workers (worker_id, language, assigned_zones, trust_tier) VALUES
  ('<auth-uuid-1>', 'my', ARRAY['North-A', 'North-B'], 'audit'),
  ('<auth-uuid-2>', 'my', ARRAY['South-A'], 'audit'),
  ('<auth-uuid-3>', 'my', ARRAY['South-B'], 'audit');
```

### 11.3 Protocols (seed)

```sql
INSERT INTO public.protocols (alert_subtype, response_task_def_id, description, active) VALUES
  ('severe_pest', 'pest_inspection_v1', '{"th": "ตรวจซ้ำหลังพบศัตรูพืชระดับรุนแรง", "en": "Re-inspect after severe pest report"}', TRUE),
  ('severe_disease', 'pest_inspection_v1', '{"th": "ตรวจซ้ำหลังพบโรคระดับรุนแรง", "en": "Re-inspect after severe disease report"}', TRUE);
```

(The protocol library is intentionally thin for the pilot — K. Nong adds more as patterns emerge.)

---

## 12. Worker App — Web-First, LIFF-Compatible

### 12.1 Architecture

The worker app is a Next.js route group `/(worker)/*`. It works as a standard mobile web page **and** as a LIFF mini-app, depending on how it's accessed.

**Core principle:** No code in business logic depends on LIFF. LIFF integration is a thin adapter layer that, when present, augments behavior (e.g. provides LINE user ID for auth) but never breaks plain web access.

```
lib/liff/
  detect.ts                      # isLiffEnvironment(): boolean
  init.ts                        # initLiffIfPresent(): Promise<LiffUser | null>
  auth-bridge.ts                 # If LIFF user present, exchange for Supabase session
```

### 12.2 Screens (P0)

1. **`/login`** — Phone OTP (or PIN, or LINE — depending on auth choice).
2. **`/tasks`** — Today's assigned tasks, grouped by tree, sorted by priority.
3. **`/tasks/[id]`** — Task detail. Locked until QR scan completes.
4. **`/scan`** — QR scanner (using `html5-qrcode`). Validates against expected tree.
5. **`/tasks/[id]/photo`** — Camera capture (only shown if photo required).
6. **`/tasks/[id]/submit`** — Review and submit.

### 12.3 State machine for task completion

```
[VIEWING_QUEUE]
   ↓ tap task
[TASK_SELECTED] (showing task summary + scan prompt)
   ↓ tap scan
[SCANNING] (camera open)
   ↓ scan QR
   ├─ QR matches expected tree → [FORM_OPEN] (record form_opened_at)
   └─ QR doesn't match → show "wrong tree" warning, stay in SCANNING
   ↓ fill form
[FORM_FILLED]
   ↓ photo required?
   ├─ yes → [CAMERA_OPEN] → take photo → upload → [READY_TO_SUBMIT]
   └─ no → [READY_TO_SUBMIT]
   ↓ tap submit
[SUBMITTING]
   ↓ server response
   ├─ success → [COMPLETE] → return to [VIEWING_QUEUE]
   └─ rejection → show error, return to [FORM_FILLED]
```

### 12.4 Critical client-side rules

- **GPS capture starts on app open**, not on submit. Permission prompt on first launch.
- **EXIF reading happens client-side** (using `exifr`) before upload, so the photo can be rejected immediately if EXIF is missing.
- **`form_opened_at` timestamp is set after QR scan succeeds**, not when the page loads — the scan gate is what defines "form opened".
- **No gallery uploads under any circumstances**. The `<input>` must have `capture="environment"` and the file picker fallback must be blocked at the UI level (no file input visible without `capture`).

### 12.5 Out of scope for pilot

- Voice notes (P1).
- Offline queueing / service worker (deferred per pilot scope decision).
- Push notifications to workers (P1).
- LIFF rich features (group sharing, etc.) — only auth bridge is in scope.

---

## 13. Manager Dashboard

### 13.1 Screens (P0)

1. **`/dashboard`** — Overview: open alerts by tier, today's completion rate, farm health summary.
2. **`/assignments`** — Create assignments, view today's queue, override/reassign.
3. **`/alerts`** — Triage open alerts. Tier 1 at top. One-tap "assign response task" for any alert with a matching protocol.
4. **`/workers`** — Worker list with reliability metrics and trust tier. Manual trust tier override.
5. **`/trees`** — Tree list filtered by zone, status, last activity. Click into a tree to see its full log timeline.
6. **`/task-definitions`** — View/edit task definitions. **P1: editing UI** — for pilot, edit JSON directly via Supabase dashboard. Manager dashboard is read-only for task defs in P0.

### 13.2 P1 / P2

- Bulk assignment creation (P1).
- Recurring assignment templates (P1).
- Heat maps (P1).
- Protocol library UI (P1).

---

## 14. Owner Dashboard

### 14.1 Screens (P0, minimal)

1. **`/dashboard`** — Top-level: total active sets, alerts requiring attention, upcoming harvest windows.
2. **`/sets`** — All sets across the farm, sorted by upcoming harvest window.

### 14.2 P1 / P2

- Heat maps by Grade A concentration (P2 — depends on Grade A tagging).
- 120-day harvest projection (P1).
- ROI tracking (P2).

---

## 15. Build Order

A coding agent or team following this order should hit pilot-ready in 6–8 weeks.

### Week 1: Foundation
- Repo scaffolding, Next.js + Supabase wiring.
- All database migrations (sections 4 + 5).
- Seed data (sections 10 + 11).
- Generated database types.
- Zod schemas (section 6).
- Auth: implement chosen worker auth + email/password for staff (section 7).

### Week 2: Worker app core
- Login screen.
- Task queue page (`/tasks`).
- QR scanner integration.
- Task form rendering from `task_definitions.fields` (generic renderer).

### Week 3: Submission path
- `submit-log` edge function (section 8.1).
- Validation engine (section 9).
- Audit sampler (`lib/audit-sampler.ts`).
- Photo upload + EXIF capture.
- Set creation on bloom log.

### Week 4: Manager dashboard
- Manager login.
- Assignments page (create, view, reassign).
- Alerts page with triage and response-task pipeline.
- Workers page with reliability display.

### Week 5: Owner dashboard + alerts
- Owner dashboard (overview, sets list).
- Alert generation from task_logs (severity ≥ moderate → Tier 1, etc.).
- Background job: derived state recompute.

### Week 6: Hardening
- End-to-end test scenarios (section 16).
- Performance: index review, query plans for dashboard queries.
- Fraud detection demo (the K. Nong trust-building moment).
- Pilot training docs (separate from this).

### Week 7–8: Buffer
- Bug fixes from internal testing.
- Real-world pilot dry run on a small subset of trees before full rollout.

---

## 16. Acceptance Criteria

The pilot is ready when **every** item below passes.

### Worker flow
- [ ] Worker can log in with chosen auth method on a phone.
- [ ] Worker sees only assignments for trees in their assigned zones.
- [ ] Form will not unlock without a successful QR scan matching the expected tree.
- [ ] GPS off-tree triggers a flag (verified by scanning while standing >20m away).
- [ ] Submission completes in <5 seconds after tapping Submit.
- [ ] Photo capture works on iOS Safari and Android Chrome.
- [ ] No gallery upload option appears in the photo flow.

### Validation engine
- [ ] All flag codes in section 9 are implemented and unit-tested.
- [ ] `bulk_submission`, `impossible_travel`, `gps_off_tree`, `qr_mismatch` flags trigger on deliberate test cases.
- [ ] Input out-of-hard-range rejects submission with a clear error.

### Manager flow
- [ ] Manager can create an assignment in <30 seconds.
- [ ] Tier 1 alerts appear on the dashboard within 10 seconds of the triggering submission.
- [ ] Manager can assign a response task from an alert in <3 clicks.
- [ ] Manager can change a worker's trust tier and the change takes effect on the next audit sampler decision.

### Owner flow
- [ ] Owner sees an accurate count of active sets and upcoming harvests.
- [ ] Owner dashboard loads in <2 seconds on a typical connection.

### Data integrity
- [ ] task_logs has no UPDATEs or DELETEs in production (verified via Postgres audit).
- [ ] Derived state can be rebuilt from task_logs (run rebuild script on a test environment and verify outputs match).
- [ ] RLS prevents a worker from reading another worker's logs (verified via direct DB query with worker JWT).

### Fraud detection demo
- [ ] Deliberate fraud scenarios (rapid-fire submissions, GPS off, sub-10-second completions) all trigger correctly within a 15-minute live demo for K. Nong.

---

## 17. Deferred / Out of Scope

Explicitly **not** building in the pilot. Listed here so the team knows what's coming later.

- **Grade A fruit tagging + `fruits` table.** Most complex flow; full schema lives in conceptual doc.
- **Offline submission queue.** Decision deferred per pilot scope; revisit if connectivity is worse than expected.
- **Voice notes (Burmese audio).** Capture only; no transcription pipeline.
- **Push notifications to workers.** Alerts to managers via dashboard polling for pilot.
- **Heat maps and aggregate visualizations.** Owner dashboard is text/list-based in pilot.
- **Auto-generated recurring assignments.** Manager creates assignments manually in pilot.
- **Behavioral pattern detection background jobs** (`suspicious_always_clean`, `unusual_volume_spike`).
- **Worker-facing UI design system.** Tailwind defaults are fine for pilot; design polish post-pilot.
- **i18n infrastructure for the staff dashboards.** Hardcode Thai labels in manager UI for pilot; full i18n post-pilot. (Worker-facing strings already i18n'd via task definitions.)

---

*End of specification.*
