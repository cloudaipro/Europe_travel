# Build Log
*Owned by Architect. Updated by Builder after each step.*

---

## Current Status

**Active step:** — (Step 5 closed)
**Last cleared:** Step 5 — KG-3a Add-stop FAB + endpoint — 2026-05-15
**Pending deploy:** NO (committed locally; no remote configured)

---

## Step History

### Step 5 — KG-3a Add-stop FAB + endpoint — Status: COMPLETE
*Date: 2026-05-15*

Files changed:
- `app/routes/trips.py` — +39 lines: `StopCreateIn` pydantic model + `POST /api/trips/{trip_id}/days/{day_n}/stops`. Lazy import `geocode_query`; best-effort `(0,0)` fallback if geocode fails or address empty.
- `frontend/index.html` — +93 lines: orange `+` FAB rewired; new `#add-stop-modal` overlay; `.as-*` CSS; `openAddStopModal`/`closeAddStopModal`/`submitAddStop` handlers; dedicated mobile-safe Esc listener.

Decisions:
- Own `#add-stop-modal` (separate namespace from the templated `#modal` system) — simpler than retrofitting `openModal(kind)`.
- `lat/lng = 0.0` on geocode miss, matching existing `_has_real_seed` convention; background geocoder may retry later.
- order_idx = `max(existing) + 1` (append).

Live verification:
- Modal opens via FAB tap, name required validation works.
- Submit "Belvedere Palace" with address "Prinz-Eugen-Strasse 27, 1030 Wien" geocoded successfully → lat=48.1912, lng=16.3798 (correct Vienna coords).
- Stop count incremented; UI refreshed; modal closed.
- 401/400/404 paths all verified via curl.

Deploy: committed locally 2026-05-15.

---

### Step 4 — KG-6 race + KG-7 +1 parser + KG-2 promo — Status: COMPLETE
*Date: 2026-05-15*

Files changed:
- `app/models.py` — `Stop.promo` JSON nullable column.
- `app/schemas.py` — `StopOut.promo` Optional[dict].
- `app/routes/trips.py` — `_stop_to_out` passes promo through.
- `app/seed.py` + `app/seed_data/vienna_budapest.py` — demo promo on Vienna Airport.
- `alembic/versions/8e2c011bf237_add_stop_promo.py` — new migration + idempotent op.execute seed.
- `frontend/index.html` — `esc()` helper, `.plan-promo-m` CSS + render, KG-6 try/finally on +/−, KG-7 "+N" regex parser, `adaptTrip` passes promo + URL scheme guard (https/http only).

Decisions:
- Promo shape: `{label, price, url}` JSON dict; nullable; mobile-only banner.
- KG-6: `try/finally` around button.disabled.
- KG-7: regex captures optional `\+(\d+)` for day offset; `dayOffset * 1440 + minutes` sort key.
- URL scheme guard: only `^https?://` allowed; otherwise href falls back to `#` (prevents `javascript:` XSS).

Reviewer findings:
- Richard hit usage limit mid-review; Arch self-reviewed inline.
- Arch checks: migration idempotent (WHERE promo IS NULL), downgrade drops column, `esc()` on all 3 promo fields, `target="_blank" rel="noopener"`, try/finally correct, regex anchored.
- Arch live sweep: API returns promo on stop 28 (Vienna Airport); after hard reload, promo banner renders with "DEAL Vienna eSIM (demo) €19 ›" in orange under Vienna Airport card.

Deploy: committed locally 2026-05-15.

---

### Step 3 — Wire Auto-sort + day add/remove (KG-3 partial close) — Status: COMPLETE
*Date: 2026-05-14*

Files changed:
- `TourCompanion/server/app/routes/trips.py` — +38 lines (`timedelta` import + `POST /api/trips/{trip_id}/days` `add_day` + `DELETE /api/trips/{trip_id}/days/{day_n}` `remove_day`). Reuses `_owned()`, `_trip_to_detail()`.
- `TourCompanion/server/frontend/index.html` — +65 lines (`refreshTrip()`, `autoSortCurrentDay()`, `addDay()`, `removeLastDay()` helpers; 3 onclick rewires; removed `disabled` + `title="Coming soon"` from Auto-sort CTA, `+`, `−`).

Decisions:
- Auto-sort is frontend-only — reuses existing `PUT /api/trips/days/{day_id}/stops/order` endpoint with stops re-sorted by `time_label` ascending.
- Day add: appends after last, `date_label = trip.start_date + (n-1) days` formatted `"%a %d %b"` (matches existing seed format), extends `trip.end_date` if needed.
- Day remove: only the last day, refuses if it's the only one. Cascade deletes stops via existing relationship. Pulls `trip.end_date` back by 1 day.
- Both new endpoints return full `TripDetail` for single-round-trip refresh.

Reviewer findings:
- Richard: CLEAR — 0 blockers, 1 should-fix (log race condition on `+` double-tap as KG-6). All 5 of Bob's judgment calls approved.
- Arch live sweep: add 10→11 days OK, remove 11→10 days OK, auto-sort verifiably re-orders stops (Day 1 demo data confirmed reordering after a manual mis-order). No console errors. Onclick handlers wired correctly. Discovered KG-7 (auto-sort parses "00:24 +1" as 24 min, sorting next-day timestamps to top).

Deploy: committed locally 2026-05-14.

---

### Step 2 — KG-1 mobile stop card redesign — Status: COMPLETE
*Date: 2026-05-14*

Files changed:
- `TourCompanion/server/frontend/index.html` — ~155 lines added (125 CSS mobile-scoped, 5 CSS hide rule ≥768px, 18-line `_catGlyph()` helper, ~25-line mobile card + transit row template inside `renderPlanDayContent`). Zero deletions. New CSS classes: `.plan-stop-card-m`, `.pscm-thumb`, `.pscm-badge`, `.pscm-info`, `.pscm-time-row`, `.pscm-cat-icon`, `.pscm-name`, `.pscm-duration`, `.pscm-nav-arrow`, `.plan-transit-row-m`, `.pttrm-icon`, `.pttrm-dur`, `.pttrm-chev`.

Decisions made:
- ALONGSIDE rendering: emit both `<details>` (desktop) and `.plan-stop-card-m` (mobile) per stop; CSS toggles visibility by viewport.
- Notes indicator pulls from `STATE.voice_notes[\`${n}-${i}\`]` + `STATE.stop_photos[\`${n}-${i}\`]` — same keys as Tour and Memory tabs.
- Duration fallback `"Stay 1h 00m"` literal (spec §3.5.1 names this format; stop data has no duration field).
- `.walk-connector` also hidden on mobile to prevent double-render alongside `.plan-transit-row-m`.
- `_catGlyph()` maps `_stopCategory()` output to spec §1.6 emoji; falls back to 🕒.
- Nav arrow uses `event.stopPropagation()` so card-body click doesn't double-fire.

Reviewer findings:
- Richard: CLEAR — 0 blockers, 0 should-fixes. All four of Bob's judgment calls approved.
- Arch live sweep: mobile cards render per spec at 390/500px; transit rows correct; tap card → flies map + snaps half; tap nav arrow → opens Google Maps in new tab; desktop 1280px shows only `<details>` (16/16 visible, 0/16 mobile-cards visible) — pixel-frozen.

Deploy: committed locally 2026-05-14.

---

### Step 1 — Mobile-first adaptive UI redesign (Plan / Tour / Memory) — Status: COMPLETE
*Date: 2026-05-14*

Files changed:
- `TourCompanion/server/frontend/index.html` — ~757 lines added (+~25 lines of in-place edits to existing functions: `renderPlanDayTabs`, `renderPlanDayContent`, `selectStop`, `selectPlanDay`, `setTab`, `renderPlan`, keydown listener wrapping). New CSS block (~295 lines) appended to `<style>`; new mobile app bar markup; new sheet/FAB/peek-strip/day-strip-mobile DOM inside Plan tab; new tour pill bar inside Tour tab; new ~173-line sheet JS module (sheetGetMode/sheetSnap/sheetTogglePeekFull/_sheet*PointerDown|Move|Up/initPlanSheet); new `renderPlanDayPeek` helper. All new rules scoped `@media (max-width: 1023px)`; desktop ≥1024px CSS untouched. New mobile-only DOM nodes default to `display:none` so desktop is unaffected.

Decisions made (judgment calls beyond the brief):
- **Stop card markup kept as `<details>`.** Spec §3.5.1 describes a flat horizontal card; I read §8.5 ("Reuse existing DOM for the Plan tab's right panel") as authority to leave the existing `<details>`/`<summary>` structure intact and let mobile typography/colors carry through. Re-templating the card risks breaking drag-reorder + `_onStopSummaryClick` + keyboard nav. Logged as KG-1; flagged for reviewer.
- **`#tab-plan[style]` `!important` override** chosen over removing the inline `style="top:56px"` — more surgical (purely additive).
- **Sheet height fallback uses `window.innerHeight`** instead of CSS-var lookup for the snap math (cheaper, dvh-equivalent in 99% of cases).
- **Peek-state DOM filter via CSS sibling selectors** on the sheet class (`.sheet--peek #plan-panel-header { display: none }`) keeps JS pure-snap; visibility is CSS-driven.
- **Locate / reroute / FAB-cluster anchoring** uses a single CSS var `--sheet-current-h` on `:root`, updated only at snap (not during drag) per spec §3.4.
- Mobile back arrow → `toggleTripPicker(event)` (per Q4 approval); dropdown menu inherits its existing positioning. If it looks awkward, follow-up tweak.
- **Map/list FAB stays visible in `full` state** while the `+` FAB hides (per spec §3.6).

Reviewer findings:
- Richard (static review): CONDITIONALLY CLEAR — 0 blockers, 3 should-fixes (transitionend leak, Search button stub, full-state FAB cluster anchor). All fixed by Bob in Revision 1.
- Arch (live multi-viewport sweep): found 4 runtime bugs not caught statically — (1) sheet z-index 40 blocked by Leaflet panes z=400+; (2) Plan FABs visible on Tour/Memory tabs (later: false positive from Chrome extension overlay, but Bob added belt-and-suspenders scoping anyway); (3) day mismatch (strip showed Day 1, content showed Day 6); (4) `.plan-fab-cluster` not painted in half state (same z-index root cause as #1). All fixed by Bob in Revision 2.
- Final runtime sweep: ALL GREEN at 1280 / 768 / 500 px. Zero application console errors. Desktop pixel-frozen confirmed. Sheet drag (peek/half/full), day-strip switching, Tour pill bar, Memory stack all functional.

Deploy: committed locally 2026-05-14. No remote push (no remote configured).

---

## Known Gaps
*Logged here instead of fixed. Addressed in a future step.*

- **KG-1** — Stop card in sheet uses existing `<details>` markup; spec §3.5.1 literal redesign deferred — logged 2026-05-14. **CLOSED 2026-05-14 (Step 2):** new `.plan-stop-card-m` markup added alongside `<details>`. Mobile shows new card (60×60 thumb + red shield badge + category-icon + time + name + duration + 36×36 nav arrow); transit row between consecutive stops. Desktop unchanged (16/16 details visible, 0/16 mobile cards visible at ≥768px).
- **KG-2** — Promo banner — logged 2026-05-14. **CLOSED 2026-05-15 (Step 4):** Stop.promo JSON field + Alembic migration + Pydantic + adaptTrip passthrough + mobile orange banner with URL scheme guard. Demo seeded on Vienna Airport.
- **KG-3** — Auto-sort CTA + `+` FAB + Publish + day `+`/`−` are disabled stubs (no backend) — logged 2026-05-14. **PARTIAL CLOSE 2026-05-14 (Step 3):** Auto-sort + day `+`/`−` wired. Remaining backend-deferred items: orange `+` add-stop FAB (needs new-stop UX) and Publish flow (needs share/access-control UX).
- **KG-6** — Day +/- race — logged 2026-05-14. **CLOSED 2026-05-15 (Step 4):** try/finally disables button during request.
- **KG-7** — Auto-sort "+N" notation — logged 2026-05-14. **CLOSED 2026-05-15 (Step 4):** regex `/^(\d{1,2}):(\d{2})(?:\s*\+(\d+))?/` adds `dayOffset * 1440` to sort key.
- **KG-4** — Visual scratch test at 1280px done via diff-read only — logged 2026-05-14. **CLOSED 2026-05-14:** verified live at 1280×800 in claude-in-chrome during runtime sweep; desktop pixel-identical to baseline.

---

## Architecture Decisions
*Locked decisions that cannot be changed without breaking the system.*

- **Single-file constraint** — all UI in `TourCompanion/server/frontend/index.html` — 2026-05-14.
- **Desktop ≥1024px is pixel-frozen** — any visual change at desktop is a regression — 2026-05-14.
- **Sheet snap state owned by CSS class on `.plan-sheet-shell`** (`sheet--peek/--half/--full`); JS only writes the class — 2026-05-14.
- **No new external libraries** — Tailwind CDN + Leaflet only — 2026-05-14.
