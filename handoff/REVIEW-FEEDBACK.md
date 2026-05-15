# Review Feedback — Step 2 (Mobile Stop Card Redesign)
Date: 2026-05-14
Reviewer: Richard
Verdict: CLEAR

## Tier 1 findings

None blocking. All five Tier 1 checks pass:

1. **Desktop ≥768px scoping.** Confirmed at index.html:725–728: `@media (min-width: 768px) { .plan-stop-card-m, .plan-transit-row-m { display: none !important; } }`. Existing `<details>` at desktop is untouched — the hide rule for `<details>` at index.html:440–441 lives inside `@media (max-width: 767px)` (mobile block 201–715), so it does not fire at ≥768px. Pixel-frozen.
2. **Mobile <768px no double-render.** Inside mobile media: `.plan-sheet-shell #plan-day-content details.plan-stop-card, .plan-sheet-shell #plan-day-content .walk-connector { display: none; }` (lines 440–441). New `.plan-stop-card-m` and `.plan-transit-row-m` rendered alongside (pieces.push at 2092 and 2134). No overlap.
3. **No undefined function calls.** `_catGlyph` defined at 2010, `_stopCategory` at 1920, `gmapsUrl` at 1289, `selectStop` at 1770. All reachable from the new render path.
4. **Nav arrow stopPropagation.** index.html:2109 — `onclick="event.stopPropagation();"` on the `<a class="pscm-nav-arrow">`. Default link navigation (target="_blank") is preserved (no preventDefault). Card-body click does not fire.
5. **No new console-error sources.** STATE is initialized in `loadTrip()` (line 1098) before any `renderPlanDayContent` call. Pattern reuse (`STATE.stop_photos[\`${n}-${i}\`] || []`) is identical to Tour tab at line 2396. No null deref risk in normal flow.

## Tier 2 findings

6. **Notes indicator data source.** Key format `${n}-${i}` at line 2087–2088 matches Tour tab (line 2396–2397) and Memory tab (line 2573, 2589) verbatim. Same data, same key shape. Approved.
7. **Duration fallback.** `s.duration || s.stay || "Stay 1h 00m"` (line 2090) — hardcoded string is the right call for now: stop data has no duration field, so an empty third row would look broken. Spec §3.5.1 row 3 literally specifies "Stay 1h 00m" as the label format. Approved.
8. **Badge clip-path.** Line 478 uses `polygon(0 0, 100% 0, 100% 75%, 75% 100%, 0 100%)` — matches DESIGN-SPEC §1.6 exactly. 24×26, top-left, white digit 13/800. Compliant.
9. **Card body tap source.** Line 2094 — `onclick="selectStop(${i}, 'list')"`. `selectStop` mobile branch (line 1806) explicitly accepts `'list' | 'peek' | 'key'` and snaps the sheet to half. Correct routing.
10. **Transit row data reuse.** Lines 2114–2127 reuse the same `next.transit` raw parse + haversine fallback as the existing `.walk-connector` block (2128–2132). Identical `connLabel` and `isWalk` values feed both. Not hardcoded.

## Tier 3 findings

11. **Naming.** `.pscm-*` (mobile stop card) and `.pttrm-*` (mobile transit row) are consistent within each family. All classes used in the JS template are defined in CSS (verified: thumb, badge, info, time-row, cat-icon, name, duration, nav-arrow, icon, dur, chev).
12. **Dead CSS / duplicates.** `.pscm-thumb` is given `overflow: visible` so the badge can bleed `left:-4px` — intentional per §1.6. `.pscm-thumb img` re-asserts 60×60 + radius — fine for box-model isolation, not dead. No duplicates.

## Bob's judgment calls — Richard's calls

1. Notes indicator data source (`STATE.voice_notes[${n}-${i}]`, `STATE.stop_photos[${n}-${i}]`) — **yes**. Key format and access pattern match Tour and Memory tabs verbatim.
2. Duration fallback "Stay 1h 00m" — **yes**. Spec §3.5.1 literally names this as the label format. Empty third row would look broken. Reconsider when real duration data exists.
3. Hiding `.walk-connector` on mobile — **yes**. Without it, the dashed connector would double-render alongside `.plan-transit-row-m`. Scoped to `.plan-sheet-shell #plan-day-content` and to the mobile media block, so desktop is untouched.
4. `_catGlyph` mapping via `_stopCategory` — **yes**. Spec §1.6 lists glyphs by semantic role; existing `_stopCategory` already classifies stops into the right buckets. Fallback to 🕒 on unrecognized category is safe. Mapping is correct: HOTEL→🏨, CAFÉ→☕, DINING→🍴, SPA→♨️, CHURCH→⛪, etc.

## Summary for Arch

Step 2 (KG-1 mobile stop card redesign) is clear. Bob added ~125 lines of mobile-scoped CSS and ~45 lines of JS, all additive — zero existing DOM or class modified. Desktop ≥768px pixel-frozen via `display: none !important` on the new `.plan-stop-card-m` / `.plan-transit-row-m`. Mobile <768px hides the existing `<details>` and `.walk-connector` (scoped inside `.plan-sheet-shell #plan-day-content` and the `max-width: 767px` media block) so no double-render. Badge shape matches DESIGN-SPEC §1.6 exactly. Nav arrow uses `event.stopPropagation()` so the card-body click does not double-fire. All function references (`_catGlyph`, `_stopCategory`, `gmapsUrl`, `selectStop`) are defined and reachable. Notes-indicator data source mirrors the Tour / Memory tab pattern verbatim. All four of Bob's judgment calls stand. No must-fix, no should-fix. Ready to ship.
