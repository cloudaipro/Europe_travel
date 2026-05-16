# Review Request — Step 13

**Step:** 13 — Local SQLite + Data Layer
**Ready for Review:** YES
**Builder:** Bob
**Date:** 2026-05-16

---

## What changed

Defines `TripStore` interface in core, implements `IOSTripStore` (SQLite-backed) in the iOS package with schema bootstrap, and wires the bundle into the iOS `www/` at build time. Web build is untouched. No fetch interceptor (Step 14).

## Files

### New — core

- **`TourCompanion/packages/core/src/store/types.ts`** (1-82) — `TripStore` interface + 5 input types (`TripCreateInput`, `StopCreateInput`, `CheckInInput`, `JournalUpdate`, `VoiceNoteInput`). Field names mirror Pydantic schemas exactly (snake_case).
- **`TourCompanion/packages/core/src/store/index.ts`** (1) — re-export barrel.

### New — ios runtime

- **`TourCompanion/packages/ios/src/runtime/sqlite/schema.ts`** (1-94) — `SCHEMA_STATEMENTS` (12 stmts: 8 CREATE TABLE, 2 CREATE INDEX, schema_meta + version-1 seed). Matches Python column types; `published_slug` absent.
- **`TourCompanion/packages/ios/src/runtime/sqlite/serialize.ts`** (1-188) — row → wire mappers. `rowToTripDetail` (152-178) mirrors `_trip_to_detail` (routes/trips.py:44-66). `rowToStop` (110-135) mirrors `_stop_to_out` (routes/trips.py:31-42). JSON columns round-trip safely with empty-array / null fallback.
- **`TourCompanion/packages/ios/src/runtime/sqlite/store.ts`** (1-271) — `IOSTripStore` class. Key methods:
  - `listTrips` 56-65
  - `getTrip` 67-99 (N+1 hydration — see decision)
  - `hydrateStop` 101-122
  - `createTrip` 126-194 (NOT wrapped in `executeTransaction` — see decision)
  - `deleteTrip` 196-200 (relies on PRAGMA foreign_keys CASCADE)
  - `addDay` 204-218
  - `removeDay` 220-235 (resequences `n` after delete)
  - `addStop` 239-264 (computes `max(order_idx)+1`)
  - `reorderStops` 266-274 (uses `executeTransaction`)
  - `deleteStop` 276-285
  - Live-tour writes (`checkIn` / `updateJournal` / `addVoiceNote` / `addPhoto`) 289-313
- **`TourCompanion/packages/ios/src/runtime/sqlite/index.ts`** (1-31) — `initSqliteStore` factory. `isConnection` retrieve-or-create guard for hot-reload; `PRAGMA foreign_keys = ON` after open.
- **`TourCompanion/packages/ios/src/runtime/entry.ts`** (1-24) — IIFE entry. Silent no-op when `Capacitor.getPlatform() !== "ios"`. Init errors caught and logged.

### New — ios tooling

- **`TourCompanion/packages/ios/build.mjs`** (1-23) — esbuild IIFE → `www/ios.bundle.js`. Target `es2020`, no sourcemap.
- **`TourCompanion/packages/ios/tsconfig.json`** (1-11) — `noEmit`, `lib: ["ES2022", "DOM"]`, types `["node"]`.

### Modified

- **`TourCompanion/packages/core/src/index.ts`** (32-41) — re-exports `TripStore` types; `CORE_VERSION = "0.4.0"`.
- **`TourCompanion/packages/core/package.json`** (3) — version `0.4.0`.
- **`TourCompanion/packages/core/tests/smoke.test.ts`** (5-6) — assert `"0.4.0"`.
- **`TourCompanion/packages/ios/package.json`** (full) — version `0.2.0`, `type: "module"`, adds `@capacitor-community/sqlite@^6.0.2`, devDeps for esbuild/tsc, new `build` + `typecheck` scripts, `build:web` chains esbuild step.
- **`TourCompanion/packages/ios/copy-web.mjs`** (37-55) — injects `<script src="/ios.bundle.js"></script>` before `</body>`. Idempotent; bails if no `</body>` found.
- **`TourCompanion/package-lock.json`** — 35 packages added.

## Verification

- `npm run build` — core tsc + ios bundle (79.7kb) + web bundle — PASS
- `npm run typecheck` — all workspaces exit 0 — PASS
- `npm test` — 67/67 core tests pass (smoke updated to 0.4.0) — PASS
- `npx cap sync ios` — detects `@capacitor-community/sqlite@6.0.2` — PASS
- `Podfile.lock` — contains `CapacitorCommunitySqlite (6.0.2)` — PASS
- `xcodebuild ... build CODE_SIGNING_ALLOWED=NO` — `** BUILD SUCCEEDED **` — PASS

## Open questions for Richard

1. **`createTrip` is sequenced via individual `db.run` calls, not wrapped in `executeTransaction`.** Each insert needs the prior `lastId` (trip.id → day.trip_id → stop.day_id). Acceptable for v1? Alternative is `SELECT last_insert_rowid()` between inserts — mostly cosmetic.
2. **`getTrip` issues ~80 queries for a typical 5-day × 5-stop trip.** On-device SQLite this is sub-millisecond, but flag if you'd prefer a JOIN + manual grouping refactor before Step 14.
3. **Bundle ships without sourcemaps.** Cleaner App Store binary, harder production crash triage. Flag if you'd rather have sourcemaps in dev builds.

No Python or web frontend changes.
