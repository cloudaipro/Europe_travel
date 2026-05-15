# Review Feedback — Step 1 (Round 2 — Live Browser Sweep)

Date: 2026-05-14
Reviewer: Arch (after running multi-viewport sweep in claude-in-chrome on the running app at http://127.0.0.1:8000/)
Verdict: **CONDITIONALLY CLEAR — 4 fixes required, all small.**

Previous round (Richard static review): cleared with 3 should-fixes already applied. This round was a live runtime sweep at 1280 / 768 / 500 px widths.

---

## What Passes ✓

- **Desktop @ 1280px** — Plan tab renders identically to pre-change (2-column, map + 38% right panel, day pills, hero card, sub-tabs). No visible delta. Pixel-frozen.
- **Tablet @ 768px** — Plan tab renders as narrow side panel + map; sheet shell + day-strip-mobile + app bar correctly hidden.
- **Mobile @ 500px (390 OS window)** — App bar (Publish stub, search disabled, gear, logout), sticky day strip (Overview / Day 1..N / + / −), full-bleed map all render correctly.
- **Tour tab mobile** — pill bar (Cheap eats / Phrases / Washroom / Currency / Weather) horizontal scroll works; stop cards full-width with Navigate / Check-in / Photo / Voice buttons; day strip works.
- **Memory tab mobile** — `Your journey` map renders, day cards stack, journal section below.
- **Console** — zero application errors at any viewport. Only chrome-extension noise (`common loaded`, `releaseNoteVersionReceived`) from a browser extension, not the app.
- **Sheet content** when forced visible — header, sub-tabs, transit filter, blue Auto-sort CTA, drag handle, stop cards all render per spec.
- **Sheet drag math (forced)** — `sheetSnap('half')` correctly applies `.sheet--half` class and computes `matrix(1,0,0,1,0,280.14)` (= translate(0, calc(100%-50dvh))). Math is right.

---

## What Fails ✗ — Required Fixes

### BUG-1 — BLOCKER — Sheet invisible by default on mobile (z-index conflict with Leaflet)

**Symptom:** At mobile width (<768px), after `initPlanSheet()` + `sheetSnap('half')`, the sheet has correct geometry (`top:53; bottom:0; transform:translateY(280px)`, `bg:rgb(255,255,255)`, `display:flex`, `opacity:1`) and `document.elementFromPoint(250, 500)` returns the sheet's H3 — but **screenshots show only the map** in the lower half where the sheet should be.

**Root cause:** Leaflet's internal panes (`.leaflet-map-pane`) carry `z-index: 400`, with tile/marker/overlay panes at 200–700. Bob's sheet uses `z-index: 40`. Hit-testing finds the sheet (because Leaflet panes are inside the map container, which is a separate stacking context from the sheet), but the **map's tile pane composites over the sheet visually** because it's painted later in the stacking order due to how transform-3d-promoted layers interact.

**Confirmed fix:** setting `style.zIndex='1000'` on `.plan-sheet-shell` immediately made the sheet visible. Recommend setting **`z-index: 1000`** (not 40) on `.plan-sheet-shell` in mobile media block; also bump `.plan-fab-cluster`, `.plan-locate-fab`, `.plan-reroute-fab`, `.mobile-app-bar`, and `.day-strip-mobile` to **z-index 1001** so they stay above the sheet. Verified working.

**File:** `TourCompanion/server/frontend/index.html` — mobile media block, ~line 380–420 region.

---

### BUG-2 — BLOCKER — Plan FABs leak to Tour + Memory tabs

**Symptom:** On Tour and Memory tabs at mobile width, the two small Apple-Maps-style icons (`.plan-locate-fab` + `.plan-reroute-fab`) — and likely `.plan-fab-cluster` — remain visible floating on the right side of the screen. They are Plan-tab-only controls.

**Root cause:** Bob placed `.plan-fab-cluster`, `.plan-locate-fab`, `.plan-reroute-fab` as `position: fixed` siblings, which means they don't hide when `#tab-plan` has `.hidden`. The CSS shows them based on viewport width only, not active tab.

**Fix options (pick one):**
- (a) **Move the three FAB elements inside `<section id="tab-plan">`** so they inherit the `.hidden` from `setTab()`. This is the cleanest fix.
- (b) Add CSS rule that hides FABs when `#tab-plan.hidden`: e.g. `#tab-plan.hidden ~ .plan-fab-cluster, #tab-plan.hidden ~ .plan-locate-fab, #tab-plan.hidden ~ .plan-reroute-fab { display: none !important; }` — but this is fragile (relies on sibling order).
- (c) JS-driven: `setTab()` toggles a body class like `body.on-plan` and FAB CSS keys off that. Adds complexity.

Recommend option (a).

**Also on tablet (768px) sweep:** the same FAB leak appears even though sheet shell is hidden — confirms FABs are not scoped properly even within Plan tab. After fix (a), additionally ensure FAB cluster + locate + reroute are scoped to `@media (max-width: 767px)` only and stay `display: none` at ≥768px. Verify the tablet-block selector list explicitly includes these.

---

### BUG-3 — HIGH — Day mismatch on initial load

**Symptom:** Day-tab strip pills show "Day 1" as active (underlined). Sheet content shows "Day 6 · Sat 23 May · Library + Synagogue + NY Café + Heroes Sq + Zoo + Opera · 6 STOPS · 8.4 km WALK".

**Root cause:** Bob's `selectPlanDay()` mobile branch resets the sheet to half, but `_currentPlanDay` (or whatever variable backs `renderPlanDayContent`) was set to 6 by some prior interaction (likely a `selectStop` call from a marker click during fitBounds animation). On fresh page load this should default to Day 1. Either the desktop floating day-pill click handler is firing for Day 6, or `renderPlanDayTabs()` is auto-selecting the last day.

**Verify + fix:** check `renderPlan()` / `renderPlanDayTabs()` / `setPlanDay()` initial-state logic. Default day on first render should be Day 1 (or "Overview"). The mobile day strip's `selectPlanDay` calls must keep desktop floating-pill in sync.

**File:** `TourCompanion/server/frontend/index.html` — `renderPlanDayTabs()` (~line 1095) and `renderPlan()` tail (~line 1031).

---

### BUG-4 — MEDIUM — `.plan-fab-cluster` not visibly rendered in half state

**Symptom:** In half state with sheet visible (after the z-index fix), the spec-required orange `+` FAB + black map/list toggle FAB **do not appear**. Only the smaller locate / reroute FABs show.

**JS rect check at mobile width:** `fab cluster: display=flex z=50 rect={t:193, l:428, w:56, h:124}` — element IS in DOM with geometry, but at top=193 it sits *above* the sheet top (333) and *above* the map area (map starts at top=100). Width 56 height 124 places it at x:428-484 y:193-317.

Looking at the live screenshot, this region is blank — either the orange/black background colors aren't applied, the children inside the cluster are `display:none`, or the cluster is being painted behind something.

**Action:** Bob should inspect `.plan-fab-cluster > .plan-fab-add` and `.plan-fab-cluster > .plan-fab-toggle` computed styles + visible-bounds. Verify the orange `#E8A33D` and slate-900 `#0F172A` backgrounds, the 56×56 circles, and that they're not collapsed by `flex-shrink` or hidden by an `@media` rule.

Also after fix: confirm the anchor logic in `--sheet-current-h` math places the cluster **below the sheet's bottom edge** when sheet is in `half` (so the cluster sits over the map area, not above the sheet top). Spec §3.4 has the cluster anchored to the bottom-right of the map area, not pinned to the sheet's top.

---

## Re-test Required After Fixes

Once Bob lands the four fixes, re-run:
- Mobile @ 500px: Plan tab — sheet visible by default; orange + + black toggle FAB visible at bottom-right of map; day strip Day 1 matches sheet content "Day 1".
- Mobile @ 500px: switch to Tour, then Memory — confirm Plan FABs no longer visible.
- Mobile @ 500px: drag sheet handle peek ↔ half ↔ full; tap stop card; tap map marker; switch day via strip.
- Tablet @ 768px: confirm no FAB leak.
- Desktop @ 1280px: pixel-identical to baseline.

---

## Summary for Project Owner

Build is structurally sound — all design tokens, breakpoints, sheet drag math, function preservation, keyboard guard, safe-area handling, Tour pill bar, Memory stack, and desktop preservation are correct. Two blockers (sheet z-index, FAB tab-leak) and two smaller issues (day mismatch, FAB cluster visibility) found in live runtime. All four are small, targeted fixes. Estimate one more Bob round (under 30 min) to clear.
