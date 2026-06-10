# Durian Smart Farm Management System — Full Documentation

**Version:** 1.0
**Last updated:** May 2026
**Status:** Pre-pilot design document

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Glossary of Terms](#2-glossary-of-terms)
3. [System Architecture](#3-system-architecture)
4. [User Roles](#4-user-roles)
5. [Physical Layer](#5-physical-layer)
6. [Core Workflows](#6-core-workflows)
7. [Data Schema Reference](#7-data-schema-reference)
8. [Fraud Detection System](#8-fraud-detection-system)
9. [Alerting System](#9-alerting-system)
10. [Photo Policy](#10-photo-policy)
11. [Worker Trust Tier System](#11-worker-trust-tier-system)
12. [Input Validation Rules](#12-input-validation-rules)
13. [Offline Behavior](#13-offline-behavior)
14. [Scaling Plan](#14-scaling-plan)
15. [Open Questions](#15-open-questions)

---

## 1. Project Overview

### What this is

A remote farm management system for a durian farm in Northern Thailand, operated by an owner based in Bangkok. The system digitizes traditional farming practices (colored-string generation tracking, manual maintenance logs) into a structured, auditable workflow.

### What problem it solves

- **Distance:** Owner cannot physically supervise daily operations.
- **Language barrier:** Workers are primarily Burmese speakers; owner and farm manager are Thai speakers.
- **Trust gap:** Owner needs confidence that logged work was actually performed.
- **Scale:** Manual paper-based tracking does not scale to 4000+ trees.
- **Yield optimization:** Premium (Grade A) durians are worth several times more than standard grade; targeted care of high-potential fruits significantly improves ROI.

### Success criteria

1. Workers can log a task in under 30 seconds without typing.
2. Owner can see real-time farm state from Bangkok.
3. Fraudulent or careless logging is detected automatically.
4. The system scales from 600 trees (pilot) to 4000+ trees (production) without architectural changes.
5. Manager can adjust task definitions and validation rules without engineering involvement.

---

## 2. Glossary of Terms

Definitions used throughout this document. When in doubt, refer here.

| Term | Definition |
| :--- | :--- |
| **Set** | A "generation" of fruit on a single tree. Durians bloom in waves; each wave matures together. Traditionally marked with colored string tied to the branch. |
| **Bloom** | The flowering event that starts a set. Bloom date determines estimated harvest window. |
| **Generation color** | The color of string/zip-tie used to mark a set. Common colors: Red, Blue, Yellow, White. Color is unique within a tree-season but not across years. |
| **Grade A / Premium fruit** | A fruit identified as high-potential post-thinning. Tagged with a gold clip. Receives targeted care to protect yield. |
| **Thinning** | The practice of removing some young fruits so that the remaining ones grow larger and higher quality. |
| **Macro** | A preset button that logs multiple related actions at once (e.g. "Morning Feed" logs fertilizer type + amount + timestamp in one tap). |
| **Task** | A specific action a worker performs at a tree (apply fertilizer, count flowers, inspect for pests, etc.). |
| **Task definition** | The form schema for a task type. Defines what fields appear, what values are valid, and whether a photo is required. |
| **Assignment** | A specific task assigned to a specific worker for a specific tree on a specific day. |
| **Log / task log** | A record of a completed task submission. The atomic unit of data in the system. |
| **Derived state** | Cached current-state data on a tree (e.g. "last fertilized 3 days ago") that is computed from logs, not authored directly. |
| **QR scan gate** | The requirement that a worker physically scan a tree's QR code before the task form unlocks. Proves on-site presence. |
| **EXIF** | Metadata embedded in a photo file by the camera — includes timestamp, GPS, device info. Used for fraud verification. |
| **Trust tier** | A worker's reliability classification (`trusted` / `standard` / `audit`). Determines audit photo rate. |
| **Audit sampler** | The server-side process that randomly selects routine tasks to require a photo. |
| **Flag** | A fraud or anomaly signal raised by the validation system on a specific log entry. |
| **Tier 1 / 2 / 3 alert** | Severity classification: Tier 1 = immediate red, Tier 2 = daily amber digest, Tier 3 = weekly informational. |
| **LIFF** | LINE Front-end Framework. Allows running web apps inside the LINE messaging app. |
| **PWA** | Progressive Web App. A website that behaves like a native app (installable, offline-capable). |

---

## 3. System Architecture

### High-level diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                         OWNER (Bangkok)                          │
│                                                                  │
│    Next.js Dashboard ──► Real-time farm state, alerts, reports   │
│                                                                  │
└──────────────────────────────┬───────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                    BACKEND (Firebase / Supabase)                 │
│                                                                  │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│   │ task_logs    │  │ derived      │  │ validation engine    │   │
│   │ (append-only)├──┤ state cache  │  │ (fraud + alerts)     │   │
│   └──────────────┘  └──────────────┘  └──────────────────────┘   │
│                                                                  │
│                      ▲                  ▼                        │
└──────────────────────┼──────────────────┼────────────────────────┘
                       │                  │
                  log submit         push alerts
                       │                  │
┌──────────────────────┴──────────────────┴────────────────────────┐
│                  MANAGER (on-site, K. Nong)                      │
│                                                                  │
│   Web dashboard (Thai) ─► Task assignment, alert response,       │
│                           protocol management, worker oversight  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
                       ▲                  │
                       │             daily assignments
                  log submit              │
                       │                  ▼
┌──────────────────────┴──────────────────────────────────────────┐
│                  WORKERS (in-field, Burmese)                     │
│                                                                  │
│   LIFF / PWA ──► Today's task queue ──► QR scan ──► Form ──►    │
│                  Photo (if required) ──► Submit                  │
│                                                                  │
│   Physical: trees with QR codes + colored zip-ties + gold clips  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Component responsibilities

**Worker app (LIFF + PWA)**
- Shows today's assigned tasks filtered to worker's zones.
- Enforces QR scan before any form unlocks.
- Captures GPS silently in background on every submission.
- Camera-only photo capture (no gallery uploads).
- Queues submissions locally when offline; syncs when reconnected.
- No free-text input except optional notes field (voice recording in Burmese supported).

**Manager dashboard**
- Daily task assignment (recurring + ad-hoc).
- Alert triage and response.
- Task definition editor (manager can change form fields without engineering).
- Worker oversight (trust tiers, reliability metrics).
- Protocol library (alert → suggested response task mapping).

**Owner dashboard**
- High-level farm health view.
- Heat maps (Grade A concentration, alert density, zone health).
- 120-day harvest projections.
- ROI tracking.
- Alert summary (Tier 1 push notifications, Tier 2 daily digest).

**Backend**
- Stores all data; serves as single source of truth.
- Runs the validation engine on every submission (fraud flags, input bounds).
- Runs the audit sampler (decides which routine tasks need a photo).
- Computes derived state and reliability metrics.
- Sends push notifications for alerts.

### Tech stack

| Component | Technology | Rationale |
| :--- | :--- | :--- |
| Worker interface | LINE + LIFF (React) | Workers already use LINE; no app store install needed. |
| Manager interface | Next.js web app | Standard web stack, Thai/English locale. |
| Owner dashboard | Next.js web app | Shared codebase with manager UI. |
| Database | Firebase or Supabase | Real-time sync, offline-first, photo storage included. |
| Tree identification | Laminated QR codes | Weather-resistant, cheap, unique per tree. |
| Generation marking | Colored zip-ties | Red/Blue/Yellow/White. Universally understood. |
| Premium marking | Gold metal clips | Numbered, scannable for individual fruit tracking. |

---

## 4. User Roles

### Owner
- Location: Bangkok (remote).
- Language: Thai.
- Access: Owner dashboard, read-only on most data, configuration override on critical settings.
- Primary needs: Confidence work is being done; high-level financial/yield visibility; safety alerts.

### Manager (K. Nong)
- Location: On-site at farm.
- Language: Thai.
- Access: Full manager dashboard. Can edit task definitions, assign tasks, review alerts, manage workers.
- Primary needs: Operational control without paper logs; clear alert prioritization; ability to adapt the system as conditions change.

### Worker
- Location: In-field.
- Language: Burmese (primary), some basic Thai.
- Access: Worker PWA. Sees only assigned tasks for assigned zones. Cannot view other workers' logs.
- Primary needs: Fast task completion; visual-first UI; no typing required; offline-capable.

---

## 5. Physical Layer

The physical layer makes the digital system work in the field. It is intentionally low-tech and visible.

### Tree identification

Each tree has a laminated QR code attached to the trunk at chest height. The QR code encodes a tree ID (e.g. `QR_A104_v2`) that maps to the `tree_id` in the database.

**Why QR codes:**
- Cheap to print and replace.
- Weather-resistant when laminated.
- Worker presence is proven by physical scanning (cannot be done remotely).
- The `qr_value` is logged on every submission, providing tamper-evident proof.

**Replacement protocol:**
- If a QR code is damaged, the old code is retired (status flag in DB) and a new versioned code is issued (e.g. `v2` → `v3`).
- Old codes are not deleted from history; logs that referenced them remain valid.

### Generation marking (zip-ties)

When a set of fruit blooms, a worker ties colored zip-ties on the relevant branches. Colors are rotated: Red, Blue, Yellow, White, then back to Red for the next bloom wave.

**Why physical color marking:**
- Workers can identify generations visually from across the orchard.
- No app needed to know which fruits belong to which set.
- Survives if the tree's QR code is damaged.
- Aligns with existing traditional practice; not a new behavior to teach.

### Premium fruit marking (gold clips)

When a fruit is identified as Grade A post-thinning, a gold clip is attached to its stem. Each clip has a unique numeric ID (e.g. `G-7821`).

**Why individual clips:**
- Solves the "did 2 fruits drop or get downgraded?" data integrity problem.
- Workers can re-scan a specific fruit later (e.g. to log that it dropped).
- Premium count is derived from physical evidence, not typed counts.

---

## 6. Core Workflows

### 6.1 Worker daily flow

```
1. Worker opens app (LIFF in LINE, or PWA)
   ↓
2. App shows today's task queue, filtered to worker's zones
   ↓
3. Worker walks to a tree, taps the task
   ↓
4. App prompts: "Scan QR code to begin"
   ↓
5. Worker scans QR code on the tree trunk
   ↓
6. App validates: GPS within 15m of tree's known location?
   ├─ YES → form unlocks
   └─ NO  → "Move closer to the tree" warning; form stays locked
   ↓
7. Worker fills form (dropdowns, counters, sliders — no typing)
   ↓
8. If photo required:
   ├─ Camera opens directly (no gallery option)
   ├─ Worker takes photo
   └─ EXIF timestamp captured and validated
   ↓
9. Worker taps Submit
   ↓
10. Server-side validation runs:
    ├─ All checks pass → log saved, "Complete" shown
    └─ Validation flags raised → log saved (with flags), reviewed later
    ↓
11. Next task in queue shown
```

### 6.2 Bloom logging (creating a set)

When a worker observes new flowers on a tree:

1. Scan tree QR code.
2. Select "Log New Set" from task menu.
3. Select color of zip-tie used (Red / Blue / Yellow / White).
4. Enter approximate flower count (counter, +/- buttons).
5. Submit.

**System actions:**
- Creates one entry in `task_logs`.
- Creates one new row in `sets` with `bloom_date = now`, `status = "flowering"`, computed `harvest_window_start/end`.
- Updates tree's `derived_state.active_sets`.

### 6.3 Grade A tagging

When a worker is performing thinning and identifies a fruit as premium:

1. Scan tree QR code.
2. Select "Tag Premium Fruit".
3. Select which set (Red/Blue/etc.).
4. Scan or enter the gold clip's unique ID (`G-7821`).
5. Photo required (this is evidence-bearing — see Photo Policy section).
6. Submit.

**System actions:**
- Creates one entry in `task_logs`.
- Creates one row in `fruits` with the clip ID and a link to the set.
- Increments `sets.premium_fruit_count`.
- Auto-generates targeted care assignments per the manager's Grade A protocol.

### 6.4 Maintenance task (fertilizer, watering, etc.)

1. Worker has an assignment from the daily queue.
2. Scan tree QR code.
3. Use a Macro button (e.g. "Morning Feed" auto-fills fertilizer type, amount).
4. Adjust amount if needed.
5. Photo: only required if the audit sampler selected this submission (see Photo Policy).
6. Submit.

### 6.5 Pest/disease report

1. Worker spots a problem during routine work.
2. Scan tree QR code.
3. Select "Report Issue" → "Pest" or "Disease".
4. Select severity (None / Mild / Moderate / Severe).
5. **Photo required** (always — this is evidence).
6. Optional: voice note in Burmese.
7. Submit.

**System actions:**
- Creates entry in `task_logs`.
- If severity is Moderate or Severe: creates Tier 1 alert for the manager.
- Manager gets push notification with one-tap "Assign response task" option.

### 6.6 Harvest

1. Set status updated to "harvesting" by manager (or auto-triggered at harvest window).
2. Worker assignments generated for picking.
3. Worker scans tree, selects "Log Harvest".
4. Selects set color.
5. Scans each gold clip removed (for tracked premium fruits).
6. Enters total count of non-premium fruits picked.
7. Photo required for grading verification.
8. Submit.

### 6.7 Manager alert response

1. Manager receives push notification (Tier 1) or sees item in dashboard.
2. Reviews the triggering log (photo, GPS, severity).
3. Decides on action:
   - **Assign response task:** System pre-populates a task based on protocol library; manager picks worker and confirms.
   - **Dismiss as false positive:** Log marked reviewed, no action.
   - **Escalate:** Tier 1 escalates to owner notification.

---

## 7. Data Schema Reference

This section defines every collection and every field. Field types follow JSON conventions.

### 7.1 Collections overview

| Collection | Write pattern | Purpose |
| :--- | :--- | :--- |
| `trees` | Rarely mutated | Static tree info + cached derived state |
| `task_logs` | Append-only, high volume | Every worker action ever; source of truth |
| `sets` | Created on bloom, updated through lifecycle | One row per fruit generation |
| `fruits` | Created on Grade-A tagging | Individual premium fruits |
| `workers` | Rarely mutated | Worker profiles + reliability metrics |
| `task_definitions` | Manager-edited | Form schemas per task type |
| `assignments` | Daily/scheduled | Who does what when |
| `alerts` | System-generated | Flagged issues for review |
| `protocols` | Manager-edited | Alert → response task mappings |

### 7.2 `trees` collection

Static metadata about each tree plus a cached snapshot of current state.

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `tree_id` | string | yes | Unique tree identifier (e.g. `A-104`). Format: `<zone-letter>-<number>`. |
| `qr_code` | string | yes | Currently active QR code value. Versioned (e.g. `QR_A104_v2`). |
| `location.lat` | number | yes | Latitude (decimal degrees). |
| `location.long` | number | yes | Longitude (decimal degrees). |
| `location.zone` | string | yes | Named zone (e.g. `North-A`). Used for worker assignment filtering. |
| `location.row` | integer | yes | Row number within the zone. |
| `location.position` | integer | yes | Position within the row. |
| `planted_date` | date | yes | When the tree was planted. Used for age calculations. |
| `variety` | string | yes | Durian variety (e.g. `Monthong`, `Chanee`). |
| `status` | enum | yes | `active` / `retired` / `dead`. Retired trees preserve history but accept no new logs. |
| `retired_date` | date \| null | no | When the tree was retired or died. Null if still active. |
| `derived_state.last_updated` | timestamp | yes | When this cache was last recomputed. |
| `derived_state.active_sets` | array of set_ids | yes | Sets currently developing on this tree. |
| `derived_state.last_maintenance` | object \| null | no | Most recent maintenance log summary: `{type, date, task_log_id}`. |
| `derived_state.current_health_score` | number | yes | Computed health metric 0.0–1.0. |
| `derived_state.open_alerts` | integer | yes | Count of unresolved alerts referencing this tree. |
| `derived_state.days_since_last_log` | integer | yes | Days since any log was submitted for this tree. Drives "inactive tree" alerts. |

**Notes:**
- `derived_state` is always recomputable from `task_logs`. If it drifts, replay logs to rebuild.
- `qr_code` versioning lets you replace damaged tags without losing history.

### 7.3 `task_logs` collection

The source of truth. Every worker submission lives here. Append-only.

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `log_id` | string | yes | Unique log identifier (e.g. `log_8f3a2b1c`). |
| `tree_id` | string | yes | Tree this log is about. |
| `task_def_id` | string | yes | Which task definition was used. Determines `form_data` shape. |
| `task_type` | string | yes | High-level category (e.g. `fertilizer`, `pest_inspection`, `bloom_log`). Denormalized from task_def for fast filtering. |
| `assignment_id` | string \| null | no | The assignment this fulfills. Null if logged unprompted (which is itself a signal). |
| `worker_id` | string | yes | Who submitted this log. |
| `submitted_at` | timestamp | yes | When the submit button was pressed. Server-authoritative. |
| `form_opened_at` | timestamp | yes | When the form was first opened (post-QR-scan). Used for completion-speed flags. |
| `presence.qr_scanned_at` | timestamp | yes | When the QR scan occurred. |
| `presence.qr_value` | string | yes | The literal QR string scanned. Must match tree's current `qr_code`. |
| `presence.gps.lat` | number | yes | GPS at time of submission. |
| `presence.gps.long` | number | yes | GPS at time of submission. |
| `presence.gps_delta_meters` | number | yes | Distance between submission GPS and tree's known location. |
| `form_data` | object | yes | Structured form values. Shape determined by `task_def_id`. |
| `photo_requirement.required` | boolean | yes | Whether this submission required a photo. |
| `photo_requirement.reason` | enum | yes | `task_default` / `random_audit` / `alert_followup` / `none`. |
| `photo_requirement.audit_selection_seed` | string \| null | no | Seed used by the audit sampler (for audit-rate verification). |
| `photo.url` | string \| null | no | Storage URL. Null if no photo required. |
| `photo.exif_timestamp` | timestamp \| null | no | When the photo was captured per EXIF data. |
| `photo.exif_gps` | object \| null | no | `{lat, long}` from EXIF. |
| `photo.capture_method` | enum \| null | no | `camera` (always — gallery uploads are blocked). |
| `validation.status` | enum | yes | `passed` / `flagged` / `rejected`. Rejected submissions are not used in derived state. |
| `validation.flags` | array of strings | yes | List of flag codes raised. See [Fraud Detection](#8-fraud-detection-system). |
| `notes_audio_url` | string \| null | no | Voice note (Burmese audio). |
| `notes_text` | string \| null | no | Optional free text notes. Almost always empty. |

**Notes:**
- `form_opened_at` vs `submitted_at` gives the completion duration — used for the "too fast" flag.
- `qr_scanned_at` is logged separately because the scan unlocks the form. Scan-to-submit duration is also a signal.
- `photo_requirement` is set **server-side** when the worker fetches the assignment, so the client cannot decide to skip photos.

### 7.4 `sets` collection

One row per fruit generation on a tree.

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `set_id` | string | yes | Composite ID: `set_<tree_id>_<season>_<color>` (e.g. `set_a104_2026_red`). |
| `tree_id` | string | yes | Parent tree. |
| `color` | enum | yes | `red` / `blue` / `yellow` / `white`. |
| `season` | string | yes | E.g. `2026-main`, `2026-late`. Resolves color reuse across years. |
| `bloom_log_id` | string | yes | The `task_log` that created this set. |
| `bloom_date` | date | yes | Date of bloom logging. |
| `estimated_maturation_days` | integer | yes | Days from bloom to harvest. Variety-specific (Monthong ≈ 120). |
| `harvest_window_start` | date | yes | Computed: `bloom_date + estimated_maturation_days - buffer`. |
| `harvest_window_end` | date | yes | Computed: `bloom_date + estimated_maturation_days + buffer`. |
| `initial_fruit_count` | integer | yes | Count at bloom logging. |
| `current_fruit_count` | integer | yes | Most recent count after thinning/drops. |
| `premium_fruit_count` | integer | yes | Count of currently-tagged Grade A fruits. Derived from `fruits` collection. |
| `status` | enum | yes | `flowering` / `developing` / `harvesting` / `harvested` / `failed`. |
| `harvest_log_ids` | array of strings | yes | Logs that recorded harvest events for this set. |
| `harvested_at` | timestamp \| null | no | When fully harvested. |
| `history` | array of objects | yes | Denormalized event timeline. Each: `{date, event, fruit_count, log_id}`. Authoritative copy is in `task_logs`; this is for fast rendering. |

### 7.5 `fruits` collection

Individual premium-tagged fruits. Only Grade A fruits get rows here.

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `fruit_id` | string | yes | Unique fruit identifier. |
| `set_id` | string | yes | Parent set. |
| `tree_id` | string | yes | Parent tree (denormalized for fast queries). |
| `physical_tag.type` | enum | yes | `gold_clip` (currently the only type). |
| `physical_tag.tag_id` | string | yes | The unique ID printed on the clip (e.g. `G-7821`). |
| `tagged_at` | timestamp | yes | When the clip was applied. |
| `tagged_by` | string | yes | Worker ID. |
| `tag_log_id` | string | yes | The `task_log` that tagged this fruit. |
| `current_status` | enum | yes | `developing` / `dropped` / `harvested` / `downgraded`. |
| `status_history` | array of objects | yes | Each: `{status, date, log_id}`. |
| `final_grade` | enum \| null | no | Filled at harvest: `A` / `B` / `C` / `reject`. Null until harvested. |
| `harvested_at` | timestamp \| null | no | When picked. |
| `harvest_log_id` | string \| null | no | The harvest log that recorded this fruit. |

### 7.6 `workers` collection

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `worker_id` | string | yes | Unique worker identifier. |
| `display_name` | string | yes | Name shown in UI (may be transliterated). |
| `language` | enum | yes | `my` (Burmese), `th` (Thai), `en` (English). |
| `assigned_zones` | array of strings | yes | Zone names this worker is allowed to log in. |
| `active` | boolean | yes | Whether the worker is currently employed. |
| `reliability.last_computed` | timestamp | yes | When metrics were last refreshed. |
| `reliability.logs_total` | integer | yes | Lifetime log count. |
| `reliability.logs_flagged` | integer | yes | Count of logs with at least one validation flag. |
| `reliability.flag_rate` | number | yes | `logs_flagged / logs_total`. |
| `reliability.avg_completion_seconds` | number | yes | Mean form-opened to submitted duration. |
| `reliability.trust_tier` | enum | yes | `trusted` / `standard` / `audit`. See [Trust Tier System](#11-worker-trust-tier-system). |

### 7.7 `task_definitions` collection

Manager-editable form schemas. Editing here changes the worker UI without a code deploy.

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `task_def_id` | string | yes | Unique definition ID (e.g. `soil_acidity_check_v2`). |
| `task_type` | string | yes | High-level category. |
| `display_name.th` | string | yes | Thai label for manager UI. |
| `display_name.my` | string | yes | Burmese label for worker UI. |
| `display_name.icon` | string | yes | Icon identifier shown to workers. |
| `photo_policy.mode` | enum | yes | `always` / `audit_only` / `never`. See [Photo Policy](#10-photo-policy). |
| `photo_policy.audit_rate_by_tier` | object | conditional | Required if mode is `audit_only`. Keys: `trusted`, `standard`, `audit`. Values: 0.0–1.0. |
| `requires_qr_scan` | boolean | yes | Almost always true. False only for non-tree tasks (extremely rare). |
| `min_completion_seconds` | integer | yes | Floor for form-opened to submitted. Submissions faster than this are flagged. |
| `min_qr_to_submit_seconds` | integer | yes | Floor for QR-scan to submitted. |
| `fields` | array of field objects | yes | Form fields. See field structure below. |

**Field object structure:**

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `field_id` | string | yes | Identifier used as the key in `task_logs.form_data`. |
| `type` | enum | yes | `numeric_counter` / `dropdown` / `slider` / `gold_clip_scan` / `color_picker`. |
| `label_icon` | string | yes | Icon shown to workers (no text label needed). |
| `min` | number | conditional | Required for numeric types. Minimum allowed value. |
| `max` | number | conditional | Required for numeric types. Maximum allowed value. |
| `warn_below` | number | no | Submitted values below this raise a soft flag. |
| `warn_above` | number | no | Submitted values above this raise a soft flag. |
| `step` | number | no | Increment size for counters/sliders. |
| `options` | array | conditional | Required for dropdowns. Each: `{value, icon}`. |
| `required` | boolean | yes | Whether the field must be filled. |

### 7.8 `assignments` collection

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `assignment_id` | string | yes | Unique identifier. |
| `worker_id` | string | yes | Assigned worker. |
| `tree_id` | string | yes | Target tree. |
| `task_def_id` | string | yes | Which task to perform. |
| `scheduled_for` | date | yes | When this should be done. |
| `priority` | enum | yes | `low` / `normal` / `high` / `urgent`. |
| `source` | enum | yes | `recurring` (from schedule) / `alert_triggered` (response to alert) / `manual` (manager one-off). |
| `triggered_by_alert_id` | string \| null | no | If source is `alert_triggered`. |
| `completed_log_id` | string \| null | no | The log that fulfilled this. Null until done. |
| `status` | enum | yes | `pending` / `in_progress` / `completed` / `overdue` / `skipped`. |

### 7.9 `alerts` collection

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `alert_id` | string | yes | Unique identifier. |
| `tier` | integer | yes | `1` (immediate) / `2` (daily digest) / `3` (weekly informational). |
| `category` | enum | yes | `farm_health` / `fraud_signal` / `inactivity` / `compliance`. |
| `subtype` | string | yes | Specific signal (e.g. `severe_pest`, `gps_mismatch`, `inactive_tree`). |
| `tree_id` | string \| null | no | Tree this concerns (if applicable). |
| `worker_id` | string \| null | no | Worker this concerns (if applicable). |
| `triggered_by_log_id` | string \| null | no | The log that caused this alert. |
| `created_at` | timestamp | yes | When generated. |
| `status` | enum | yes | `open` / `reviewed` / `resolved` / `dismissed`. |
| `resolution` | object \| null | no | `{action_taken, resolved_by, resolved_at, notes}`. |
| `suggested_response_task_def_id` | string \| null | no | Pre-filled task type for one-tap response. |

### 7.10 `protocols` collection

Manager-editable mappings of alert subtypes to suggested response tasks.

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `protocol_id` | string | yes | Unique identifier. |
| `alert_subtype` | string | yes | Which alert triggers this protocol (e.g. `severe_pest`). |
| `response_task_def_id` | string | yes | Suggested task to assign. |
| `description.th` | string | yes | Plain description for manager. |
| `active` | boolean | yes | Whether this protocol is currently in use. |

---

## 8. Fraud Detection System

The system uses layered checks. Each layer catches a different category of fraudulent or careless behavior.

### Layer 1: Presence verification

Proves the worker was physically at the tree.

| Check | Mechanism | Flag code if failed |
| :--- | :--- | :--- |
| QR scan required | Form will not unlock without a successful QR scan | (blocked at app level — no flag) |
| QR value matches tree | Scanned `qr_value` must equal tree's current `qr_code` | `qr_mismatch` |
| GPS within range | Submission GPS within 15m of tree's known location | `gps_off_tree` |
| GPS captured | Worker did not deny location permission | `gps_missing` |

### Layer 2: Timing checks

Catches workers rushing through forms without doing the work.

| Check | Mechanism | Flag code |
| :--- | :--- | :--- |
| Form not too fast | `submitted_at - form_opened_at` must exceed task's `min_completion_seconds` | `completion_too_fast` |
| QR-to-submit not too fast | `submitted_at - qr_scanned_at` must exceed `min_qr_to_submit_seconds` | `qr_to_submit_too_fast` |
| Impossible travel | Implied speed from previous log's location to this one cannot exceed 6 km/h | `impossible_travel` |
| No bulk submissions | Cannot submit 20+ logs within 5 minutes | `bulk_submission` |
| No metronome patterns | 10+ consecutive logs at perfectly even intervals are suspicious | `sequence_pattern_suspect` |

### Layer 3: Photo verification (when photo present)

Applies only to submissions with photos. Most routine submissions skip this layer.

| Check | Mechanism | Flag code |
| :--- | :--- | :--- |
| Camera-only capture | `<input capture="environment">` blocks gallery uploads | (blocked at app level) |
| EXIF timestamp matches | Photo EXIF timestamp within ~2 min of submit timestamp | `exif_timestamp_mismatch` |
| EXIF GPS matches | Photo EXIF GPS within ~15m of tree | `exif_gps_mismatch` |
| EXIF present | Photo has EXIF data at all | `exif_missing` |

### Layer 4: Input bounds

Catches typos and sensor errors at submission time.

| Check | Mechanism | Flag code |
| :--- | :--- | :--- |
| Value within hard range | `min ≤ value ≤ max` per task definition | submission **rejected** |
| Value within warning range | `warn_below ≤ value ≤ warn_above` | `value_out_of_warn_range` (soft flag) |

### Layer 5: Behavioral patterns (computed over time)

Run by background jobs, not on individual submissions.

| Check | Mechanism | Flag code |
| :--- | :--- | :--- |
| Always-clean worker | Worker logs never report issues, but neighbors do | `suspicious_always_clean` |
| Burst worker | Worker normally logs 20/day, suddenly logs 60 | `unusual_volume_spike` |
| Inactive worker | Worker assigned tasks but logs nothing for 2+ days | (becomes a `compliance` alert, not a flag) |

---

## 9. Alerting System

Alerts are how the system tells the manager (and sometimes the owner) something needs attention.

### Tier 1 — Immediate (red, push notification)

| Subtype | Trigger | Routed to |
| :--- | :--- | :--- |
| `severe_pest` | Pest report logged with severity `Severe` | Manager (immediate push) |
| `severe_disease` | Disease report logged with severity `Severe` | Manager (immediate push) |
| `gps_mismatch` | `gps_off_tree` flag on a submission | Manager |
| `exif_mismatch` | EXIF timestamp or GPS off | Manager |
| `impossible_sequence` | `impossible_travel` flag | Manager |
| `bulk_submission` | 20+ logs from one worker in 5 min | Manager |
| `safety_overdue` | Critical maintenance (e.g. fungicide for root rot) past safe window | Manager + Owner |

### Tier 2 — Daily digest (amber)

| Subtype | Trigger |
| :--- | :--- |
| `inactive_tree` | No logs for a tree in 2+ days |
| `low_completion_rate` | Worker completing <70% of assigned tasks |
| `always_clean_worker` | Worker never reports issues while neighbors do |
| `ph_out_of_range` | 3+ consecutive soil pH logs outside healthy range |
| `set_overdue` | Set past `harvest_window_end` without harvest log |

### Tier 3 — Weekly informational

| Subtype | Trigger |
| :--- | :--- |
| `zone_health_summary` | Weekly aggregation per zone |
| `tree_trend_summary` | Per-tree trajectory (flower counts, pest history, premium ratio) |
| `worker_reliability_summary` | Reliability metrics + trust tier changes |
| `audit_results_summary` | Audit-triggered submissions: passed vs. flagged |

### Alert-to-task pipeline

When the manager opens a Tier 1 or Tier 2 alert, the dashboard shows:
1. The triggering log (photo if present, GPS, severity, worker).
2. The recommended response from the protocol library (if a matching protocol exists).
3. A one-tap "Assign response task" button that pre-fills the task type — manager picks the worker and confirms.

### Alert budget principle

The manager should receive **no more than ~5 actionable items per day**. Tier 2 and 3 roll up into digests; only Tier 1 generates pushes. Thresholds should be calibrated against manager attention, not raw signal volume.

---

## 10. Photo Policy

Photos are expensive (storage cost, worker time, review overhead) and are **not** the primary fraud-detection mechanism. The QR scan + GPS + timing checks carry that load.

### Photo policy modes

Defined per task in `task_definitions.photo_policy.mode`:

**`always` — photo required every time**

Used for tasks where the photo *is* the evidence. The data being logged is a claim that only a photo can substantiate.

Examples:
- `pest_inspection` (severity claim needs visual proof)
- `disease_report` (disease type ID needs visual proof)
- `harvest_grading` (grade assignment needs visual proof)
- `severe_condition_report` (escalation requires evidence)
- `grade_a_tagging` (tagging a premium fruit warrants verification)

**`audit_only` — photo required only when randomly selected**

Used for routine tasks. The audit sampler rolls a per-submission die based on the worker's trust tier. Worker doesn't know in advance whether a photo will be requested for any given submission, which preserves the deterrent effect.

Default audit rates:

| Trust tier | Audit rate | Meaning |
| :--- | :--- | :--- |
| `trusted` | 1% | Long-clean record; light spot-checks. |
| `standard` | 5% | Default for most workers. |
| `audit` | 15% | Recently flagged or new worker; heavier verification. |

Examples of `audit_only` tasks:
- Fertilizer application
- Watering
- Soil acidity check
- Flower count
- Routine inspection

**`never` — photo never required**

Used for ultra-fast tasks where photos would add friction without value.

Examples:
- "Tree visited" (presence-only check)
- Reading a fixed gauge value

### How the audit sampler works

1. Worker fetches their task queue. The server, for each `audit_only` task, rolls a random number.
2. If the roll is below the worker's tier-specific rate, that assignment is marked `photo_requirement.required = true` with `reason = random_audit`.
3. The worker's app shows the photo prompt for selected tasks. Workers do not know which tasks were selected until they open them.
4. The selection seed is stored in the log for audit-rate verification.

### Storage projections

At 4000 trees, ~10 tasks per tree per month = ~40,000 tasks/month.

- Universal photo capture: 40,000 photos/month.
- Photo policy as designed: ~10–15% of tasks need photos = ~4,000–6,000 photos/month.

Roughly an 85% reduction in storage cost and a comparable reduction in worker friction.

---

## 11. Worker Trust Tier System

### Tiers

**`trusted`** — Workers with strong track records.
- Long log history (50+ submissions) with low flag rate (<0.5%).
- Audit photo rate: 1%.
- Eligible to log unprompted observations (without a pre-existing assignment).

**`standard`** — Default tier for most workers.
- Audit photo rate: 5%.
- Standard fraud check coverage.

**`audit`** — Workers under heightened verification.
- New workers start here for their first 30 days or 50 logs (whichever first).
- Workers with any Tier 1 fraud flag move here for at least 30 days.
- Audit photo rate: 15%.

### Tier transitions

**Automatic promotions:**
- `audit` → `standard`: 30 days clean OR 50 logs with <2% flag rate, whichever first.
- `standard` → `trusted`: 90 days at standard with <0.5% flag rate AND 100+ logs.

**Automatic demotions:**
- Any tier → `audit`: any Tier 1 fraud flag, OR 5+ flagged logs in 14 days.

**Manual override:** Manager can set any worker's tier directly. Manual settings persist until manually changed or until an automatic demotion is triggered.

### Flag decay

Flags older than 90 days are excluded from the rolling `flag_rate` calculation. This prevents permanent punishment for past mistakes and gives workers a path to recovery.

---

## 12. Input Validation Rules

All numeric inputs have hard bounds (rejected) and soft bounds (flagged). Dropdowns have fixed options — no free text anywhere except optional notes.

| Field | Type | Hard range | Soft warning | Notes |
| :--- | :--- | :--- | :--- | :--- |
| Soil pH | Numeric | 3.5 – 8.0 | <4.5 or >7.5 | Durians prefer 5.5–6.5. |
| Soil moisture (%) | Numeric | 0 – 100 | >90 | High values often indicate sensor error. |
| Fertilizer amount (kg) | Numeric | 0 – 50 | >20 | Per single application per tree. |
| Pest severity | Dropdown | None / Mild / Moderate / Severe | — | Moderate+ creates an alert. |
| Disease severity | Dropdown | None / Mild / Moderate / Severe | — | Moderate+ creates an alert. |
| Flower count | Integer counter | 0 – 500 | >200 | Unusually high counts may indicate miscounts. |
| Budding fruit count | Integer counter | 0 – 200 | — | — |
| Fruit grade | Dropdown | A / B / C / Reject | — | Per-harvest log. |
| Leaf condition | Dropdown | Healthy / Yellowing / Wilting / Necrotic | — | Non-Healthy may trigger inspection. |

---

## 13. Offline Behavior

The worker app is offline-first. Field connectivity is unreliable.

### What works offline

- Opening the app and viewing today's task queue (cached at last sync).
- Scanning QR codes.
- Filling forms and taking photos.
- Queuing submissions locally.

### What doesn't work offline

- Fetching new assignments created after last sync.
- Receiving real-time alerts.
- Manager dashboard (online only).

### Sync behavior

- Submissions are queued in browser storage with all data (form, photo, GPS, timestamps) intact.
- When connectivity returns, queued submissions are sent in chronological order.
- Server-side validation runs at sync time, not submission time.
- If a submission fails server validation, it's flagged but not lost — the worker can review and resubmit if appropriate.

### Conflict resolution

If two workers log on the same tree offline and both sync later, both logs are preserved. The derived state is recomputed from both. Logs are never overwritten.

---

## 14. Scaling Plan

### Pilot phase: 600 trees

- Single zone or two adjacent zones.
- ~3–5 workers.
- Goal: validate workflows, calibrate audit rates, tune alert thresholds, identify edge cases.
- Estimated duration: one full season (4–5 months) covering a complete bloom-to-harvest cycle.

### Production phase: 4000+ trees

- Multiple zones across the farm.
- ~15–25 workers.
- Goal: routine operations with the system as primary record.

### What doesn't change between phases

- The schema (same collections, same fields).
- The fraud detection logic.
- The photo policy structure.

### What might need to scale

- Database read replicas (if dashboard queries get slow).
- Photo CDN configuration (if photo views from Bangkok lag).
- Alert digest logic (more aggressive rollup at higher tree counts).
- Task assignment automation (manual assignment doesn't scale; recurring schedules + alert-triggered tasks should cover ~95% of cases at full scale).

---

## 15. Open Questions

These remain unresolved and need decisions before or during the pilot.

1. **Set color reuse within a season.** Can the same tree have two "Red" sets if blooms come in waves close together? If yes, the `color` field alone is not unique within a season; we'd need a sub-index or a wider color palette.

2. **Audit rate calibration.** Starting proposal is 1% / 5% / 15% by trust tier. Should the pilot start tighter (5% / 10% / 25%) and loosen as trust is established?

3. **Audit photo review workflow.** When an audit-triggered photo arrives, who reviews it and when? Inline as it arrives? Batched daily? Only on demand when something else looks suspicious?

4. **Voice note handling.** Burmese voice notes need translation. Options: (a) bilingual reviewer reviews on demand, (b) automated transcription + translation pipeline, (c) build out the icon-based issue picker so audio is only the long-tail escape hatch.

5. **Protocol library seed data.** What protocols exist for common issues (pest X → response Y)? This is K. Nong's domain knowledge that needs to be captured before the system can suggest response tasks.

6. **Recurring task generation.** Does the manager want the system to auto-generate recurring tasks (e.g. "fertilize every Monday"), or manually create them each week? Probably automated with manual override, but needs confirmation.

7. **Audit results escalation.** If fraud is confirmed via audit photo, what's the consequence? Verbal warning? Trust tier demotion (already happens)? Termination protocol?

8. **Tree retirement criteria.** When does a tree go from `active` to `retired` or `dead`? Worker-reported? Manager decision? Computed from sustained inactivity or low health score?

9. **Owner alert routing.** Which Tier 1 alerts go to the owner immediately vs. wait for the daily digest? Probably only safety-critical (root rot, severe disease across multiple trees) and confirmed fraud.

10. **Demo for K. Nong.** Before deploying, script a demo that deliberately triggers each fraud flag so K. Nong can see the timing/GPS system catching things without photos. This is the trust-building step.

---

*End of document.*
