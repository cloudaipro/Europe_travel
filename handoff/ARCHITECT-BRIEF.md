# Architect Brief — Step 2: Mobile Stop Card Redesign (KG-1)

---

## Step 2 — Re-template stop card in the mobile sheet per DESIGN-SPEC §3.5.1

### Goal

The existing `<details>` stop-card markup carries through to the mobile sheet via CSS reshape, but doesn't visually match the chicTrip reference (60×60 thumb left, red numbered shield badge overlay, center info column, **36×36 always-visible navigate arrow** on the right). Bring the mobile rendering to the spec literal layout WITHOUT breaking:

- Drag-reorder (currently wired on `<details>` row drag handles)
- `_onStopSummaryClick` (toggles details open/closed)
- Keyboard nav (`j/k/↑↓/←→/Esc`) — desktop only
- Desktop ≥1024px layout (pixel-frozen)

### Source of truth

- **DESIGN-SPEC §3.5.1** (lines covering "Stop card (`.plan-stop-card`)") — literal layout target.
- **Reference frame:** `handoff/ref-frames/frame_01.jpg` — the expanded-sheet view shows the target stop card layout clearly.
- **File under edit:** `TourCompanion/server/frontend/index.html` only.

### Decisions (locked)

- **Approach:** ALONGSIDE rendering. Keep the existing `<details>`/`<summary>` markup untouched (desktop relies on it). In `renderPlanDayContent()`, append a *second* card representation — `.plan-stop-card-m` — per stop. Mobile CSS shows `.plan-stop-card-m`, hides `<details>`. Desktop ≥768px shows `<details>`, hides `.plan-stop-card-m`.
- **Drag-reorder:** NOT required on mobile cards this step. Mobile users use the day-strip to switch days. Drag-reorder stays desktop-only via the existing markup.
- **Navigate arrow:** 36×36 right-side button on `.plan-stop-card-m`, calls existing `gmapsUrl(stop)` via `window.open(url, '_blank')`.
- **Tap card body:** calls existing `selectStop(idx, 'list')` so map flies + sheet snaps to half + flash highlight all still work.
- **Transit row:** add a sibling `.plan-transit-row-m` between consecutive cards (already in current peek-strip implementation; reuse the styling pattern). Use existing per-stop transit data; if no transit data, render a generic "walk · ~Xm" using the existing `~Xm · Xkm` data already in the desktop card.
- **Promo banner:** still gated on `stop.promo` (no backend), skip emission this step.
- **Stop number badge:** red shield with `clip-path: polygon(0 0, 100% 0, 100% 75%, 75% 100%, 0 100%)` per DESIGN-SPEC §1.6 — already defined as `.psp-badge` for peek strip; reuse the class for the mobile card thumb overlay.
- **Single file constraint.** Do NOT split.

### Build order

1. Add CSS for `.plan-stop-card-m`, `.pscm-thumb`, `.pscm-badge`, `.pscm-info`, `.pscm-time-row`, `.pscm-name`, `.pscm-duration`, `.pscm-nav-arrow`, `.plan-transit-row-m`, `.pttrm-icon`, `.pttrm-dur`, `.pttrm-chev` — all scoped inside `@media (max-width: 767px)`.
2. Hide existing `<details>` cards on mobile via CSS: `.plan-sheet-shell #plan-day-content details { display: none; }` inside the mobile media block (only when in mobile viewport).
3. Hide `.plan-stop-card-m` and `.plan-transit-row-m` on tablet + desktop (`@media (min-width: 768px)`).
4. Extend `renderPlanDayContent(n)` — for each stop, after emitting the existing `<details>` block, also emit `.plan-stop-card-m` and (between consecutive stops) `.plan-transit-row-m`. Both new nodes have `display:none` outside the mobile media query.
5. Verify desktop visually identical to current.

### Flags — do not guess

- **Time-icon glyph mapping.** Spec §3.5.1 row 1 says "category-icon + time". Existing data has `stop.icon` or category field. Grep for what `renderPlanDayContent` already pulls (e.g. `s.icon`, `s.category`). Use the same source. If no category data, fall back to a single 🕒 glyph.
- **"(custom)" sub-label.** Spec mentions appending "(custom)" 12px when user-set. We have no `user_set` flag on stops. Skip the label — render time only.
- **Notes indicator.** Spec says append " · noted" if notes exist. Stops have `voice_notes`/`journal`/`photos` arrays. Render " · noted" when any of those is non-empty.
- **Transit row data source.** Existing markup emits `~X min · X.X km`. Reuse those values directly. Icon = walking/bus glyph based on what current markup uses, else 🚶.
- **Drag handle column on the existing card** (left `≡` icon at line ~1873). Hide on mobile via the same `<details>` hide rule — don't worry about it.

### Definition of Done

- [ ] At mobile <768px, sheet shows new `.plan-stop-card-m` cards: 60×60 thumb on left with red numbered badge overlay, center info column (time + name + duration + optional " · noted"), 36×36 nav-arrow button on right.
- [ ] Tapping card body calls `selectStop(idx, 'list')`.
- [ ] Tapping nav-arrow opens Google Maps (`gmapsUrl(stop)`).
- [ ] Transit rows between consecutive cards show icon + duration + chevron.
- [ ] Existing `<details>` cards are hidden on mobile.
- [ ] Desktop ≥1024px shows existing `<details>` only — visually byte-identical to before. New mobile cards render with `display:none`.
- [ ] Tablet 768–1023px also shows existing `<details>` (narrow side panel preserved).
- [ ] No new console errors at any viewport.
- [ ] Keyboard `j/k/↑↓/Esc` still works on desktop (it doesn't touch the new markup).
- [ ] Drag-reorder still works on desktop.
- [ ] `handoff/REVIEW-REQUEST.md` updated with Revision 3 — Step 2.

---

## Builder Plan
*Bob writes here before building. Approve inline by Bob if no ambiguity — skip the round-trip for this small scope.*

Architect approval (in advance, given the brief is unambiguous and ALONGSIDE approach removes most risk):
- [x] **Pre-approved to build.** Bob: plan and code in one round. If you hit a genuine ambiguity not covered by the Flags section, stop and write the question into REVIEW-REQUEST.md instead.

---
