# Build Log
*Owned by Architect. Updated by Builder after each step.*

---

## Current Status

**Active step:** — (Step 1 closed)
**Last cleared:** Step 1 — Mobile-first adaptive UI redesign — 2026-05-14
**Pending deploy:** NO (committed locally; no remote configured)

---

## Step History

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

- **KG-1** — Stop card in sheet uses existing `<details>` markup; spec §3.5.1 literal redesign deferred — logged 2026-05-14.
- **KG-2** — Promo banner markup not emitted (no `stop.promo` field in API) — logged 2026-05-14.
- **KG-3** — Auto-sort CTA + `+` FAB + Publish + day `+`/`−` are disabled stubs (no backend) — logged 2026-05-14.
- **KG-4** — Visual scratch test at 1280px done via diff-read only (no live browser this session) — logged 2026-05-14.

---

## Architecture Decisions
*Locked decisions that cannot be changed without breaking the system.*

- **Single-file constraint** — all UI in `TourCompanion/server/frontend/index.html` — 2026-05-14.
- **Desktop ≥1024px is pixel-frozen** — any visual change at desktop is a regression — 2026-05-14.
- **Sheet snap state owned by CSS class on `.plan-sheet-shell`** (`sheet--peek/--half/--full`); JS only writes the class — 2026-05-14.
- **No new external libraries** — Tailwind CDN + Leaflet only — 2026-05-14.
