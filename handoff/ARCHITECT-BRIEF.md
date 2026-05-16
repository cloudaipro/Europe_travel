# Architect Brief

## Initiative — Standalone iOS Version (continued)

Steps 8-12 complete. Now Step 13.

---

## Step 13 — Local SQLite + Data Layer

**Scope:** Add `@capacitor-community/sqlite` to the iOS package. Define a `TripStore` interface in `@tourcompanion/core`. Implement `IOSTripStore` (SQLite-backed) in `packages/ios`. Add schema bootstrap that runs on app launch. Provide CRUD covering all endpoints the existing frontend hits. **Web is unchanged** — keeps using the FastAPI server. The fetch-interceptor wiring on iOS comes in Step 14/15.

Reference: existing Python models at `TourCompanion/server/app/models.py`. v1 iOS skips: `users`, `email_tokens`, `companion_docs`, `route_assets`, `ingest_jobs`, `street_food`. Keep: `trips`, `days`, `stops`, `bookings`, `check_ins`, `photos`, `voice_notes`. Note: `published_slug` column dropped on iOS (no publish flow).

### TripStore Interface — `packages/core/src/store/types.ts`

```ts
import type { TripDetail, TripSummary, Stop, Day } from "../types";

export interface TripCreateInput {
  name: string;
  destination: string;
  start_date: string;   // ISO
  end_date: string;     // ISO
  season?: string;
  style?: string;
  pace?: string;
  source_url?: string;
  hotel_name?: string;
  hotel_lat?: number | null;
  hotel_lng?: number | null;
  hotel_address?: string;
  days?: Array<{
    n: number;
    date_label?: string;
    theme?: string;
    mode?: string;
    stops?: Array<Omit<Stop, "id" | "check_in_count" | "photo_paths" | "voice_transcript">>;
  }>;
  bookings?: Array<{ label: string; url?: string; done?: boolean }>;
}

export interface StopCreateInput {
  day_id: number;
  time_label?: string;
  name: string;
  address?: string;
  lat?: number | null;
  lng?: number | null;
  hours?: string;
  tickets?: string;
  intro?: string;
  highlights?: string[];
  transit?: string;
  washroom?: string;
  food?: string[];
}

export interface CheckInInput { stop_id: number; lat?: number | null; lng?: number | null; }
export interface JournalUpdate { trip_id: number; journal: string; }
export interface VoiceNoteInput { stop_id: number; transcript: string; audio_path?: string; }

export interface TripStore {
  listTrips(): Promise<TripSummary[]>;
  getTrip(id: number): Promise<TripDetail | null>;
  createTrip(input: TripCreateInput): Promise<TripDetail>;
  deleteTrip(id: number): Promise<void>;

  addDay(tripId: number): Promise<TripDetail>;
  removeDay(tripId: number, dayN: number): Promise<TripDetail>;

  addStop(input: StopCreateInput): Promise<TripDetail>;
  reorderStops(dayId: number, stopIds: number[]): Promise<TripDetail>;
  deleteStop(stopId: number): Promise<TripDetail>;

  checkIn(input: CheckInInput): Promise<void>;
  updateJournal(input: JournalUpdate): Promise<void>;
  addVoiceNote(input: VoiceNoteInput): Promise<void>;
  addPhoto(stopId: number, path: string, caption?: string): Promise<void>;
}
```

Export from `packages/core/src/index.ts`. Bump `CORE_VERSION` to `0.4.0`.

### IOSTripStore — `packages/ios/src/runtime/sqlite/`

```
packages/ios/src/runtime/sqlite/
  schema.ts        # SQL CREATE TABLE statements + migration runner
  store.ts         # IOSTripStore class implementing TripStore
  serialize.ts     # row → TripDetail mapper, TripDetail → rows
  index.ts         # initSqliteStore() factory
```

### Schema (SQL)

Match Python column types and constraints. Use `INTEGER PRIMARY KEY AUTOINCREMENT` for ids. Use `TEXT` for JSON columns (`highlights`, `food`, `promo`) — serialize as JSON strings. ISO date/datetime stored as `TEXT`.

```sql
CREATE TABLE IF NOT EXISTS trips (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  destination TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planning',
  season TEXT DEFAULT '',
  style TEXT DEFAULT '',
  pace TEXT DEFAULT '',
  source_url TEXT DEFAULT '',
  hotel_name TEXT DEFAULT '',
  hotel_lat REAL,
  hotel_lng REAL,
  hotel_address TEXT DEFAULT '',
  journal TEXT DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS days (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  n INTEGER NOT NULL,
  date_label TEXT DEFAULT '',
  theme TEXT DEFAULT '',
  mode TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_days_trip ON days(trip_id);

CREATE TABLE IF NOT EXISTS stops (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  day_id INTEGER NOT NULL REFERENCES days(id) ON DELETE CASCADE,
  order_idx INTEGER DEFAULT 0,
  time_label TEXT DEFAULT '',
  name TEXT NOT NULL,
  address TEXT DEFAULT '',
  lat REAL,
  lng REAL,
  hours TEXT DEFAULT '',
  tickets TEXT DEFAULT '',
  intro TEXT DEFAULT '',
  highlights TEXT DEFAULT '[]',
  transit TEXT DEFAULT '',
  washroom TEXT DEFAULT '',
  food TEXT DEFAULT '[]',
  note TEXT DEFAULT '',
  promo TEXT
);
CREATE INDEX IF NOT EXISTS idx_stops_day ON stops(day_id);

CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  url TEXT DEFAULT '',
  done INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS check_ins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stop_id INTEGER NOT NULL REFERENCES stops(id) ON DELETE CASCADE,
  visited_at TEXT NOT NULL,
  lat REAL,
  lng REAL
);

CREATE TABLE IF NOT EXISTS photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stop_id INTEGER NOT NULL REFERENCES stops(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  caption TEXT DEFAULT '',
  taken_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS voice_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stop_id INTEGER NOT NULL REFERENCES stops(id) ON DELETE CASCADE,
  transcript TEXT DEFAULT '',
  audio_path TEXT DEFAULT '',
  recorded_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS schema_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

Insert `INSERT OR IGNORE INTO schema_meta(key, value) VALUES('version', '1')` after creates.

### Schema Bootstrap

`initSqliteStore()` returns a fully-initialized `IOSTripStore`. On first call:
1. `CapacitorSQLite.createConnection({ database: "tourcompanion", encrypted: false, mode: "no-encryption" })`
2. `db.open()`
3. `db.execute(SCHEMA_SQL)` — runs all `CREATE TABLE IF NOT EXISTS` statements
4. Returns store.

Hook bootstrap from `packages/ios/src/runtime/entry.ts`:
```ts
import { Capacitor } from "@capacitor/core";
import { initSqliteStore } from "./sqlite";

declare global {
  interface Window { TCStore?: import("@tourcompanion/core").TripStore; }
}

(async () => {
  if (Capacitor.getPlatform() !== "ios") return;
  window.TCStore = await initSqliteStore();
  console.info("[TC iOS] TripStore ready");
})();
```

### IOSTripStore Implementation

Implement every method on `TripStore`. Use parameterized queries. Wrap multi-table writes (e.g. `createTrip`) in `BEGIN/COMMIT` transactions via `db.executeTransaction`. Return-shape parity with Python `_trip_to_detail()` — read the function in `TourCompanion/server/app/routes/trips.py` lines ~44-66 to mirror.

`addStop` must compute the next `order_idx` for the day (max + 1).
`reorderStops` updates `order_idx` for each id in the supplied list.
`createTrip` inserts trip, then each day with stops, then bookings.

### iOS Bundler

Add `packages/ios/build.mjs` (esbuild) — bundles `packages/ios/src/runtime/entry.ts` → `packages/ios/www/ios.bundle.js` (IIFE). Update `copy-web.mjs` to NOT overwrite the iOS bundle (or have build:web copy web public, then build ios bundle into the same www). Build chain becomes:

```
npm run build:web    # 1. copy web/public → www/  2. build ios.bundle.js into www/
```

Update `package.json` scripts:
```json
"build:web": "npm run build --workspace=@tourcompanion/web && node copy-web.mjs && node build.mjs"
```

Frontend index.html — do NOT load `ios.bundle.js` automatically. iOS runs Capacitor which can be configured to inject a script. Simplest: append `<script src="/ios.bundle.js"></script>` to www/index.html during copy (a small post-process in `copy-web.mjs` that detects "is this the iOS www dir?"). Or pass through the same index.html and let it 404 on web — load conditionally.

**Approach picked:** In `copy-web.mjs`, after copying, append a `<script src="/ios.bundle.js"></script>` tag right before `</body>` in `www/index.html`. This file is regenerated each run and lives only in `packages/ios/www/` (gitignored). Web's `packages/web/public/index.html` is never modified.

### Add Dependency

```bash
npm install @capacitor-community/sqlite --workspace=@tourcompanion/ios
```

Then `npx cap sync ios` from `packages/ios/`.

### Verification Checklist

- [ ] `@capacitor-community/sqlite` installed and synced (visible in `packages/ios/ios/App/Podfile.lock`)
- [ ] `packages/core/src/store/types.ts` exports `TripStore` and all input types
- [ ] `CORE_VERSION === "0.4.0"`
- [ ] `packages/ios/src/runtime/sqlite/` files exist
- [ ] `npm run build` succeeds at workspace root (core builds, web bundle builds, ios bundle builds)
- [ ] `npm run build:web --workspace=@tourcompanion/ios` produces `packages/ios/www/index.html` (with injected `<script src="/ios.bundle.js">` before `</body>`) and `packages/ios/www/ios.bundle.js`
- [ ] `npm run cap:sync --workspace=@tourcompanion/ios` succeeds
- [ ] `xcodebuild -workspace ios/App/App.xcworkspace -scheme App -sdk iphonesimulator -configuration Debug -destination 'generic/platform=iOS Simulator' build CODE_SIGNING_ALLOWED=NO` exits 0
- [ ] `npm test` — 67 core tests still pass (TripStore types compile)
- [ ] `npm run typecheck` exit 0 across all workspaces
- [ ] No Python or web frontend changes

### Flags Bob Must Not Guess At

- **`@capacitor-community/sqlite`** version: latest 6.x compatible with Capacitor 6.
- **Do not** add a fetch interceptor in this step. Just expose `window.TCStore`. Step 14 wires the interceptor.
- **Do not** modify Python files, web frontend, or web bundle.
- **`createTrip`** must seed `created_at` = `new Date().toISOString()`.
- **Transactions:** `@capacitor-community/sqlite` API uses `db.executeTransaction([{ statement, values }, ...])`. Look at the plugin README in `node_modules/@capacitor-community/sqlite/README.md` if uncertain about exact API names — do NOT install the plugin twice.
- **No Realm, no IndexedDB, no localStorage.** SQLite only.
- **`Foreign Keys`** — SQLite requires `PRAGMA foreign_keys = ON` per connection. Run after `db.open()`.

---

Architect approval: [x] Pre-approved.
