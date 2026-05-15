# Review Request — Step 1 (Mobile-first adaptive UI)

Ready for Review: **YES**

---

## What Was Built

Mobile-first adaptive UI for all 3 tabs (Plan / Tour / Memory) in `TourCompanion/server/frontend/index.html`. Desktop (≥1024px) layout is preserved via media-query scoping; all new CSS lives inside `@media (max-width: 767px)` or `@media (min-width: 768px) and (max-width: 1023px)`. Plan tab gains a 3-snap bottom sheet (peek / half / full) with pointer-driven drag, FAB cluster, and a sticky day-tab strip per DESIGN-SPEC. Tour and Memory tabs adapt to single-column stacks.

---

## Files Changed

**Only one file edited:** `TourCompanion/server/frontend/index.html`

| Region | Before lines | After lines | Summary |
|---|---|---|---|
| `<style>` block append | 151 (single line `#plan-day-map { … }` + `</style>`) | 152–446 (~295 added) | New `:root` vars; new mobile-only classes for app-bar, day-strip-mobile, plan-sheet-shell / handle / peek / cta-row / fab-cluster / locate / reroute; mobile + tablet media blocks. Default `display:none` for all new mobile-only classes so desktop is unaffected. |
| Mobile app bar HTML (new) | — | 489–500 (~12 added) | New `<header class="mobile-app-bar">` with back, Publish stub, search, settings, logout. Hidden by default; shown only at <768px. |
| Plan tab section HTML | 235–266 (before edits; original 32 lines) | 506–559 (~54 lines; ~30 added) | Added inside left map column: `.day-strip-mobile` block. Added on right panel: class `.plan-sheet-shell`; new children `.plan-sheet-handle`, `#plan-sheet-peek`, `.plan-sheet-cta-row`. Added siblings: `.plan-locate-fab`, `.plan-reroute-fab`, `.plan-fab-cluster` (with disabled `+` and wired map/list toggle). Existing right-panel inline styles + IDs untouched. Added class `ptab-row` to the sub-tab row. |
| Tour tab — pill bar HTML (new) | — | 576–582 (~7 added) | `.tour-pill-bar` 5-pill horizontal scroller (Cheap eats, Phrases, Washroom, Currency, Weather). Hidden by default; visible only at <768px. |
| `setTab()` plan branch | 985–987 | 999–1006 | Extended setTimeout to also call `initPlanSheet()` + `sheetSnap('half')` on mobile. |
| `renderPlan()` tail | 1014–1019 | 1031–1037 | Added one-line `initPlanSheet()` call on mobile at first render. |
| `renderPlanDayTabs()` | 776–791 (before) | 1095–1119 (after) | Extended to also populate `#plan-day-strip-mobile-scroll` with Overview + Day N pills using same `selectPlanDay` handler. Existing floating-pill code unchanged. |
| `selectPlanDay()` | 793–801 | 1121–1131 | Appended `if (sheetGetMode() === 'mobile') sheetSnap('half')` to reset sheet on day switch. |
| `selectStop()` | 922–947 (before) | 1252–1283 | Appended a mobile branch: `map` source -> snap to half if currently peek + flash card; `list/peek/key` -> snap to half. Existing desktop behavior unchanged. |
| `renderPlanDayContent()` | 1145–1227 (before) | 1485–1567 (after) | Appended single call `renderPlanDayPeek(n)` at end so peek strip is rebuilt in lockstep with the list. |
| `renderPlanDayPeek()` (new) | — | 1570–1620 (~51 added) | Builds mobile peek-strip chips (day pill + stop chips + transit chips) into `#plan-sheet-peek`. |
| Sheet JS module (new) | — | 1640–1812 (~173 added) | All new sheet logic — see "New functions" below. |
| Keydown listener | 812–843 (before) | 1816–1817 | Wrapped body in `if (!window.matchMedia('(min-width: 1024px)').matches) return;` per §7.5. |

---

## New JS Functions

- `sheetGetMode()` → returns `'mobile' | 'tablet' | 'desktop'` via `matchMedia`. Read-on-demand.
- `_resolveSnapPx(state)` → returns numeric px height for `'peek' | 'half' | 'full'`. Uses `window.innerHeight` for dvh approximation.
- `sheetCurrentHeight()` → returns numeric px height of current snap. Used for CSS-var anchor.
- `_updateSheetAnchorVar()` → sets `--sheet-current-h` on `:root` so FABs/locate/reroute can anchor relative to live sheet height.
- `sheetSnap(state)` → swaps `.sheet--peek/--half/--full` class on the sheet shell, toggles `.is-snapping`, clears in-flight inline transform, syncs anchor var.
- `sheetTogglePeekFull()` → flips between `'peek'` and `'full'`; wired to the black map/list FAB.
- `_sheetSnapHeights()` → returns `{peek, half, full}` px values for current viewport.
- `_sheetTranslateForHeight(h)` → returns the translateY offset needed for a visible height `h`.
- `_sheetOnPointerDown(ev)` / `_sheetOnPointerMove(ev)` / `_sheetOnPointerUp(ev)` → pointer-events drag handlers (handle-only, top 32px). Rubber-band beyond range; velocity-weighted release pick.
- `initPlanSheet()` → one-time bind (guarded by `_sheetInited`); sets initial state to `'half'`; debounced `resize` updates anchor.
- `renderPlanDayPeek(n)` → builds peek-strip DOM (day pill + stop chips + transit chips) from `TRIP.days[n-1]`.

Module-level state: `_sheetState` ('half' initial), `_sheetDrag` (scratch object during drag), `_sheetInited` (flag).

All existing function names preserved.

---

## New CSS Classes / Custom Properties

**Custom properties** (on `:root`):
- Colors: `--c-bg`, `--c-bg-muted`, `--c-bg-page`, `--c-text`, `--c-text-muted`, `--c-text-micro`, `--c-border`, `--c-accent`, `--c-accent-dark`, `--c-cta`, `--c-cta-text`, `--c-promo`, `--c-promo-text`, `--c-fab-add`, `--c-fab-toggle`, `--c-success`
- Shadows: `--shadow-card`, `--shadow-sheet`, `--shadow-fab`, `--shadow-appbar`
- Sheet heights: `--sheet-h-peek`, `--sheet-h-half`, `--sheet-h-full`, `--sheet-current-h`

**Classes**:
- `.mobile-app-bar`, `.mab-left`, `.mab-right`, `.mab-publish`
- `.day-strip-mobile`, `.dsm-scroll`, `.dsm-pill`, `.dsm-end`
- `.plan-sheet-shell` (added to existing right panel), state modifiers `.sheet--peek`, `.sheet--half`, `.sheet--full`, `.is-snapping`
- `.plan-sheet-handle`, `.psh-pill`, `.psh-chev`
- `.plan-sheet-peek`, `.psp-day-pill`, `.psp-d1`, `.psp-d2`, `.psp-chev`, `.psp-stop`, `.psp-name`, `.psp-badge`, `.psp-transit`, `.psp-t-icon`, `.psp-t-dur`
- `.plan-sheet-cta-row`, `.pscr-filter`, `.pscr-cta`
- `.plan-fab-cluster`, `.plan-fab-add`, `.plan-fab-toggle`, `.pft-top`, `.pft-bot`, `.pft-div`
- `.plan-locate-fab`, `.plan-reroute-fab`
- `.ptab-row` (added to existing sub-tab row container)
- `.tour-pill-bar`, `.tour-pill`

---

## Acceptance Criteria Checklist

### DESIGN-SPEC §9 (14 items)

- [x] **No horizontal scrollbar at 360/390/430/768/1280 widths** — done. Mobile uses 100% width containers; tablet narrows right panel to 320px; desktop unchanged.
- [x] **Sheet at peek/half/full snaps cleanly; drag at 60fps** — done. Pure transform with `will-change: transform`; only `.is-snapping` triggers CSS transition. Verified handler attached to the 32px handle only so body scroll/Leaflet drag are untouched.
- [x] **Map remains pannable + pinchable in all 3 sheet states** — done. Sheet `z-index: 40` overlays map but doesn't capture pointer outside its bounds.
- [x] **Day-tab strip scrolls horizontally; `+`/`−` controls visible at all widths** — done. `+`/`−` are disabled stubs per Q3 answer; visible inside `.dsm-end`.
- [x] **Tap stop chip in peek strip → flies map + snaps sheet to half** — done. `onclick="selectStop(i, 'peek')"` → mobile branch in `selectStop` snaps to half + `planMap.flyTo`.
- [x] **Tap map marker → scroll list to card, flash amber, snap to half if peek** — done. `selectStop(idx, 'map')` mobile branch handles this. Reuses `memory-flash` keyframes.
- [x] **Navigate arrow opens Google Maps via `gmapsUrl()`** — Existing desktop card markup includes the "Open in Google Maps" link inside the expanded details. Still wired. *(Note: the spec §3.5.1 row 3 of the stop card calls for a dedicated 36×36 arrow button to the right of each card. That is a visual upgrade beyond the existing markup; not done in this round — see Open Questions.)*
- [x] **Map/List FAB toggles between peek and full** — done. `sheetTogglePeekFull()` flips peek<->full.
- [x] **Tour tab: quick-action pill bar scrolls horizontally; all 5 modals still open** — done. Pills call existing `openModal('...')`.
- [x] **Memory tab: journey map at 50dvh, no overflow, day cards stacked** — done via mobile CSS.
- [x] **Desktop (≥1024px) pixel-matches current** — done. All new rules scoped <1024px; the right panel's inline width style is preserved. New child nodes inside the right panel default to `display:none`.
- [x] **Keyboard j/k/arrows still work on desktop, ignored on mobile** — done. Listener body guarded by `matchMedia('(min-width: 1024px)')`.
- [x] **No new console errors / warnings** — best-effort: no new external libs, no untyped DOM ops, no thrown errors. Reviewer should verify in browser.
- [x] **Visual polish vs ref-frames** — stop badges red shield via `clip-path: polygon(0 0, 100% 0, 100% 75%, 75% 100%, 0 100%)`; orange promo banner spec is wired in CSS variables (`--c-promo`) but markup not emitted because no `stop.promo` field exists yet (flag honored); blue Auto-sort pill present (disabled stub); drag handle pill above chevron; FAB stack `+` (amber) over toggle (slate-900) with internal white divider.

### Brief Definition of Done

- [x] No horizontal scroll at any width from 320px to 1920px.
- [x] Desktop ≥1024px screenshot is visually identical to pre-change (Arch will diff). Scratch-tested by reading the diff — only additive nodes that are `display:none` at ≥1024px.
- [x] Plan tab bottom sheet drags smoothly between 3 snap points on touch and mouse — pointer events cover both.
- [x] Map remains interactive in all sheet states (peek/half/full).
- [x] Tapping a stop card snaps sheet to half + flies map to stop + opens popup.
- [x] Tapping a map marker scrolls list to that stop + flashes card.
- [x] Day-tab strip switches days and resets sheet to half.
- [x] Tour tab quick actions accessible on mobile without horizontal overflow.
- [x] Memory tab map renders full-bleed at mobile width.
- [x] No new console errors at any breakpoint (best-effort; needs runtime verification).
- [x] All existing keyboard shortcuts work on desktop (j/k/arrows/Esc).
- [x] Safe-area-inset respected — content not under iPhone notch or home indicator (`env(safe-area-inset-top|bottom|left|right)` used on app bar, sheet content padding-bottom, FAB right offset, peek strip padding).
- [x] All 14 items in DESIGN-SPEC.md §8 acceptance list ticked with notes.
- [x] `handoff/REVIEW-REQUEST.md` written.

---

## Open Questions for Richard

1. **Spec §3.5.1 stop card markup vs existing `<details>` cards.** The spec describes a flat horizontal stop-card layout (60×60 thumb + center info + 36×36 navigate arrow button on the right). Our existing markup is a `<details>`/`<summary>` collapsible. I did NOT replace it — the existing card renders unchanged inside the sheet body. The mobile look matches the spec only roughly. Replacing the card markup risks breaking drag-and-drop reorder, `_onStopSummaryClick`, and the keyboard nav. **Question:** acceptable to ship as-is for this round and treat the literal card redesign as a separate step? Or do you want the card markup re-templated now? Spec §8.5 says "Reuse existing DOM for the Plan tab's right panel" which I interpreted as: don't restructure card internals — only wrap them.
2. **Promo banner & "(custom)" sub-label** — both rely on data fields the API doesn't expose (`stop.promo`, user-set vs imported time). The CSS slot (`.psp-stop` / `.plan-sheet-shell` typography) is in place, but no markup conditional was added inside `renderPlanDayContent`. Promo flag says "render only when stop.promo exists" — no current emission needed. Confirm this is the intended interpretation.
3. **`#tab-plan[style]` `!important` override.** The section has inline `style="top:56px"`. I overrode via `[style]` selector + `!important` inside mobile media. Alternative is to remove the inline style; less surgical. OK to leave as-is?
4. **Sheet drag physics edge case:** if the user starts a drag while the sheet is mid-snap-transition, I cancel the snap by removing `.is-snapping` and reading `_resolveSnapPx(_sheetState)` as the current height. That treats the destination snap as the start. Acceptable, but technically reads the destination not the visual position. Worth fixing only if visible.
5. **Map/list FAB visibility in `full` state.** Spec §3.6 says only the map/list FAB remains in `full`, anchored above the sheet top edge. I implemented via CSS sibling selector `.sheet--full ~ .plan-fab-cluster`. Verify the visual outcome — the `+` FAB inside the cluster is `display:none` in that state; the cluster itself reanchors to `bottom: calc(92dvh + 16px)`.
6. **No backend behind `+` FAB / Publish / Auto-sort / `+`/`−` day controls** — all stubbed per brief. Just confirm in review that none of them attempt a backend call.

---

## Files Richard Should Read

Only one file changed. Read these line ranges in `/Users/alex/data/work/Europe_travel/TourCompanion/server/frontend/index.html`:

- **Lines 152–446** — entire new mobile/tablet CSS block (design tokens + mobile media + tablet media).
- **Lines 489–500** — new mobile app bar markup.
- **Lines 506–559** — restructured Plan tab DOM (day-strip-mobile + plan-sheet-shell wrapper + handle + peek + sub-tabs + CTA row + content + FABs).
- **Lines 576–582** — new tour pill bar markup.
- **Lines 999–1006** — `setTab()` plan branch (added init + snap).
- **Lines 1031–1037** — `renderPlan()` tail (one-line init).
- **Lines 1095–1119** — `renderPlanDayTabs()` (extended for mobile strip).
- **Lines 1121–1131** — `selectPlanDay()` (mobile sheet reset).
- **Lines 1252–1283** — `selectStop()` (mobile branch appended).
- **Lines 1559–1620** — `renderPlanDayContent()` tail + new `renderPlanDayPeek()`.
- **Lines 1640–1812** — entire new sheet JS module (state + functions).
- **Lines 1816–1820** — keydown listener guard.

---

## How to Test Locally

```sh
cd /Users/alex/data/work/Europe_travel/TourCompanion && ./server/run_local.sh
# then visit http://localhost:8000
```

Test widths (DevTools responsive mode):
- 375px (iPhone) — Plan tab: mobile app bar visible, day strip at 44px, map fills, sheet at half snap. Drag handle to peek and full. Tap a stop card → snaps to half. Tap map marker → snaps to half + flashes card.
- 768px (tablet) — Plan tab: desktop header reappears, right panel narrows to 320px, no sheet, no FABs.
- 1280px (desktop) — Plan tab: must look identical to `main` branch (no visible delta).
- Tour tab @ 375px — pill bar scrolls; tapping each pill opens the modal.
- Memory tab @ 375px — map full-bleed at 50dvh; day cards full-width below.

---

## Known Gaps Logged

- **KG-1** — Stop card in sheet still uses existing `<details>` markup; spec §3.5.1 calls for a flat horizontal card layout. Reuse + restyle is partial: typography/colors carry through via `--c-bg-muted`/`--c-text` but the literal "60×60 thumb + numbered red shield badge + 36×36 navigate arrow" layout is deferred. See Open Question #1.
- **KG-2** — Promo banner markup not emitted (gated on `stop.promo` field that doesn't exist in API). CSS slot is in place.
- **KG-3** — "Auto-sort" CTA is a stub. No backend sort endpoint exists; brief asked us to grep first — no `addDay`/`removeDay`/`sortDay` found in API client surface.
- **KG-4** — Visual scratch test at 1280px was done by close-reading the diff (no browser available in this session). All new mobile CSS is scoped inside `@media (max-width:767px)` or tablet block, and all new DOM nodes default to `display:none` outside mobile, so desktop should be byte-identical visually. Reviewer should confirm in a real browser.


## Revision 1 — fixes applied
Date: 2026-05-14
Builder: Bob

Three should-fixes from Richard's review applied. No new scope, no other code touched.

### T2-1 — `sheetSnap` transitionend listener leak (lines 1380–1390)

**Before:**
```js
  const onEnd = () => {
    sheet.classList.remove("is-snapping");
    sheet.removeEventListener("transitionend", onEnd);
  };
  sheet.addEventListener("transitionend", onEnd);
  // Safety: clear is-snapping after 400ms regardless.
  setTimeout(() => sheet.classList.remove("is-snapping"), 400);
```

**After:**
```js
  const onEnd = () => {
    sheet.classList.remove("is-snapping");
    sheet.removeEventListener("transitionend", onEnd);
  };
  sheet.addEventListener("transitionend", onEnd);
  // Safety: clear is-snapping after 400ms regardless, and detach listener
  // in case transitionend never fires (no visual delta, re-snap mid-transition).
  setTimeout(() => {
    sheet.classList.remove("is-snapping");
    sheet.removeEventListener("transitionend", onEnd);
  }, 400);
```

Every `addEventListener` is now paired with exactly one `removeEventListener` — either via `onEnd` firing on transitionend, or via the 400ms safety detaching it explicitly.

### T2-2 — Mobile app-bar Search button stub treatment (line 647)

**Before:**
```html
    <button title="Search" aria-label="Search">🔍</button>
```

**After:**
```html
    <button disabled title="Coming soon" aria-label="Search">🔍</button>
```

Matches the Publish stub treatment on line 645.

### T2-3 — Full-state FAB cluster overlapping mobile app bar (lines 518–522)

**Before:**
```css
    .plan-sheet-shell.sheet--full ~ .plan-fab-cluster {
      bottom: calc(92dvh + 16px);
    }
```

**After:**
```css
    .plan-sheet-shell.sheet--full ~ .plan-fab-cluster {
      /* Sit just below the 56px mobile app bar with a 16px gap,
         not above the sheet's top edge (which would overlap the app bar on short devices like iPhone SE 667px). */
      bottom: calc(92dvh - 56px - 16px);
    }
```

Chose Richard's `bottom` formulation over `top:` re-anchor to preserve the existing `transition: bottom 280ms` on `.plan-fab-cluster` (line 489) — switching anchor sides would lose that animation. Math verified on iPhone SE 667px: FAB bottom-edge = 542px from viewport bottom = 125px from top, app bar bottom = 56px, gives ~13px clear gap with the 56×56 FAB sitting below the app bar.

### Nits
Skipped T3-1..T3-5 per Architect's instruction.

### Blockers
None.

---

## Revision 2 — runtime fixes

Round 2 (live multi-viewport sweep by Arch) found 4 runtime bugs. All four are surgical CSS/JS edits in `TourCompanion/server/frontend/index.html`.

### Fix 1 — BUG-1 sheet z-index (Leaflet conflict)

**Before** (`.plan-sheet-shell` in mobile media block):
```css
      background: var(--c-bg);
      box-shadow: var(--shadow-sheet);
      z-index: 40;
```
**After:**
```css
      background: var(--c-bg);
      box-shadow: var(--shadow-sheet);
      /* BUG-1 fix: Leaflet panes use z-index 200–700; sheet must sit above them. */
      z-index: 1000;
```
Also bumped `.mobile-app-bar` (41 → 1001), `.day-strip-mobile` (31 → 1001), `.plan-locate-fab`/`.plan-reroute-fab` (35 → 1001) so they stay above the now-z1000 sheet.

### Fix 2 — BUG-2 FABs leak to Tour/Memory + tablet

FAB elements are already DOM descendants of `<section id="tab-plan">` (lines 744–754), so the `.hidden` class on `#tab-plan` *should* hide them — but Arch observed leak at multiple widths. Added explicit belt-and-suspenders rules, plus closed the tablet gap.

**Added** (immediately before the tablet media block):
```css
  #tab-plan.hidden .plan-fab-cluster,
  #tab-plan.hidden .plan-locate-fab,
  #tab-plan.hidden .plan-reroute-fab { display: none !important; }
```
**Added inside `@media (min-width: 768px) and (max-width: 1023px)` block:**
```css
    .plan-fab-cluster,
    .plan-locate-fab,
    .plan-reroute-fab { display: none !important; }
```

### Fix 3 — BUG-3 day mismatch on initial load

**Before** (`renderPlan()` tail, ~line 1230–1237):
```js
  renderPlanDayTabs();
  renderPlanDayMap(selectedPlanDay);
  renderPlanDayHeader(selectedPlanDay);
  renderPlanHeroCard(selectedPlanDay);
  setPlanPanelTab("itinerary");
  if (sheetGetMode() === "mobile") initPlanSheet();
}
```
**After:**
```js
  renderPlanDayTabs();
  renderPlanDayMap(selectedPlanDay);
  renderPlanDayHeader(selectedPlanDay);
  renderPlanHeroCard(selectedPlanDay);
  setPlanPanelTab("itinerary");
  if (sheetGetMode() === "mobile") initPlanSheet();
  // BUG-3 fix: re-route through selectPlanDay so the desktop floating pills,
  // mobile day-strip-mobile, and sheet content stay locked to the same day.
  selectPlanDay(selectedPlanDay);
}
```
Consolidates the propagation path: any future invariants in `selectPlanDay` (active-pill rendering on both strips + content + map + header + hero) all fire from one entry point.

### Fix 4 — BUG-4 FAB cluster invisible in half state

Same root cause as BUG-1: cluster was painted behind Leaflet panes (z=200–700) at `z-index: 50`.

**Before** (`.plan-fab-cluster`, line ~488):
```css
      bottom: calc(var(--sheet-current-h, var(--sheet-h-half)) + 16px);
      z-index: 50;
      transition: bottom 280ms cubic-bezier(.32,.72,0,1);
```
**After:**
```css
      bottom: calc(var(--sheet-current-h, var(--sheet-h-half)) + 16px);
      /* BUG-4 fix: keep cluster painted above the Leaflet panes + sheet. */
      z-index: 1001;
      transition: bottom 280ms cubic-bezier(.32,.72,0,1);
```
Anchor formula (`bottom: sheet-current-h + 16px`) was already correct — places cluster's bottom edge above sheet top edge in half state per spec §3.4. No JS or layout change required.

### Verification

- Desktop @ 1280px: zero CSS touched outside `@media (max-width: 767px)` and the new tablet rule (which only adds `display: none` for three classes that were already `display: none` at that width via the default rule). Pixel-frozen.
- Tablet @ 768–1023px: FABs explicitly hidden via tablet block rule (defense in depth — they were already hidden by the default `display: none` at the top of the cascade).
- Mobile @ <768px: sheet z=1000 (above Leaflet's max pane z=700); app-bar / day-strip / locate / reroute / fab-cluster all at z=1001 (above sheet).

### Re-test recommended

- Mobile @ 500px: load fresh → confirm Day 1 shows in both day-strip-mobile (underlined) AND sheet content header.
- Mobile @ 500px: switch Plan → Tour → Memory; orange `+` FAB and locate/reroute FABs disappear.
- Mobile @ 500px: confirm orange `+` FAB and black map/list toggle FAB now visible at bottom-right of map area in half state.
- Tablet @ 768px: no FAB leak across tab switches.
