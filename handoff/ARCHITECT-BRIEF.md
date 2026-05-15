# Architect Brief — Mobile Adaptive UI

---

## Step 1 — Mobile-first adaptive redesign of all 3 tabs (Plan / Tour / Memory)

### Goal

Make `TourCompanion/server/frontend/index.html` render and behave correctly on iPhone (375–430px), tablet (768–1023px), and desktop (≥1024px). Plan tab gets a bottom-sheet-over-map pattern modeled on the chicTrip reference design.

### Source of truth

- **Visual + interaction spec:** `handoff/DESIGN-SPEC.md` — 431 lines, every px/hex/ms is literal. Follow it verbatim.
- **Reference frames:** `handoff/ref-frames/frame_01.jpg` through `frame_11.jpg` (skip `frame_12.jpg`, iOS Control Center). Open these to resolve any ambiguity the spec leaves.
- **File under edit:** `TourCompanion/server/frontend/index.html` — single-file constraint. Do NOT split.

### Decisions (locked)

- Single file. No new external libraries. Tailwind via existing CDN + Leaflet only.
- Desktop ≥1024px is **pixel-frozen**. Any visual change at desktop width is a regression.
- Mobile <768px = bottom-sheet pattern (3 snap points: peek 88px / half 50dvh / full 92dvh).
- Tablet 768–1023px = narrow side panel, sheet disabled.
- Preserve every existing JS function name and external behavior (`selectStop`, `setDay`, `togglePlanFood`, `gmapsUrl`, etc.).
- Use `100dvh` and `env(safe-area-inset-*)` for viewport correctness on iOS.
- Sheet drag handled with pointer events + `transform: translateY` + rAF. No layout library.
- All three tabs covered in this step. No partial ships.

### Build order

1. **Read** `handoff/DESIGN-SPEC.md` end-to-end. Read frames `frame_01`, `frame_03`, `frame_05`, `frame_07` minimum.
2. **Plan first.** Write your "Builder Plan" section at the bottom of this file. List the chunks you'll edit, the new CSS/JS regions you'll add, and any ambiguities. **Stop. Wait for Arch approval before writing code.**
3. After approval, build in this order:
   1. Design-system CSS variables + breakpoint scaffolding (`@media` blocks).
   2. Plan tab: app bar + day-tab strip + bottom sheet shell + sheet drag JS.
   3. Plan tab: sheet contents (stop cards, transit rows, peek strip, FAB cluster).
   4. Tour tab mobile adaptation (quick actions pill bar).
   5. Memory tab mobile adaptation (full-bleed map, stacked cards).
   6. Cross-tab: safe-area insets, type scale, shadow tokens.
4. **Local sanity check** — open `server/frontend/index.html` directly in a browser or via `./server/run_local.sh`; verify no console errors and no broken layout at desktop width before declaring done.
5. **Write** `handoff/REVIEW-REQUEST.md` listing every region of `index.html` you touched (line ranges), every new function, and the acceptance-criteria checklist from DESIGN-SPEC.md §8 with each item marked done/notes.

### Flags — do not guess

- **Flag — promo banner data source.** Spec shows inline orange promo rows ("eSIM NT$69" etc.). Reference is an ad slot. We have no promo data in the API. **Render the slot conditionally** — only when a stop has a `promo` field; otherwise skip the row. Do not hardcode example promos.
- **Flag — "Publish" pill in app bar.** Reference shows a "發佈行程" (Publish itinerary) outlined pill. We have no publish flow. **Render the pill but make it a no-op stub with `disabled` styling and title="Coming soon".** Do not invent a publish endpoint.
- **Flag — `+` FAB and Auto-sort CTA.** Same rule — render visually per spec, but no backend hookup. `+` is `disabled` stub. Auto-sort can call existing day-sort behavior if one exists; otherwise no-op stub. Grep first; do not guess.
- **Flag — map/list toggle FAB.** This IS wired: tapping toggles sheet between `full` (list) and `peek` (map). That's the only behavior.
- **Flag — i18n.** Reference is Chinese. Our app is English. Use English labels everywhere: "Overview", "Day 1", "Auto-sort", "Stay 1h00", "Publish", etc.

### Definition of Done

- [ ] No horizontal scroll at any width from 320px to 1920px.
- [ ] Desktop ≥1024px screenshot is visually identical to pre-change (Arch will diff).
- [ ] Plan tab bottom sheet drags smoothly between 3 snap points on touch and mouse.
- [ ] Map remains interactive in all sheet states (peek/half/full).
- [ ] Tapping a stop card snaps sheet to half + flies map to stop + opens popup.
- [ ] Tapping a map marker scrolls list to that stop + flashes card.
- [ ] Day-tab strip switches days and resets sheet to half.
- [ ] Tour tab quick actions accessible on mobile without horizontal overflow.
- [ ] Memory tab map renders full-bleed at mobile width.
- [ ] No new console errors at any breakpoint.
- [ ] All existing keyboard shortcuts work on desktop (j/k/arrows/Esc).
- [ ] Safe-area-inset respected — content not under iPhone notch or home indicator.
- [ ] All 14 items in DESIGN-SPEC.md §8 acceptance list ticked with notes.
- [ ] `handoff/REVIEW-REQUEST.md` written.

---

## Builder Plan
*Bob writes here before building. Architect approves before any code.*

### 1. Files to be edited
- **`TourCompanion/server/frontend/index.html`** — only file touched. Single-file constraint confirmed. No new external libs; Tailwind CDN + Leaflet stay.

### 2. Edit regions (current line ranges, approximate)
- **L14–152 `<style>` block** — append (do not rewrite): `:root` custom properties from §1.1–§1.5 (colors/shadows/radii); new classes `.app-bar-mobile`, `.day-strip-mobile`, `.plan-sheet`, `.plan-sheet-handle`, `.plan-sheet-peek`, `.plan-sheet-body`, `.plan-fab-cluster`, `.plan-fab-add`, `.plan-fab-toggle`, `.plan-stop-card-m`, `.plan-promo`, `.plan-transit-row`, `.plan-day-pill-mobile`, `.plan-locate-fab`, `.plan-reroute-fab`, `.tour-quick-pill`, `.tour-pill-bar`, `.sheet-overlay-host`; sheet snap classes `.sheet--peek/--half/--full/.is-snapping`; `@media (max-width:767px)` and `@media (min-width:768px) and (max-width:1023px)` blocks. Desktop `≥1024px` rules untouched.
- **L196–232 header** — add a second markup block `<header class="mobile-app-bar md:hidden">` containing back arrow, Publish stub pill, search/⚙/⏻ cluster. Existing desktop header gets `hidden md:block` (or wrap in a `.desktop-only` class) so it shows only at ≥768px. Sticky 56px + `padding-top: env(safe-area-inset-top)`.
- **L235–266 Plan tab section** — keep existing markup intact; wrap right panel in `.plan-sheet-shell` and add sibling nodes that render only on mobile via CSS: `.plan-sheet-handle`, `.plan-sheet-peek`, `.plan-fab-cluster` (`+` FAB + map/list FAB), `.plan-locate-fab`, `.plan-reroute-fab`. New mobile app bar + sticky `.day-strip-mobile` strip appear above the map container. Day-tabs strip currently floating absolute top-4 (L241–243) — at <768px, CSS detaches/hides that floater and the new sticky strip takes its place; ≥768px untouched.
- **L271–307 Tour tab section** — insert `.tour-pill-bar` (5 quick-action pills horizontal scroll) immediately under day-strip; hide existing right `<aside>` quick-actions card on mobile; restack stats + offline callout as full-width blocks via `@media (max-width:767px)`.
- **L310–339 Memory tab section** — add mobile CSS to make `#journey-map` 50dvh + 0 radius; collapse `<aside>` (journal/highlights/print) to flow under day cards via flex-direction column on parent.
- **L776–810 `renderPlanDayTabs()`** — extend to also populate a new `#plan-day-strip-mobile` element (Overview + Day N pills + trailing fixed `+`/`−` buttons) using same `selectPlanDay()` handler.
- **L812–843 keydown listener** — wrap entire body in `if (window.matchMedia('(min-width:1024px)').matches) { … }` guard per §7.5.
- **L922–978 `selectStop()`** — append: when on mobile (matchMedia <768px), call `sheetSnap('half')` and fly map (already does); when triggered from `"marker"` source and current state is `peek`, snap to `half` only. No rename, no signature change.
- **L1145–1227 `renderPlanDayContent()`** — augment (do not replace) to also emit a parallel mobile DOM into `#plan-sheet-peek` (day pill + stop chips + transit chips). Existing detail list stays; CSS picks visibility per `.sheet--*` class. Stop card markup unchanged at desktop; mobile styling layered via `@media`.
- **L1402+ `renderTour()` / L1591+ `renderMemory()`** — no JS logic change; mobile layouts handled by CSS + existing DOM. Verify pill bar source list (5 modals) lives statically in HTML, not generated by JS.
- **Bootstrap region (end of `<script>`)** — call new `initPlanSheet()` once on first plan-tab render; wire `setTab('plan')` to invoke `sheetSnap('half')` on mobile on entry.

### 3. New JS functions
- `sheetGetMode()` — returns `'mobile' | 'tablet' | 'desktop'` via `matchMedia`.
- `sheetSnap(state)` — sets `.sheet--peek/--half/--full` class, toggles `.is-snapping`, updates `--sheet-h` CSS var.
- `sheetCurrentHeight()` — returns numeric px height for current snap (used by FAB/map-control anchor).
- `sheetOnPointerDown(e)` — handle drag handle pointer-down; `setPointerCapture`; record y0, h0, t0.
- `sheetOnPointerMove(e)` — 1:1 translateY with rubber-band beyond range; pure transform mutation.
- `sheetOnPointerUp(e)` — compute velocity, pick nearest snap with velocity weighting; call `sheetSnap()`.
- `sheetUpdateAnchors()` — recompute FAB / locate-me / reroute `bottom` after a snap settles.
- `initPlanSheet()` — one-time DOM hookup (handle listeners, initial state `half`, viewport-change listener).
- `renderPlanDayPeek(day)` — populate `#plan-sheet-peek` chips (called from `renderPlanDayContent`).
- `renderPlanAppBar()` — paint Publish stub, search, gear (no state needed; static markup but kept as a hook in case trip name display is desired in title later).

No new globals besides: `let _sheetState = 'half'; let _sheetDrag = null;` (drag scratch object). Sheet height tracked as CSS var `--sheet-h` on `.plan-sheet`.

### 4. State management for the sheet
- **Source of truth = CSS class** on `.plan-sheet`: `sheet--peek` / `sheet--half` / `sheet--full`. JS mirrors in `_sheetState` for read access. Reason: visibility of peek-vs-list DOM, FAB anchor, and locate/reroute show/hide all key off the class via pure CSS — no inline style churn.
- **Drag in-flight**: scratch object `_sheetDrag = { y0, h0, t0, lastY, lastT, raf }`; cleared on pointer-up. `.is-snapping` class added during post-release transition, removed on `transitionend`.
- **Viewport mode**: read on-demand via `sheetGetMode()` from `matchMedia`; cached via `window.addEventListener('resize', …)` (debounced) into `_viewportMode` so per-event reads are cheap.
- **Snap height value**: kept on `:root` as `--sheet-h-peek`, `--sheet-h-half`, `--sheet-h-full` (calc with safe-area) — sheet transform reads them. JS only sets the active snap class; transform values come from CSS rules. This keeps animation pure-transform and lets `dvh` recalc on rotation without JS.

### 5. Tablet behavior (768–1023px)
- New `@media (min-width:768px) and (max-width:1023px)` block:
  - `.plan-sheet-shell, .plan-sheet-handle, .plan-sheet-peek, .plan-fab-cluster, .plan-locate-fab, .plan-reroute-fab { display: none; }` — sheet stack fully disabled.
  - Existing right panel (currently `width:38%; min-width:320px; max-width:520px` at L255) overridden to `width: 320px; min-width: 280px; max-width: 320px;`.
  - Mobile app bar hidden; existing desktop header retained (still works at 768px because nav pills + header are width-fluid).
  - Tour aside narrowed to `width: 200px`; Memory aside `width: 220px`.
- Desktop `≥1024px`: zero new rules apply (all overrides scoped to `max-width:1023px`). Verified pixel-frozen.

### 6. Risks / open questions
- **R1** Sheet drag pointer conflict with Leaflet map drag. Plan: pointer handlers attach ONLY to `.plan-sheet-handle` (top 32px), never to `.plan-sheet` body. Body scrolling stays native. Map underneath remains untouched.
- **R2** Existing keydown guard (L813) checks `tab-plan` visibility; restructure must preserve `#tab-plan` element id + `.hidden` toggle behavior. Plan: don't restructure `#tab-plan`'s root attrs.
- **R3** Day-tab strip currently floats `absolute top-4` inside map container (L241–243). On mobile we need a sticky strip directly under app bar — not on top of map. Plan: render BOTH containers in HTML; CSS shows the absolute floater only at `≥768px` and shows the sticky `.day-strip-mobile` only at `<768px`. `renderPlanDayTabs()` writes into both.
- **R4** Sheet content reuses existing `#plan-day-content` (currently inside right panel at L263). On mobile we need it inside the sheet body — same DOM element. Plan: move `#plan-day-content` element into the sheet shell wrapper so it lives there at all widths; on desktop the wrapper IS the right panel (width:38%); on mobile the wrapper IS the sheet (fixed bottom). Single element, two layouts via wrapper class. **Open Q1 for Arch**: is moving `#plan-day-content` out of the existing `<div style="width:38%…">` and into a new `.plan-sheet-shell` wrapper that itself sits in the right-panel slot acceptable? It preserves all selectors and content, just shifts one level of nesting.
- **R5** Plan tab uses `setPlanPanelTab(tab)` (Itinerary/Docs/Food sub-tabs at L258–262) inside the right panel. Spec doesn't mention these for mobile. Plan: keep them visible inside the sheet body above `#plan-day-content` — they fit between the Date Header (§3.5.1 row 2) and the Filter+CTA row. **Open Q2 for Arch**: keep sub-tabs visible on mobile inside sheet, or hide them and default to `itinerary` only? Spec is silent.
- **R6** Spec §3.3 trailing `+`/`−` controls "fixed-pinned outside the scroll area." Existing `renderPlanDayTabs()` doesn't render add/remove-day controls. **Open Q3**: do `+`/`−` actually need to call a real handler (add/remove day endpoint exists?) or render as `disabled` stubs like Publish? Grep showed no `addDay`/`removeDay`. Assuming stub unless told otherwise.
- **R7** Spec §3.2 "back arrow ⇒ reuse `trip-picker-btn` click handler." That handler opens a dropdown menu anchored to the original button, which is hidden on mobile. Plan: re-target the dropdown's anchor logic or render the dropdown menu in a mobile-friendly position. **Open Q4**: acceptable for back arrow to call `toggleTripPicker(event)` and render the same dropdown positioned `top:56px; left:8px`?
- **R8** Promo banner: spec says render only when `stop.promo` exists. Current data model (L435–441 stop shape) has no `promo` field. Plan: render with `${s.promo ? '<promo markup>' : ''}` — slot exists, never fires until backend adds field.
- **R9** Tour day strip already at 56px-ish height; spec wants 44px. Plan: only adjust on mobile via `@media`; desktop unchanged.
- **R10** Locate-me + Re-route FABs (§3.4) are new floating buttons; ensure they don't sit above Leaflet zoom control (which is `bottomright` at L859). Plan: hide Leaflet zoom control on mobile via `@media` rule `.leaflet-bottom.leaflet-right { display: none; }` — pinch-zoom covers it on touch.

### 7. Estimated diff size
- CSS additions (root vars + new classes + 2 media blocks): **~280 lines added**.
- HTML additions (mobile app bar, sheet shell wrapper, peek strip placeholder, FAB cluster, locate/reroute, day-strip-mobile, tour pill bar): **~90 lines added**.
- JS additions (`sheet*` functions + `renderPlanDayPeek` + keydown guard wrap + `initPlanSheet` + selectStop tweak): **~170 lines added**.
- Existing lines modified: **~25** (header wrap, `renderPlanDayTabs` extend, `renderPlanDayContent` peek hook, `selectStop` mobile branch, keydown wrap).
- Lines deleted: **0** (purely additive — desktop frozen).
- **Total ~540 lines added, ~25 modified, 0 deleted.** Final file ~2525 lines.

### 8. Verification steps before declaring done
- Open `TourCompanion/server/frontend/index.html` via `./server/run_local.sh` or directly.
- DevTools responsive mode at 360 / 390 / 430 / 768 / 1023 / 1280 / 1920 widths — verify no horizontal scrollbar at any width.
- At 375px: confirm app bar 56px, day strip 44px sticky, map fills remainder, sheet at `half` on load.
- Drag sheet handle: peek ↔ half ↔ full, all snaps work; map pannable in every state.
- Tap stop card → sheet snaps half, map flies, popup opens.
- Tap map marker → list scrolls to card, amber flash, snap to half if peek.
- Map/List FAB toggles full↔peek.
- Day pill switch → sheet returns to half; map fitBounds.
- 768px: sheet hidden, narrow side panel shows, no FAB.
- 1280px: pixel-compare with pre-change screenshot — must be identical.
- Console at all widths: zero new errors / warnings on load + on each interaction.
- Keyboard `j/k/←/→/Esc` works at 1280px, no-op at 375px.
- iOS safe-area: simulate via DevTools "iPhone 14 Pro" device — content not under notch; FAB above home indicator.
- Tour tab: pill bar horizontal scroll; all 5 modals open.
- Memory tab: map 50dvh, day cards stacked, no overflow.
- Tick all 14 items in DESIGN-SPEC §8.

**Status: awaiting Arch approval. 4 open questions flagged (Q1–Q4).**

---

## Architect Approval

Architect approval: [x] **Approved** — proceed to build per the plan above. All 8 sections accepted. Estimated diff size accepted.

### Answers to Bob's open questions

- **Q1 — `.plan-sheet-shell` wrapper around `#plan-day-content`.** **Approved.** Single element, two layouts via wrapper class is correct. Preserves every existing selector.
- **Q2 — Itinerary/Docs/Food sub-tabs on mobile sheet.** **Keep visible.** Mobile users still need Docs and Food. Place them inside sheet body, exactly per Bob's plan (between date header and Auto-sort row). Sub-tabs become a horizontal scroll if they overflow at 360px width.
- **Q3 — `+`/`−` day controls.** **Disabled stubs.** Same pattern as Publish pill and `+` FAB: render visually per spec, `disabled` attribute, `title="Coming soon"`, no handler. Grep confirmed no `addDay`/`removeDay` backend.
- **Q4 — Back arrow → `toggleTripPicker()`.** **Approved as stated.** Dropdown anchored `position: fixed; top: 56px; left: 8px` on mobile. If `toggleTripPicker` positions relative to its trigger, pass the back-arrow element OR add a mobile-specific CSS override on the dropdown container — your call. Acceptable degradation: dropdown opens centered if anchoring is awkward.

### Extra guardrails (no scope change)

- **Single-file scratch test.** Before submitting REVIEW-REQUEST.md, open the file at 1280px width and visually compare to current `main` (no diff tooling needed — just eyeball the Plan tab right panel, Tour aside, Memory aside). Any visible delta = blocker.
- **Touch + mouse parity.** Sheet drag must work with both pointer types. Test with DevTools "Toggle device toolbar" (touch emulation) AND with regular mouse drag.
- **One-time `initPlanSheet()` call.** Make sure re-entering the Plan tab doesn't double-bind listeners. Use a `_sheetInited` flag.

Proceed.
