# Review Feedback — Step 3 (Auto-sort + Day Add/Remove)
Date: 2026-05-14
Reviewer: Richard
Verdict: CLEAR

## Tier 1 findings
- **Ownership check** — PASS. `add_day` (trips.py:96) and `remove_day` (trips.py:113) both call `_owned(db, user, trip_id)` as their first statement. Returns 404 on missing or non-owner before any mutation.
- **Cascade integrity** — PASS. `Day.stops` relationship at models.py:73 has `cascade="all, delete-orphan"`. `db.delete(target)` on the Day cascades to its Stops; nested `Stop.check_ins/photos/voice_notes` (models.py:96–98) also cascade. No orphans possible.
- **400 vs 404 distinction** — PASS. trips.py:114 returns 400 for "only day left", :117 returns 400 for non-last day, :120 returns 404 for missing day. `_owned` covers 404 for missing trip.
- **No SQL injection / authz bypass** — PASS. `trip_id: int`, `day_n: int` typed path params; all DB access via SQLAlchemy ORM (`db.get`, `db.delete`, attribute writes). No raw SQL anywhere in the new code.
- **No `await` outside async** — PASS. `refreshTrip`, `autoSortCurrentDay`, `addDay`, `removeLastDay` all declared `async`. Buttons call them via `onclick`; the returned promises are fire-and-forget which is fine.
- **Auto-sort early-exit** — PASS. index.html:1286 — `if (sortedIds.every((id, i) => id === day.stops[i]._stop_id)) return;` short-circuits before the disable-button + apiCall block.
- **`selectedPlanDay` consistency** — PASS. Module-scoped `let selectedPlanDay` at index.html:1029. All three new handlers reference it (1275, 1317, 1318). No `_currentPlanDay` references found.

## Tier 2 findings
- **date_label format** — PASS. `%a %d %b` produces "Fri 22 May" exactly matching seed data (budapest.py:63 "Fri 22 May", vienna_budapest.py:82 "Mon 18 May").
- **end_date adjustment** — PASS. Add: `if t.end_date < new_date: t.end_date = new_date` (only extends, never shrinks). Remove: `if t.end_date > t.start_date: t.end_date = end_date - 1 day` (guards against negative span, end never goes below start). Add/remove sequence is reversible with no drift.
- **Stop ID source for reorder** — PASS. `_stop_to_out` returns backend `s.id` as `id` (trips.py:24). `adaptTrip` maps that to `_stop_id` (index.html:1085). `autoSortCurrentDay` uses `_stop_id` (1283, 1286) — consistent with the existing reorder endpoint contract.
- **refreshTrip rebinds TRIP cleanly** — PASS. `adaptTrip(detail)` reassigns the module-level `TRIP` object fresh; old closures inside previous DOM handlers are discarded when `renderPlan` rebuilds the day content. No stale-TRIP risk in the new flow.
- **Race conditions** — NOTED. Double-tap on `+` will fire two POSTs. Backend computes `next_n = max(...)+1` inside one request scope; with SQLite under concurrent writes both requests could compute the same `next_n` and produce two Days with the same `n`. Low-risk for single-user travel-planning UX. Not a blocker. Log as `KG-5` in BUILD-LOG so the next builder considers either a brief request-time disable on `+` or a uniqueness constraint.

## Tier 3 findings
- **Error UX** — Acceptable for Step 3. `console.warn` on `addDay`/`autoSortCurrentDay` failures is bare-bones; `removeLastDay` does call `showSnack('Remove day failed')`, which is better UX. Consistency nit; do not block.
- **Disabled styling residual** — PASS. Bob removed `disabled` and `title="Coming soon"` from all three controls (lines 865, 866, 889). The remaining `disabled title="Coming soon"` on lines 795, 797, 898 are unrelated Publish / Search / `+` stop-add buttons that are still stubs per spec. No leftover CSS targeting `[disabled]` on the wired controls.

## Bob's judgment calls — Richard's calls
1. date_label format `%a %d %b` — YES. Matches existing seed.
2. apiCall vs authHeaders — YES. Reusing the existing wrapper is correct; it centralizes auth and 401 handling.
3. `_stop_id` / `selectedPlanDay` identifier — YES. These are the actual codebase names; using the brief's names would have produced broken code.
4. snack vs alert for "only day" failure — YES. Snack is the established pattern in this file.
5. No loading state on `+`/`−` — YES, with a caveat. Acceptable for Step 3 since the operations are fast. The Tier-2 race-condition note covers the double-tap concern; log to BUILD-LOG or accept it. Not blocking.

## Summary for Arch
Step 3 is clean. Both new endpoints are authorization-checked, return correct status codes, use the ORM (no raw SQL), and rely on the existing `cascade="all, delete-orphan"` chain for safe Day deletion. The frontend wires the three controls correctly, uses the actual codebase identifiers (`TRIP_ID`, `selectedPlanDay`, `_stop_id`, `_day_id`), gracefully early-exits Auto-sort when the day is already sorted, and clamps `selectedPlanDay` before re-render on remove. One item worth logging (KG-5: double-tap race on `+` can create two days with the same `n` under concurrent writes). No blockers; Step 3 is clear.
