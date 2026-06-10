# Durian Farm — Data Schema (v3)

**Core principle:** Workers write to `task_logs` (append-only). Tree state is *derived* from logs, with a cached snapshot in `trees` for fast reads. Nothing about a tree changes without a log entry to explain why.

**Photo policy (v3 change):** Photos are no longer required for routine tasks. They are required only for: (a) tasks where the photo *is* the evidence (pest spotted, disease, harvest grading, severe condition); and (b) randomly-selected routine tasks for audit purposes. Sequence/timing/GPS checks carry the primary fraud-detection load for everything else.

---

## Collections Overview

| Collection | Write Pattern | Purpose |
| :--- | :--- | :--- |
| `trees` | Rarely mutated (metadata + derived cache) | Static tree info + current computed state |
| `task_logs` | Append-only, high volume | Every worker action, ever. The source of truth. |
| `sets` | Created on bloom-log, updated on harvest-log | One row per fruit generation. Derived from logs but stored for query speed. |
| `fruits` | Created on Grade-A-tagging | Individual premium fruits with physical tags |
| `workers` | Rarely mutated | Worker profiles + reliability metrics |
| `task_definitions` | Manager-edited | Form schemas — defines what fields appear for each task type |
| `assignments` | Daily/scheduled | Which worker is supposed to do what, when |
| `alerts` | System-generated | Flagged issues for manager review |

---

## 1. `trees`

Static metadata + a derived state cache. Never written to directly by workers.

```json
{
  "tree_id": "A-104",
  "qr_code": "QR_A104_v2",
  "location": {
    "lat": 18.70123,
    "long": 98.90456,
    "zone": "North-A",
    "row": 12,
    "position": 4
  },
  "planted_date": "2018-03-15",
  "variety": "Monthong",
  "status": "active",
  "retired_date": null,

  "derived_state": {
    "last_updated": "2026-05-23T10:30:00Z",
    "active_sets": ["set_a104_2026_red", "set_a104_2026_blue"],
    "last_maintenance": {
      "type": "fertilizer",
      "date": "2026-05-10T08:30:00Z",
      "task_log_id": "log_8f3a..."
    },
    "current_health_score": 0.87,
    "open_alerts": 0,
    "days_since_last_log": 1
  }
}
```

**Notes:**
- `derived_state` is recomputed on each new task_log for that tree. It's a cache, not authoritative — you can rebuild it from logs at any time.
- `status` lets you retire trees without deleting history. QR codes get reused only after a cooldown.
- `zone/row/position` makes spatial queries cheap (heat maps, "nearest tree to GPS X").

---

## 2. `task_logs` — the source of truth

Every worker submission. Append-only. Never edited.

```json
{
  "log_id": "log_8f3a2b1c...",
  "tree_id": "A-104",
  "task_def_id": "morning_feed_v3",
  "task_type": "fertilizer",
  "assignment_id": "assn_2026_05_23_w01",

  "worker_id": "worker_01",
  "submitted_at": "2026-05-10T08:30:15Z",
  "form_opened_at": "2026-05-10T08:29:42Z",

  "presence": {
    "qr_scanned_at": "2026-05-10T08:29:38Z",
    "qr_value": "QR_A104_v2",
    "gps": {"lat": 18.70125, "long": 98.90458},
    "gps_delta_meters": 2.3
  },

  "form_data": {
    "fertilizer_type": "NPK-16-16-16",
    "amount_kg": 1.5,
    "macro_used": "morning_feed"
  },

  "photo_requirement": {
    "required": true,
    "reason": "random_audit",
    "audit_selection_seed": "a3f8b2"
  },

  "photo": {
    "url": "https://storage.link/photo_8f3a.jpg",
    "exif_timestamp": "2026-05-10T08:30:05Z",
    "exif_gps": {"lat": 18.70124, "long": 98.90457},
    "capture_method": "camera"
  },

  "validation": {
    "status": "passed",
    "flags": []
  },

  "notes_audio_url": null,
  "notes_text": null
}
```

**`photo_requirement.reason` values:**
- `task_default` — the task definition requires a photo (pest inspection, disease report, harvest grading, etc.).
- `random_audit` — routine task selected by the audit sampler. Worker sees the photo prompt; their `trust_tier` determines selection probability.
- `alert_followup` — task was created in response to an alert, photo required for verification.
- `none` — no photo expected. The `photo` field will be null.

**Why this shape:**
- `form_opened_at` vs `submitted_at` → catches the <10s completion-speed flag.
- `qr_scanned_at` is separate because the scan gates the form; the timing between scan and submit is itself a signal.
- `form_data` is **untyped** at the DB level — the schema is defined per task in `task_definitions`. Different tasks have wildly different fields.
- `photo_requirement` is set by the server when the assignment is fetched, not by the client. This prevents a worker from skipping the photo by tampering with the request.
- `validation.flags` is populated by the server on write. With photos deprioritized for routine tasks, the timing/GPS/sequence checks below carry the primary load:
  - `gps_off_tree` — submission GPS >15m from tree's known location.
  - `gps_missing` — GPS not captured (worker may have denied permission).
  - `completion_too_fast` — submit minus form_opened < task's `min_completion_seconds`.
  - `qr_to_submit_too_fast` — scan-to-submit duration below realistic floor for this task type.
  - `impossible_travel` — implied speed from previous log to this log exceeds 6 km/h (walking with equipment).
  - `bulk_submission` — 20+ submissions from this worker within 5 minutes.
  - `sequence_pattern_suspect` — perfectly even inter-log intervals over 10+ logs (humans don't work like metronomes).
  - `exif_timestamp_mismatch` — photo EXIF time differs from submit time by more than the configured window (when photo exists).
  - `exif_gps_mismatch` — photo EXIF GPS differs from tree location (when photo exists).
- `assignment_id` links back to who was *supposed* to do this — if it's null, the worker logged something unprompted (which is itself a flag worth examining).

---

## 3. `sets` — fruit generations

One row per colored generation. Created when a worker logs a bloom event.

```json
{
  "set_id": "set_a104_2026_red",
  "tree_id": "A-104",
  "color": "red",
  "season": "2026-main",

  "bloom_log_id": "log_3c4d...",
  "bloom_date": "2026-02-01",
  "estimated_maturation_days": 120,

  "initial_fruit_count": 18,
  "current_fruit_count": 12,
  "premium_fruit_count": 5,

  "status": "developing",
  "harvest_window_start": "2026-05-27",
  "harvest_window_end": "2026-06-07",

  "harvest_log_ids": [],
  "harvested_at": null,

  "history": [
    {"date": "2026-02-01", "event": "bloom", "fruit_count": 22, "log_id": "log_3c4d..."},
    {"date": "2026-03-15", "event": "thinning", "fruit_count": 18, "log_id": "log_5e6f..."},
    {"date": "2026-04-10", "event": "natural_drop", "fruit_count": 12, "log_id": "log_7a8b..."}
  ]
}
```

**Notes:**
- `set_id` is composite — tree + season + color. Solves the "Red isn't unique across years" problem.
- `harvest_window_start/end` are *computed* from `bloom_date + estimated_maturation_days ± buffer`. Don't store `est_harvest_date` as a single value; harvesting has a window, not a date.
- `history` is a denormalized convenience copy. The authoritative record is still in `task_logs` — `history` just makes timeline rendering fast.

---

## 4. `fruits` — individually-tagged Grade A fruits

Created when a worker applies a gold clip. This is your answer to the "did 2 fruits drop or get downgraded?" problem.

```json
{
  "fruit_id": "fruit_a104_red_g01",
  "set_id": "set_a104_2026_red",
  "tree_id": "A-104",

  "physical_tag": {
    "type": "gold_clip",
    "tag_id": "G-7821"
  },

  "tagged_at": "2026-04-15T09:00:00Z",
  "tagged_by": "worker_02",
  "tag_log_id": "log_9c2d...",

  "current_status": "developing",
  "status_history": [
    {"status": "tagged_premium", "date": "2026-04-15", "log_id": "log_9c2d..."},
    {"status": "developing", "date": "2026-04-15", "log_id": "log_9c2d..."}
  ],

  "final_grade": null,
  "harvested_at": null,
  "harvest_log_id": null
}
```

**Notes:**
- The `tag_id` on the physical gold clip means workers can re-scan a specific fruit later. If a gold-clipped fruit drops, the worker scans the clip's tag and logs "lost." Count integrity is preserved.
- `final_grade` only fills in at harvest. Until then it's a *candidate* premium, not a confirmed one.
- This collection is small relative to `task_logs` — maybe 10–20% of fruits get tagged.

---

## 5. `workers`

```json
{
  "worker_id": "worker_01",
  "display_name": "U Aung",
  "language": "my",
  "assigned_zones": ["North-A", "North-B"],
  "active": true,

  "reliability": {
    "last_computed": "2026-05-23T00:00:00Z",
    "logs_total": 1247,
    "logs_flagged": 8,
    "flag_rate": 0.0064,
    "avg_completion_seconds": 47,
    "trust_tier": "standard"
  }
}
```

`trust_tier` (e.g. `trusted` / `standard` / `audit`) is what the audit sampler reads from. When a worker fetches a routine task, the server rolls against the task's `photo_policy.audit_rate_by_tier[worker.trust_tier]` to decide whether this submission will require a photo. Workers don't know in advance which task will be audited, which preserves the deterrent effect.

**Tier transitions** are automatic based on `flag_rate` and log volume — e.g. >50 clean logs and flag_rate <0.5% moves to `trusted`; any Tier 1 fraud flag moves to `audit` for at least 30 days. Manager can override manually.

---

## 6. `task_definitions` — manager-defined form schemas

This is what lets the manager change which fields appear without a code deploy.

```json
{
  "task_def_id": "soil_acidity_check_v2",
  "task_type": "soil_check",
  "display_name": {
    "th": "ตรวจค่ากรดดิน",
    "my": "မြေဆီလွှာစစ်ဆေးခြင်း",
    "icon": "soil_ph"
  },
  "photo_policy": {
    "mode": "audit_only",
    "audit_rate_by_tier": {
      "trusted": 0.01,
      "standard": 0.05,
      "audit": 0.15
    }
  },
  "requires_qr_scan": true,
  "min_completion_seconds": 15,
  "min_qr_to_submit_seconds": 20,

  "fields": [
    {
      "field_id": "ph",
      "type": "numeric_counter",
      "label_icon": "ph_meter",
      "min": 3.5,
      "max": 8.0,
      "warn_below": 4.5,
      "warn_above": 7.5,
      "step": 0.1,
      "required": true
    },
    {
      "field_id": "moisture",
      "type": "numeric_counter",
      "label_icon": "water_drop",
      "min": 0,
      "max": 100,
      "warn_above": 90,
      "required": true
    }
  ]
}
```

**`photo_policy.mode` values:**
- `always` — photo required every time. Use for tasks where the photo *is* the evidence: `pest_inspection`, `disease_report`, `harvest_grading`, `severe_condition_report`.
- `audit_only` — photo required only when the audit sampler selects this submission. Use for routine tasks: fertilizer, watering, soil checks, flower counts. Rate scales by worker trust tier.
- `never` — photo never required. Use for ultra-fast tasks where photos would just add friction (e.g. confirming a tree was visited).

**Why this matters:** When K. Nong wants to add a new field next season, she edits the task definition — no engineering work needed. This is also where your "input validation — reasonable ranges" table lives, and where the audit-rate dial gets adjusted if she wants tighter or looser spot-checking.

---

## 7. `assignments`

```json
{
  "assignment_id": "assn_2026_05_23_w01_a104",
  "worker_id": "worker_01",
  "tree_id": "A-104",
  "task_def_id": "morning_feed_v3",
  "scheduled_for": "2026-05-23",
  "priority": "normal",
  "source": "recurring",
  "triggered_by_alert_id": null,
  "completed_log_id": null,
  "status": "pending"
}
```

`source` values: `recurring` (from schedule), `alert_triggered` (from manager response to alert), `manual` (manager one-off). This is what feeds the worker's "today's task queue."

---

## 8. `alerts`

```json
{
  "alert_id": "alert_3f2a...",
  "tier": 1,
  "category": "fraud_signal",
  "subtype": "gps_mismatch",
  "tree_id": "A-104",
  "worker_id": "worker_01",
  "triggered_by_log_id": "log_8f3a...",
  "created_at": "2026-05-10T08:30:20Z",
  "status": "open",
  "resolution": null,
  "suggested_response_task_def_id": null
}
```

For Tier 1 health alerts (severe pest spotted), `suggested_response_task_def_id` is what powers the one-tap "assign response task" flow.

---

## Key Relationships

```
trees (1) ──< sets (many) ──< fruits (many, optional)
   │
   └──< task_logs (many) ──> alerts (0..many per log)
                  │
                  └── references: assignment, task_definition, worker
```

A single bloom log creates: 1 task_log entry, 1 sets row.
A single Grade-A tagging log creates: 1 task_log entry, 1 fruits row, updates 1 sets row.
A single harvest log creates: 1 task_log entry, updates the sets row, updates each fruits row that was harvested.

---

## What This Buys You

1. **Audit trail by construction.** Every state change traces to a worker + timestamp + GPS, with a photo when required. Disputes are resolvable.
2. **Schema evolution without migrations.** Adding a new field to "soil check" is a task_definition edit, not a DB migration.
3. **Fraud detection has structure to work with.** Flags live on `task_logs.validation`; reliability rolls up to `workers.reliability`; the audit sampler enforces unpredictable photo checks without universal storage cost.
4. **Rebuilds are possible.** If `derived_state` ever drifts from reality, you replay logs to rebuild it. The logs are the truth.
5. **Grade A integrity.** Individual fruit tagging eliminates the "did the count change because of drops or miscounts?" ambiguity.
6. **Storage cost stays bounded.** With photos required only for evidence-bearing tasks and ~5% of routine submissions, photo volume drops by ~85% vs. universal capture — making 4000-tree scale affordable.

---

## Open Questions for the Meeting

- **Set color reuse:** Within one season, can the same tree have two "Red" sets if blooms come in waves? (If yes, color alone isn't enough — need a sub-index.)
- **Worker reliability decay:** Should old flags expire? A worker who was sloppy 6 months ago and clean since shouldn't be permanently audit-tier. Proposed: flags weight-decay over 90 days.
- **Offline write conflicts:** If two workers log on the same tree offline and sync later, what's the merge rule? (Probably: both logs preserved, both visible in history; derived_state recomputed from both.)
- **Audit rate calibration:** Starting proposal is 1% / 5% / 15% by trust tier. Does K. Nong want to start tighter (e.g. 5% / 10% / 25%) during the 600-tree pilot and loosen once trust is established?
- **Audit photo review workflow:** When a random-audit photo comes in, who reviews it and when? Inline as it arrives, batched daily, or only on demand when something else looks suspicious?
- **Demo for K. Nong:** Worth scripting a short demo that triggers each fraud flag deliberately, so she can see the timing/GPS system catching things without photos. This is the trust-building step before she'll be comfortable at 4000-tree scale.
