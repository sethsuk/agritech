# Domain glossary

Names this codebase uses for farm concepts. Add a term here when a module is named after
an idea that isn't already obvious from the schema — especially when the name settles a
question that was previously answered differently in different files.

`CLAUDE.md` covers architecture and workflow; this file covers vocabulary.

---

## Derived state

Facts about a tree or a worker that are **computed from `task_logs` and `alerts`** rather
than entered by anyone. Lives in `lib/derived/`.

The schema originally described these as cached columns "recomputed by a background job."
That job was never written, so for the whole life of the project the manager UI rendered
SQL defaults as if they were measurements: every worker `0 logs / 0.0% flag rate`, every
tree a green `100%`. The rule now is **every derived value has exactly one writer, or it
is not stored at all.**

Three storage strategies, chosen per concept and hidden behind the module's interface —
callers never need to know which applies:

| Concept | Strategy | Why |
|---|---|---|
| Worker reliability | computed on every read | a handful of workers; one query; cannot go stale |
| Tree open-alert count | cached in `trees.derived_open_alerts` | ~1000 trees; the list page can't aggregate per row |
| Days since last log | never stored — derived from a timestamp | it changes with the passage of time, so no stored integer can stay correct |

### Reliability window

Worker reliability is always reported as **two windows side by side**: `recent` (the
trailing 90 days, `RELIABILITY_WINDOW_DAYS`) and `allTime`. All-time alone was rejected
because a worker who was sloppy once can never recover the number, which makes it
unactionable; recent alone hides a long-run pattern.

A **flagged** log is one whose `validation_status` is `flagged`. Rejected submissions are
never written to `task_logs`, so they cannot appear in any window.

### Tree health

A tree's health is stated **only as its open-alert status** — `ok` / `watch` /
`attention` (ปกติ / เฝ้าระวัง / ต้องดูแลด่วน). There is deliberately **no health score**.

`trees.derived_health_score` still exists in the schema but is now dead: nothing reads it
and nothing writes it. It was a 0..1 number with no formula anywhere in the codebase, and
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
