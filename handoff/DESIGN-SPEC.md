# TourCompanion — Mobile-First Adaptive UI Spec

**Target file:** `TourCompanion/server/frontend/index.html` (single-file constraint)
**Reference design:** chicTrip (Taiwanese travel app) — frames in `handoff/ref-frames/`
**Scope:** mobile + tablet redesign. **Desktop (≥1024px) layout must be preserved exactly as-is.**
**Builder rule:** every value below (px, hex, ms) is literal — do not substitute. No `etc.`, no `similar to`.

---

## 1. Design System

### 1.1 Color Palette

| Token             | Hex       | Tailwind nearest    | Use                                       |
|-------------------|-----------|---------------------|-------------------------------------------|
| `--c-bg`          | `#FFFFFF` | `white`             | Sheet, cards, app bar                     |
| `--c-bg-muted`    | `#F5F6F8` | `slate-100`         | Stop card body, peek strip chips          |
| `--c-bg-page`     | `#F1F5F9` | `slate-100`         | Page behind cards                         |
| `--c-text`        | `#0F172A` | `slate-900`         | Stop names, titles                        |
| `--c-text-muted`  | `#64748B` | `slate-500`         | "Stay 1h00", meta                         |
| `--c-text-micro`  | `#94A3B8` | `slate-400`         | Day-tab inactive, dividers text           |
| `--c-border`      | `#E2E8F0` | `slate-200`         | Card border, separators                   |
| `--c-accent`      | `#E5384A` | `rose-600` (≈)      | Numbered stop badge fill, transit time    |
| `--c-accent-dark` | `#C81E32` | `rose-700` (≈)      | Stop badge tail / shadow                  |
| `--c-cta`         | `#2F8BFF` | `blue-500`          | "Auto-sort" primary pill                  |
| `--c-cta-text`    | `#FFFFFF` | `white`             | Text on CTA                               |
| `--c-promo`       | `#F4A14A` | `orange-400`        | Booking banner background                 |
| `--c-promo-text`  | `#7A3A00` | `orange-900` (≈)    | Booking banner text                       |
| `--c-fab-add`     | `#E8A33D` | `amber-500`         | Orange `+` FAB                            |
| `--c-fab-toggle`  | `#0F172A` | `slate-900`         | Black map/list FAB stack                  |
| `--c-success`     | `#10B981` | `emerald-500`       | Reserved (Tour tab checks)                |
| `--c-shadow-rgb`  | `0 0 0`   | —                   | Base for all shadows                      |

### 1.2 Type Scale

System stack (already in `body`): `-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif`.

| Role                | Size  | Weight | Line-height | Tailwind   |
|---------------------|-------|--------|-------------|------------|
| Page title          | 22px  | 700    | 1.2         | `text-[22px] font-bold` |
| Section header      | 17px  | 700    | 1.25        | `text-[17px] font-bold` |
| Stop name           | 16px  | 700    | 1.3         | `text-base font-bold`   |
| Body                | 14px  | 500    | 1.4         | `text-sm`               |
| Meta ("Stay 1h00")  | 13px  | 500    | 1.3         | `text-[13px]`           |
| Transit time        | 13px  | 600    | 1.2         | `text-[13px] font-semibold` |
| Day-tab label       | 15px  | 600    | 1.2         | `text-[15px] font-semibold` |
| Micro / promo label | 11px  | 700    | 1.2         | `text-[11px] font-bold` |
| Stop badge digit    | 13px  | 800    | 1           | `text-[13px] font-extrabold` |

### 1.3 Spacing Scale (px)

`4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 56`

Stick to these. Card inner padding: `12 16`. Section gap: `12`. Sheet outer padding: `16`.

### 1.4 Radii

| Element        | Radius |
|----------------|--------|
| Stop card      | 14px   |
| Photo thumb    | 10px   |
| CTA pill       | 9999px (full) |
| Transit chip   | 9999px |
| Sheet top      | 20px (top-left + top-right only; bottom 0) |
| FAB            | 9999px |
| Promo banner   | 10px   |
| Day-tab pill   | 9999px |

### 1.5 Shadows

```
--shadow-card:    0 1px 2px rgba(0,0,0,.04), 0 2px 8px rgba(0,0,0,.04);
--shadow-sheet:   0 -8px 24px rgba(0,0,0,.10), 0 -1px 0 rgba(0,0,0,.04);
--shadow-fab:     0 6px 16px rgba(0,0,0,.18), 0 2px 4px rgba(0,0,0,.10);
--shadow-appbar:  0 1px 0 rgba(0,0,0,.06);
```

### 1.6 Iconography

Use Unicode/emoji where current code already does — do **not** introduce an icon library.

| Element            | Glyph / spec |
|--------------------|--------------|
| Stop number badge  | Filled red shield: 24×26 px, top-left corner of thumbnail, overlaps thumb by 4px left + 0px top. Shape: rounded rect with a small downward point on bottom-right (use CSS `clip-path: polygon(0 0, 100% 0, 100% 75%, 75% 100%, 0 100%)`). White digit `font-extrabold` 13px. |
| Category icon      | Circular outline 20px: 🏨 hotel, 🍴 food, 📷 sight, 🚶 walk, 🚌 bus, 🚇 metro, ✈️ flight, 🅿️ parking. Color `--c-accent` for the glyph + circle border. Sit inline before the time. |
| Navigate arrow     | 36×36 circular button, white bg, 1px border `--c-border`, glyph `↗` (or `↳`) 16px `--c-text-muted`. Right side of stop card. Existing `gmapsUrl()` is the target. |
| Drag handle (sheet)| 36×4px pill, `--c-text-micro` at 50% opacity, centered, 8px from sheet top. Plus a 16×16 chevron (`▾` when full, `▴` when collapsed) directly above the date header — 6px below the pill. |
| Transit row icon   | Same category circle but `--c-text-muted` color, followed by HH時MM分-style duration localized to "0h 49m". |

---

## 2. Breakpoints

```css
/* mobile  */ @media (max-width: 767px)  { … bottom-sheet layout … }
/* tablet  */ @media (min-width: 768px) and (max-width: 1023px) { … narrow side panel … }
/* desktop */ @media (min-width: 1024px) { /* PRESERVE — do not touch */ }
```

Use `100dvh` for full viewport, never `100vh`, on mobile. Use `env(safe-area-inset-top|bottom|left|right)` on the app bar (top) and FAB cluster / sheet peek (bottom).

---

## 3. Plan Tab — Mobile Spec (`< 768px`)

### 3.1 Layout Stack (top → bottom)

```
┌─────────────────────────────────┐ 0
│  App bar          56px          │
├─────────────────────────────────┤ 56
│  Day-tab strip    44px sticky   │
├─────────────────────────────────┤ 100
│                                 │
│        MAP (Leaflet)            │
│        fills remaining          │
│                                 │
│         [+ FAB]                 │
│         [🗺/≡ FAB]              │
│                                 │
├─────────────────────────────────┤
│  Bottom sheet (overlays map)    │
│  snap: peek | half | full       │
└─────────────────────────────────┘
```

### 3.2 App Bar (56px, sticky)

- Background `--c-bg`, shadow `--shadow-appbar`.
- Layout: 3-column flex, `padding: 0 12px`, `padding-top: env(safe-area-inset-top)` (additive; the 56px is content height).
- Left: back arrow button `<` — 40×40 tap target, glyph 20px `--c-text`. (No-op on mobile for now; reuse `trip-picker-btn` click handler.)
- Center: "Publish" pill — outlined, 1.5px border `--c-text`, `padding: 6px 18px`, `border-radius: 9999px`, 14px font 600. Tap = no-op for now (placeholder; do NOT wire to backend).
- Right cluster (40×40 each, 4px gap):
  - 🔍 search (existing handler — keep)
  - ⚙ settings gear — new, opens existing trip picker menu
  - ⏻ logout (existing `logout()`)

### 3.3 Day-Tab Strip (44px, sticky just under app bar)

- Background `--c-bg`, bottom border 1px `--c-border`.
- Horizontal scroll, `scroll-snap-type: x proximity`, hide scrollbar (reuse `.scroll-hide`).
- Items: "Overview" then "Day 1, Day 2, …".
- Each item: `padding: 10px 16px`, 15px 600. Active: bottom 2px solid `--c-text` underline. Inactive: `--c-text-micro`.
- Trailing controls fixed-pinned **outside** the scroll area on the right: two 32×32 circular buttons in a row, glyphs `+` (add day) and `−` (remove day), 14px font-bold, `--c-bg-muted` bg, 1px border `--c-border`. 8px right padding, 6px gap.

### 3.4 Map

- Position: `absolute; top: 100px; bottom: 0; left: 0; right: 0;` (under the strip).
- Leaflet container keeps existing styling. Map remains fully interactive in all sheet states.
- Two floating controls **only when sheet is at `peek` or `half`** (hidden when `full`):
  - Locate-me: 44×44 circle, white bg, `--shadow-card`, glyph `◎` 18px `--c-cta`. Pinned `left: 16px; bottom: calc(<sheet-current-height> + 16px)`. Builder will track sheet height in JS to anchor; the value updates only on snap, not during drag.
  - Re-route: 44×44 circle, white bg, `--shadow-card`, glyph `🔀` 16px `--c-text`. Same vertical anchor, `right: 16px`.

### 3.5 Bottom Sheet (centerpiece)

**Snap points** (measured from bottom of viewport, inclusive of safe-area-inset-bottom):

```
        ┌──── full ─────┐  height = 92dvh   (covers map; thin slice of map peeks at top 8dvh)
        │               │
        │               │
        │               │
        ├──── half ─────┤  height = 50dvh
        │               │
        ├──── peek ─────┤  height = 88px  + env(safe-area-inset-bottom)
        └───────────────┘
```

- Container: `position: fixed; left: 0; right: 0; bottom: 0;` `border-radius: 20px 20px 0 0;` `background: var(--c-bg);` `box-shadow: var(--shadow-sheet);` `z-index: 40` (under FABs at 50, above map controls at 30).
- Transform model: do **not** animate `height`. Set height to `92dvh` always, then `transform: translateY(<offset>)` where offset is `(92dvh − target-snap-height)`. This keeps content layout stable across snaps.
- Drag handle area: top 32px is the drag affordance. Render the 36×4 pill + small chevron glyph here. Whole 32px is the only region where vertical pan starts a drag — body below scrolls normally.

#### 3.5.1 Sheet Contents — `full` and `half` states (identical DOM, scrollable)

Order, top to bottom, inside sheet:

1. **Drag handle area** (32px).
2. **Date header row** — `padding: 0 16px 8px`. Left: page-title "05/18 Mon" (localized as `MM/DD ddd`). Right: nothing.
3. **Filter + CTA row** — `padding: 0 16px 12px`, flex `justify-between`:
   - Left: outlined pill `padding: 8px 14px`, 14px 600, glyph `🚌` + label "Transit" + `▾` (transit-mode filter; on tap toggle between Transit / Walk / Drive — reuse existing food toggle pattern, no backend change).
   - Right: filled CTA pill `--c-cta` bg, white text, `padding: 10px 18px`, 14px 700, glyph `≡⚡` + "Auto-sort". Tap = no-op placeholder (do NOT call backend yet).
4. **Numbered timeline list** — vertical stack inside `overflow-y: auto`, gap = 0 (transit rows act as separators). For each stop:
   - **Stop card** (`.plan-stop-card`):
     - Container: `margin: 0 16px;` `background: var(--c-bg-muted);` `border-radius: 14px;` `padding: 12px;` flex row, gap 12.
     - Thumbnail: 60×60, `border-radius: 10px`, `object-fit: cover`. If no photo, gray placeholder. Stop number badge overlays top-left (see 1.6).
     - Center column (flex 1, min-width 0):
       - Row 1: `category-icon` + `time` (`--c-accent`, 14px 700) + grey "(自訂)"-equivalent "(custom)" 12px `--c-text-micro` if user-set.
       - Row 2: Stop name 16px 700 `--c-text`, max 2 lines `line-clamp-2`.
       - Row 3: "Stay 1h 00m" 13px `--c-text-muted`. If notes exist append " · noted" with `•` separator.
     - Right column: 36×36 navigate arrow button (see 1.6). Tap → existing `gmapsUrl(stop)`. Tap on card body → existing `selectStop(stop.id)`.
   - **Promo/booking banner** (only when `stop.promo` exists; absent for now but mark up the slot):
     - Container: `margin: 6px 16px 0 76px;` (indent under thumb), `background: var(--c-promo);` `border-radius: 10px;` `padding: 8px 12px;` flex row.
     - Left: 24×16 white pill with text "DEAL" (11px 800, `--c-promo-text`).
     - Middle: 13px 600 `--c-promo-text` label, truncate.
     - Right: price (e.g. "€69") 14px 800 + `›` glyph.
   - **Transit row** (between consecutive stops only):
     - Container: `margin: 8px 16px 8px 38px;` (dotted timeline connector at left). Left dotted line: 1px dashed `--c-border`, height 28px, runs from card N bottom edge to card N+1 top edge, x = 38px from sheet left.
     - Row content: `category-icon` (bus/walk/metro) + duration "0h 49m" 13px 600 `--c-text` + `›` chevron 12px `--c-text-micro`. Tap → no-op for now.
5. **Bottom safe-area padding**: `padding-bottom: calc(24px + env(safe-area-inset-bottom));`.

#### 3.5.2 Sheet Contents — `peek` state

When sheet is at peek, the **timeline list above is clipped**; only an 88px strip is visible. Replace visual content with a horizontal scroll strip:

```
[ Day 1   ]→[1 Vienna Air..][🚌 0h49m][2 arte Hotel…][🚌 0h29m][3 Fenster Café]…
 05/18 Mon
```

- Container: `padding: 12px 16px calc(12px + env(safe-area-inset-bottom));` horizontal flex, gap 8, `overflow-x: auto; scroll-snap-type: x mandatory;` hide scrollbar.
- **Day pill** (first): 88×64 rounded-14, `background: #FFE4E6` (rose-50), 1.5px border `--c-accent`, 2-line: "Day 1" 13px 700 `--c-accent`, "05/18 Mon" 11px 500. Followed by a `›` chevron 14px `--c-text-micro` (separate flex item, 16px wide).
- **Stop chip**: 132×64 rounded-14, `background: var(--c-bg-muted)`. Inside: red stop-number badge top-left (same shape as 1.6) + name 13px 600 `--c-text`, 2-line clamp. `scroll-snap-align: start`.
- **Transit chip**: 80×64 rounded-14, transparent bg. Centered icon + "0h 49m" 12px 600. No border.
- Tap chip → `selectStop(id)` + snap sheet to `half` + fly map to stop.

The peek strip is **rendered in parallel** with the full list (DOM swap via CSS `display`/`visibility` keyed off sheet state class on the sheet element: `.sheet--peek`, `.sheet--half`, `.sheet--full`).

### 3.6 FAB Cluster

- Position: `position: fixed; right: 16px; z-index: 50;` `bottom: calc(<sheet-current-height> + 16px)`.
- Stack vertical, 12px gap:
  - **Add stop FAB** — 56×56, `background: var(--c-fab-add);` `box-shadow: var(--shadow-fab);` glyph `+` 28px white. Tap = no-op (render but don't wire).
  - **Map/List toggle FAB** — 48×56 (taller pill, `border-radius: 9999px`), `background: var(--c-fab-toggle);` `box-shadow: var(--shadow-fab);` two stacked glyphs: 🗺 (top) above ≡ (bottom), each 18px white, 4px vertical gap, separated by a 1px white-30% divider. Tap: toggles sheet between `peek` (map view) and `full` (list view).
- Hide entirely when sheet is at `full` (only the map/list FAB remains visible in `full` state, anchored at `bottom: calc(92dvh + 16px)` so it floats just above the sheet top edge — visually outside the sheet).

---

## 4. Tour Tab — Mobile Spec

Keep existing logic; only restructure layout.

### 4.1 Layout Stack

```
┌─────────────────────────────────┐
│ App bar             56px        │
├─────────────────────────────────┤
│ Today's tour header  + status   │
│ Day strip            44px       │  (existing horiz scroll; bump height to 44px, items 36-40)
├─────────────────────────────────┤
│ Quick-action pill bar 48px      │  ← NEW (was sidebar on desktop)
├─────────────────────────────────┤
│ Stops list (full-width cards)   │  flex-1, vertical scroll
│                                 │
├─────────────────────────────────┤
│ "Today" stats card              │  (was sidebar)
│ "Offline ready" callout         │  (was sidebar)
└─────────────────────────────────┘
```

### 4.2 Quick-Action Pill Bar (replaces sidebar)

**Recommendation: horizontal pill bar sticky under day-strip.** Rationale: bottom sheets compete with Plan tab's pattern and confuse users; users glance at quick actions during transit not while at a stop, so persistent visibility wins. Bottom-sheet alternative rejected.

- Container: `background: var(--c-bg);` bottom border 1px `--c-border`, `padding: 8px 12px;` horizontal scroll, hide scrollbar.
- Each pill: 36px tall, `padding: 0 14px;` `border-radius: 9999px;` `background: var(--c-bg-muted);` 1px border `--c-border`, 13px 600 `--c-text`, icon glyph 14px + label.
- Items in order: 🍴 Cheap eats · 🗣 Phrases · 🚻 Washroom · 💱 Currency · ☂ Weather. Existing `openModal('xxx')` handlers preserved.

### 4.3 Stop Cards — full width

- `margin: 0 12px 12px;` reuse existing `.tour-stop-card` markup. Ensure no fixed widths leak.

### 4.4 Stats + Offline Callout

- Stack below stops, full-width, `margin: 0 12px 12px;` each. Same content as current sidebar — just block-stacked.

---

## 5. Memory Tab — Mobile Spec

### 5.1 Layout Stack

```
┌─────────────────────────────────┐
│ App bar           56px          │
├─────────────────────────────────┤
│ Journey map      ~50dvh         │  full-bleed; round corners 0 on mobile (override existing 12px)
├─────────────────────────────────┤
│ Memory stats line               │
├─────────────────────────────────┤
│ "Daily wrap" header             │
│ Day cards (vertical stack)      │  full-width, margin: 0 12px 12px
├─────────────────────────────────┤
│ Journal textarea (full-width)   │
├─────────────────────────────────┤
│ Highlights photo grid (3-col)   │
├─────────────────────────────────┤
│ "Print to hardcover" CTA        │
└─────────────────────────────────┘
```

- Journey map: `#journey-map { height: 50dvh; border-radius: 0; }` inside a `<768px` media query.
- Sidebar items (journal / highlights / print) flow below day cards instead of beside them.

---

## 6. Tablet Spec (`768–1023px`)

- **Plan tab:** keep 2-column but reduce right panel to `width: 320px; min-width: 280px;` and **disable** the bottom sheet entirely. App bar + day strip stay at full width across both columns.
- **Tour tab:** keep sidebar but width `200px`. Stops fill remaining.
- **Memory tab:** sidebar width `220px`. Otherwise unchanged.

---

## 7. Interaction Details

### 7.1 Sheet Drag Physics

- Pointer events with `setPointerCapture` on the handle area.
- During drag: `translateY` follows pointer 1:1 inside snap range. Outside range (overdrag up beyond `full`, down beyond `peek`): apply rubber-band `displacement = direction * 32 * (1 - exp(-overdrag/100))`.
- Release: pick nearest snap weighted by velocity. Velocity threshold `0.5 px/ms`: if `|v| > threshold` snap in the direction of velocity to the next snap; else snap to nearest by distance.
- Animation: CSS transition `transform 280ms cubic-bezier(.32,.72,.0,1)` applied only during the post-release snap (toggle a `.is-snapping` class). Removed during finger-down drag for zero lag.
- Frame budget: 60fps on iPhone 12-class hardware (iPhone Safari). No layout-thrash: only `transform` mutates during drag.

### 7.2 Tap Stop Card

- Tap on stop card body (not on arrow button) → `selectStop(stop.id)` → fly map to stop coords (Leaflet `setView` with zoom 14, `{animate: true, duration: 0.4}`) → open existing popup → set sheet state to `half`.

### 7.3 Tap Map Marker

- Existing marker `click` handler → scroll list to that stop's card (use `scrollIntoView({block:'center', behavior:'smooth'})`) → flash card via 1.1s amber-bg pulse (reuse `memFlash` keyframes, applied to `.plan-stop-card.is-selected`) → set sheet state to `half` if currently `peek`; leave `full` alone.

### 7.4 Day Switch

- Existing `setDay(d)` → reset sheet to `half` → `map.fitBounds(dayBounds, {padding:[40,40]})`.

### 7.5 Keyboard Nav

- Existing `j` / `k` / Arrow handlers **remain desktop-only**. Wrap their `keydown` listener in `if (window.matchMedia('(min-width: 1024px)').matches) { … }`.

---

## 8. Implementation Guidance

### 8.1 Approach

- CSS-first. New `@media (max-width: 767px)` block at end of `<style>`.
- Sheet snap math: pure JS, no library. ~120 lines.
- All Tailwind utility classes; no new dependencies; CDN-only stays as-is.
- Single file constraint absolute — every change goes in `index.html`.

### 8.2 DOM Strategy

- **Reuse existing DOM** for the Plan tab's right panel. On mobile, CSS lifts the `<div>` currently at `width: 38%` into a fixed bottom-sheet container. Use a wrapper class `.plan-sheet` toggled at the mobile breakpoint; do not duplicate panel markup.
- Add three render targets that exist only on mobile:
  - `.plan-sheet-handle` — drag handle row
  - `.plan-sheet-peek` — peek strip (populated from same `currentDay.stops` data)
  - `.plan-fab-cluster` — FABs
- Re-render peek strip alongside list in `renderPlanDay()` — both populated, CSS picks which is visible.

### 8.3 JS Function Names — Preserve Exactly

Do **not** rename any of: `selectStop`, `setDay`, `setTab`, `togglePlanFood`, `setPlanPanelTab`, `gmapsUrl`, `openModal`, `logout`, `toggleTripPicker`, `renderPlanDay`, `renderTour`, `renderMemory`. New functions for sheet logic should use prefix `sheet*`: `sheetSnap`, `sheetOnPointerDown`, `sheetOnPointerMove`, `sheetOnPointerUp`, `sheetGetHeight`.

### 8.4 Viewport / Safe Area

- All full-height containers use `100dvh` not `100vh`.
- App bar: `padding-top: env(safe-area-inset-top, 0px);` (additive over the 56px).
- Sheet peek strip + FAB cluster: include `env(safe-area-inset-bottom, 0px)` in bottom offsets.
- Left/right safe-area negligible on iPhone in portrait but add `env(safe-area-inset-left/right, 0px)` to sheet padding for completeness.

### 8.5 What NOT to Touch

- Desktop layout at `≥1024px` — pixel-identical to current.
- Existing keyboard shortcuts (desktop).
- Login overlay, verify banner, trip picker dropdown.
- Map marker rendering / Leaflet config beyond `fitBounds` padding values.
- Any backend / API calls.

---

## 9. Acceptance Criteria (Builder Checklist)

- [ ] At 360 / 390 / 430 / 768 / 1280 widths, no horizontal scrollbar anywhere.
- [ ] Bottom sheet at `peek`, `half`, `full` snaps cleanly; drag at 60fps in iPhone Safari (verified via DevTools FPS meter or device).
- [ ] Map remains pannable + pinchable in all 3 sheet states.
- [ ] Day-tab strip scrolls horizontally; `+` / `−` controls visible at all widths.
- [ ] Tapping a stop chip in peek strip flies map + snaps sheet to half.
- [ ] Tapping a map marker scrolls list to the stop, flashes card amber, snaps sheet to half (only if currently peek).
- [ ] Tapping the navigate arrow opens Google Maps via `gmapsUrl()`.
- [ ] Map/List FAB toggles between peek and full.
- [ ] Tour tab: quick-action pill bar scrolls horizontally; all 5 modals still open.
- [ ] Memory tab: journey map at 50dvh, no overflow, day cards stacked.
- [ ] Desktop (≥1024px): layout pixel-matches current — visually diff a screenshot.
- [ ] Keyboard `j` / `k` / arrows still work on desktop, ignored on mobile.
- [ ] No new console errors / warnings on load or interaction.
- [ ] Visual polish vs. `handoff/ref-frames/frame_01..09.jpg`: stop badges red shield shape, orange promo banner indented, blue Auto-sort pill, drag handle pill above chevron, FAB stack matches frame_01.

---

## 10. Snap-Point ASCII Reference

```
Viewport (dvh = 100):
┌──────────────────────────┐ 0%
│   App bar     56px       │
├──────────────────────────┤
│   Day strip   44px       │
├──────────────────────────┤
│                          │
│         MAP              │
│                          │
│      [FABs]              │  ← anchored to sheet top edge
│ ┌────────────────────┐   │
│ │  SHEET — full      │ ← 8dvh from top
│ │                    │
│ │                    │
│ │                    │
│ │                    │
│ │                    │
│ └────────────────────┘
└──────────────────────────┘ 100%

Half snap:               Peek snap:
┌──────────────────────┐ ┌──────────────────────┐
│ App+strip 100px      │ │ App+strip 100px      │
│                      │ │                      │
│   MAP visible        │ │   MAP visible        │
│                      │ │   (most of viewport) │
│ ┌──────────────────┐ │ │                      │
│ │ Sheet 50dvh      │ │ │                      │
│ │ list + filter    │ │ │ ┌──────────────────┐ │
│ │ + cards          │ │ │ │ Peek 88px        │ │
│ └──────────────────┘ │ │ │ horiz chip strip │ │
└──────────────────────┘ │ └──────────────────┘ │
                         └──────────────────────┘
```

---

**End of spec.** Builder: implement top-down. Verify acceptance criteria before handoff.
