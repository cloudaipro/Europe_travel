# Session Checkpoint — 2026-05-14
*Read this before reading anything else. If it covers current state, skip BUILD-LOG.*

---

## Where We Stopped

Steps 1 + 2 + 3 complete and committed locally:
- **Step 1** — Mobile-first adaptive UI (3 tabs).
- **Step 2** — KG-1: mobile stop card redesign per spec §3.5.1.
- **Step 3** — KG-3 partial close: Auto-sort CTA + day add/remove wired (backend + frontend).

No active step. Pick next when ready.

---

## What Was Decided This Session

- Reference design: chicTrip Taiwanese travel app emulated for Plan tab mobile.
- Single-file constraint for frontend; minimal additions for backend.
- Breakpoints: mobile `<768px`, tablet `768–1023px`, desktop `≥1024px`.
- Sheet z-index = 1000 (above Leaflet panes 400-700); FABs at 1001.
- ALONGSIDE rendering for mobile cards (preserves desktop `<details>`).
- Auto-sort reuses existing reorder endpoint; new endpoints only for day add/remove.
- Day add appends last; day remove only the last day. No mid-trip insertion/deletion.

---

## Still Open (Known Gaps)

- **KG-2** — Promo banner gated on `stop.promo` field (backend-deferred).
- **KG-3 (residual)** — Orange `+` add-stop FAB and Publish flow (both need UX decisions).
- **KG-6** — Race condition on `+` day double-tap creates two days.
- **KG-7** — Auto-sort doesn't handle `"HH:MM +1"` next-day notation.
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
