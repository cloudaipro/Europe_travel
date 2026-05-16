# Review Feedback — Step 13
Date: 2026-05-16
Ready for Builder: YES

## Must Fix
None.

## Should Fix
- `TourCompanion/packages/ios/src/runtime/sqlite/store.ts:131-206` — `createTrip` is not wrapped in a transaction. Acceptable for v1 as flagged, but log a one-line BUILD-LOG entry so future maintenance knows that a mid-flight crash can leave a partial trip (orphan `trips` row + some days/stops, with no automatic CASCADE recovery unless the user explicitly deletes that trip). When Step 14 wires the fetch interceptor and real users hit it, revisit using `executeTransaction` with `RETURNING id` (SQLite 3.35+) or by driving day/stop inserts off a single trip insert plus post-hoc id lookup. Not a blocker now.
- `TourCompanion/packages/ios/src/runtime/sqlite/store.ts:67-105` — `getTrip` N+1 (~80 queries for a 5x5 trip). Accept for v1: on-device SQLite this is sub-millisecond. Revisit only if Step 14 profiling shows visible jank.

## Escalate to Architect
None. Brief was explicit; Bob followed it.

## Cleared
Reviewed Step 13 (SQLite plugin install, `TripStore` interface, `IOSTripStore` impl, iOS bundle wiring).

- **`TripStore` interface** — `packages/core/src/store/types.ts:1-82` matches brief signatures field-for-field. All 5 input types (`TripCreateInput`, `StopCreateInput`, `CheckInInput`, `JournalUpdate`, `VoiceNoteInput`) and all 13 methods present with exact snake_case field names that mirror the Pydantic schemas.
- **`CORE_VERSION`** — `packages/core/src/index.ts:39` and `packages/core/package.json:3` both at `0.4.0`; `tests/smoke.test.ts:5-6` asserts the new value.
- **Schema** — `packages/ios/src/runtime/sqlite/schema.ts` covers all 7 v1 tables (`trips`, `days`, `stops`, `bookings`, `check_ins`, `photos`, `voice_notes`) plus `schema_meta` with the version-1 seed. Both required indexes (`idx_days_trip`, `idx_stops_day`) present. `published_slug` correctly absent. JSON columns stored as `TEXT` with `'[]'` / `NULL` defaults. FK CASCADE wired on every child table.
- **Bootstrap** — `packages/ios/src/runtime/sqlite/index.ts:11-32` runs `PRAGMA foreign_keys = ON` after `db.open()` (per brief). `isConnection` retrieve-or-create guard handles hot-reload.
- **`IOSTripStore`** — `packages/ios/src/runtime/sqlite/store.ts` implements every `TripStore` method (listTrips, getTrip, createTrip, deleteTrip, addDay, removeDay, addStop, reorderStops, deleteStop, checkIn, updateJournal, addVoiceNote, addPhoto). Zero TODOs, zero `throw new Error("unimplemented")`, zero placeholder bodies (grepped). `addStop` correctly computes `MAX(order_idx) + 1`. `removeDay` resequences `n` after deletion (matches Python). `reorderStops` uses `executeTransaction` as required. `createTrip` seeds `created_at = new Date().toISOString()` per brief.
- **Serialize parity** — `rowToTripDetail` (serialize.ts:174-200) mirrors `_trip_to_detail` field-for-field against `packages/core/src/types/trip.ts`. `published_slug` surfaces `null`. iOS-dropped tables (`companion_docs`, `routes`, `street_food`) return `[]`.
- **Bundle injection** — `packages/ios/copy-web.mjs:42-55` injects `<script src="/ios.bundle.js"></script>` only into the staged `packages/ios/www/index.html`. Verified `packages/web/public/index.html` contains zero `ios.bundle.js` references (`grep -c` returned 0). Idempotent guard present.
- **Bundle build** — `npm run build` produces `packages/ios/www/ios.bundle.js` at 79.7kb (IIFE, es2020, sourcemap: false). Confirmed via `git check-ignore` that both `packages/ios/www/` and `packages/ios/www/ios.bundle.js` are gitignored.
- **Verification re-runs (from `TourCompanion/`)**:
  - `npm test` — 14 files, **67/67 core tests pass**, smoke at 0.4.0.
  - `npm run typecheck` — all workspaces exit 0.
  - `npm run build` — core tsc + web bundle + ios bundle all green.
- **`xcodebuild`** — not re-run (slow; brief allows trusting Bob's log when scaffold + Podfile.lock + bundle are intact). `Podfile.lock` pins `CapacitorCommunitySqlite (6.0.2)`.
- **No fetch interceptor** — grepped `runtime/`; only forward-reference comments mentioning Step 14. `window.TCStore` is the only global exposed.
- **Scope discipline** — `git status` shows zero edits under `TourCompanion/server/` (Python) and zero edits under `packages/web/public/`. Only expected files modified.

No drift, no out-of-scope edits. Step 13 is clear.
