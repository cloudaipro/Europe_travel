# Architect Brief — Step 3: Wire Auto-sort + Day Add/Remove

---

## Step 3 — Wire two of the disabled stubs from Step 1 (KG-3 partial close)

### Goal

Make the **Auto-sort** CTA pill and the **+ / −** day controls in the mobile day-strip do real work. Keep Publish + orange `+` stop FAB as stubs (they need UX decisions beyond this step).

### Scope split

- **Auto-sort = frontend-only.** Reuse the existing `PUT /api/trips/days/{day_id}/stops/order` endpoint. Frontend sorts the current day's stops by `time_label` ascending, then calls the reorder endpoint with the new order, then refreshes the trip.
- **Day add = new endpoint.** `POST /api/trips/{trip_id}/days` — appends an empty day with `n = max(n)+1`, `date_label` computed from `trip.start_date + (n-1) days`, `theme = ""`, `mode = ""`. Also extends `trip.end_date` by 1 day.
- **Day remove = new endpoint.** `DELETE /api/trips/{trip_id}/days/{day_n}` — removes the **last** day only (refuse if `day_n != max(n)` to avoid mid-trip gaps). Cascade deletes stops via existing relationship. Decrements `trip.end_date` by 1 day. Refuse with 400 if only 1 day remains.

### Source of truth

- Backend: `TourCompanion/server/app/routes/trips.py` — add 2 endpoints. Reuse `_owned()`, `_trip_to_detail()`. Use `from datetime import timedelta`.
- Frontend: `TourCompanion/server/frontend/index.html` — wire 3 onclick handlers + add 3 small async functions.

### Decisions (locked)

- **No schema migrations.** Day model already has all needed fields (`n`, `date_label`, `theme`, `mode`). Trip has `end_date` which we update.
- **No `n` renumbering on day remove.** Since we only allow removing the LAST day, `n` stays gap-free naturally.
- **No mid-day insertion.** + always appends after the last day.
- **Auto-sort time parsing.** `time_label` can be "09:00", "9:00", "10:49", or empty. Parse as `HH:MM` to minutes-since-midnight; empty strings sort last. Stable sort.
- **Confirmation modals: none.** Day remove on the LAST day is recoverable (user can re-add and re-paste stops). Auto-sort is reversible (manual drag-reorder still works). Keep UX fast.
- **Frontend refresh strategy.** After each mutation, call existing trip-fetch path (`loadTrip(TRIP.id)` or equivalent — grep for it) and re-render via existing `renderPlan()` etc.

### Backend endpoint specs

```
POST /api/trips/{trip_id}/days
Body: {}                                    # no body needed
Response 201: TripDetail (full refreshed trip)
Errors: 404 (trip not found / not owned)

DELETE /api/trips/{trip_id}/days/{day_n}
Response 200: TripDetail
Errors: 404 (trip/day not found), 400 (day_n != max(n)), 400 (only 1 day left)
```

Both endpoints use `_owned()` for auth and return `_trip_to_detail()` to give the frontend a fully refreshed trip in one round-trip.

### Frontend wiring

- **Auto-sort CTA pill** — currently `disabled title="Coming soon"`. Remove the disabled attr; add `onclick="autoSortCurrentDay()"`. Implement:
  - Get current day's stops by `time_label` ascending order.
  - Call `PUT /api/trips/days/{day_id}/stops/order` with the new `stop_ids` list.
  - On success, reload trip and re-render Plan tab. Keep current day selected.
- **`+` day control** — currently `disabled title="Coming soon"`. Wire to `addDay()` async helper that POSTs the new endpoint and reloads.
- **`−` day control** — wire to `removeLastDay()` — POSTs the DELETE endpoint with `max(n)`. Show a non-blocking `alert()` (existing pattern) if backend returns 400 (only 1 day left).
- Show a brief loading state on the CTA pill (e.g. opacity 0.6, disabled) during the round-trip. Re-enable after.

### Flags — do not guess

- **Existing trip-reload helper.** Grep frontend for `loadTrip(`, `fetchTrip(`, or the pattern that initially populates `TRIP`. Reuse it. If none, add a minimal `await refreshTrip()` that re-fetches and re-renders.
- **Stop ID source.** `_stop_to_out()` returns `id`. Frontend `TRIP.days[i].stops[j].id` is the source for the reorder payload.
- **time_label parse fail.** If `time_label` is unparseable (e.g. "morning"), treat as `Infinity` (sort to end). Don't throw.
- **End-state of the disabled buttons.** Keep them styled identically (text, colors). Just remove `disabled` and `title="Coming soon"`.
- **Don't touch Publish.** Stays a stub. Don't touch the orange `+` FAB (add-stop). Stays a stub.

### Definition of Done

- [ ] `POST /api/trips/{trip_id}/days` added in `routes/trips.py`. Returns full `TripDetail`. 404 on bad trip.
- [ ] `DELETE /api/trips/{trip_id}/days/{day_n}` added. Returns full `TripDetail`. 404 on bad trip/day, 400 on mid-trip or single-day attempt.
- [ ] Frontend `autoSortCurrentDay()` wired to Auto-sort pill.
- [ ] Frontend `addDay()` wired to `+` control.
- [ ] Frontend `removeLastDay()` wired to `−` control.
- [ ] Disabled-stub styling cleared on all three controls.
- [ ] Test in browser: Auto-sort visibly reorders stops; + adds a new day at end of day strip; − removes last day; trip state survives a refresh.
- [ ] No new console errors at any viewport.
- [ ] No backend test break (server reload-on-save will surface syntax issues; check uvicorn output).
- [ ] `handoff/REVIEW-REQUEST.md` appended with Revision 4 — Step 3.

---

## Builder Plan

Architect pre-approval (scope is tight and decisions locked):
- [x] **Pre-approved.** Bob: plan + build in one round. If you hit a real ambiguity, halt and write into REVIEW-REQUEST.md.

---
