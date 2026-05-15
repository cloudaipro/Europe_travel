# Session Checkpoint — 2026-05-14
*Read this before reading anything else. If it covers current state, skip BUILD-LOG.*

---

## Where We Stopped

Steps 1 + 2 complete and committed locally:
- **Step 1** — Mobile-first adaptive UI for all 3 tabs (Plan / Tour / Memory). Bottom-sheet over map on Plan (3 snaps), pill bar on Tour, stacked layout on Memory. Desktop ≥1024px pixel-frozen.
- **Step 2** — KG-1: mobile stop card redesign. New `.plan-stop-card-m` matches DESIGN-SPEC §3.5.1 (60×60 thumb + red shield badge + category icon + time + name + duration + 36×36 nav arrow). Transit row between cards. ALONGSIDE rendering keeps `<details>` for desktop unchanged.

No active step. Pick next when ready.

---

## What Was Decided This Session

- Reference design: chicTrip Taiwanese travel app emulated for Plan tab mobile.
- Single-file constraint: all UI in `TourCompanion/server/frontend/index.html`.
- Breakpoints: mobile `<768px`, tablet `768–1023px`, desktop `≥1024px`.
- Sheet z-index = 1000 (above Leaflet panes 400-700); FABs at 1001.
- Stub buttons (Publish, +, +/−, Auto-sort, Search): `disabled title="Coming soon"`. KG-3 backend-deferred.
- Promo banner gated on `stop.promo` field (KG-2, backend-deferred).
- ALONGSIDE rendering for mobile cards — keeps desktop `<details>` intact (preserves drag-reorder, `_onStopSummaryClick`, keyboard nav).

---

## Still Open

- **KG-2** — Promo banner (backend-deferred; no `stop.promo` field).
- **KG-3** — Auto-sort / +/− day controls / Publish / orange `+` FAB (all backend-deferred).
- No git remote configured — `git push` will fail.

All other Known Gaps closed.

---

## Resume Prompt

Copy and paste this to resume:

---

You are Arch on TourCompanion (Three Man Team).
Read SESSION-CHECKPOINT.md, then ARCHITECT.md.
Confirm where we stopped and what the next action is. Then wait.

---
