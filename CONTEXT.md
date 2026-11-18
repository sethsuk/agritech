# Domain glossary

Names this codebase uses for farm concepts. Add a term here when a module is named after
an idea that isn't already obvious from the schema — especially when the name settles a
question that was previously answered differently in different files.

`CLAUDE.md` covers architecture and workflow; this file covers vocabulary.

---

## Derived state

Facts about a tree, a worker or a set that are **computed from `task_logs` and `alerts`**
rather than entered by anyone. Computed by the SQL views in `supabase/migrations/013_views.sql`;
`lib/derived/` holds the shapes, formatting and the thin fetchers.

The schema originally described these as cached columns "recomputed by a background job."
That job was never written, so for the whole life of the project the manager UI rendered
SQL defaults as if they were measurements: every worker `0 logs / 0.0% flag rate`, every
tree a green `100%`. The rule now is **every derived value has exactly one writer, or it
is not stored at all** — and in practice none of them are stored:

| Concept | Where | Why not stored |
|---|---|---|
| Worker reliability | `worker_stats` view | a handful of workers; one aggregate; cannot go stale |
| Tree open alerts / last log / open sets | `tree_summary` view | ~1000 trees is trivial for Postgres to group |
| Set counts (flowers, latest fruit count, harvested, remaining, lost) | `set_state` view | a stored count went stale on every correction or void |
| Days since last log | derived from a timestamp at render time | it changes with the passage of time |

Aggregation runs in Postgres, not by fetching rows into JS — PostgREST caps responses at
1000 rows, which silently froze every JS-side total once the farm had real volume.

The one stored lifecycle fact is a set's `closed_at` / `close_reason`, because a unique index
("one open set per ribbon colour per tree") needs it. Its only writer is `sync_set()`, which
recomputes it from `set_state` after every log, correction or void touching the set.

### Reliability window

Worker reliability is always reported as **two windows side by side**: `recent` (the
trailing 90 days, `RELIABILITY_WINDOW_DAYS`) and `allTime`. All-time alone was rejected
because a worker who was sloppy once can never recover the number, which makes it
unactionable; recent alone hides a long-run pattern.

A **flagged** log — shown to managers as **"needs review"** — is one whose `validation_status`
is `flagged`. Rejected submissions are
never written to `task_logs`, so they cannot appear in any window.

### Tree health

A tree's health is stated **only as its open-alert status** — `ok` / `watch` /
`attention` (ปกติ / เฝ้าระวัง / ต้องดูแลด่วน). There is deliberately **no health score**.

`trees.derived_health_score` has been dropped. It was a 0..1 number with no formula anywhere in the codebase, and
inventing a horticultural formula is a decision for the farm, not for the code. If the
farm later defines what makes a tree unhealthy, `treeHealthFrom` in
`lib/derived/treeHealth.ts` is the one place that changes.

Escalation is by **tier before count**: any open `tier_1` alert means `attention`
regardless of how many alerts there are.

---

## Photo audit draw

Whether a submission must carry a photo, when the task's `photo_policy_mode` is
`audit_only`. Lives in `lib/photoAudit.ts`.

The draw is **deterministic per (worker, tree, task, calendar day)**, keyed by HMAC. This
is the whole point of the module: the previous `Math.random()` was re-evaluated on every
form open, and because the task form calls `start-log` on each mount, a worker who drew
"photo required" could leave and re-enter until they drew their way out. The signed token
in `lib/logToken.ts` made the decision unforgeable but not un-resamplable — those are
different properties.

Same worker, same tree, same task, same day → same answer. Next day → fresh draw.

---

## Staff

`manager` or `owner`. Written once, as `isStaff()` in `lib/auth/currentUser.ts`.

Two gates share that predicate, differing only in how they refuse:

- `requireStaff()` — for route handlers; returns a 401/403 `NextResponse`.
- `currentUser()` + `isStaff()` — for server components and layouts; the caller redirects.

Before this split the comparison was spelled three different ways across `app/page.tsx`
and the two route-group layouts. Note the historical cost of it being an idiom rather than
a module: it was copied to six route handlers, `/api/manager/alerts` was missed, and any
logged-in worker could read and dismiss fraud alerts about themselves until the gate
became a real module.

---

## Filled in

Whether a worker has supplied a value for a required task field. One definition, in
`lib/validation/fields.ts`, used by **both** the task form and the server.

Subtlety worth keeping: an empty `grade_counter` object (`{}`) counts as *missing*. The
browser used to check only `undefined || ""`, so a harvest form with no grades entered
passed the client check and was then rejected by the server with an untranslated English
reason shown to a Thai- or Burmese-speaking worker.

---

## Set (ชุดผล)

One bloom wave on one tree, marked in the field with a coloured ribbon (red / blue / yellow /
white). A set is **open** from its bloom log until it is harvested out, closed by a "last pick",
found to have no fruit left, or its bloom is voided. A tree can have several open sets at once,
but **never two open sets with the same ribbon colour** — that is what lets a harvest name its set
unambiguously.

- **Bloom flowers** — the flower count on the bloom log.
- **Fruit count check** (นับผลที่ติด) — a recount of fruit still on the tree. Most durian flowers
  never set fruit, and young fruit drops, so this is how losses are recorded before harvest. A
  recount can only go down.
- **Remaining** — what should still be on the tree: latest fruit count (or bloom flowers if never
  counted) minus fruit harvested since.
- **Lost** — for a set closed by harvesting: bloom flowers that never became harvested fruit.
- **Over-harvest** — harvesting more than *remaining*. Allowed (field counts are imperfect) but
  flagged for a manager, so harvests stay accountable to the bloom log.
