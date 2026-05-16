# Architect Brief

## Initiative — Standalone iOS Version (continued)

Steps 8 complete. Now Step 9.

---

## Step 9 — Port Pure Helpers Python → TypeScript

**Scope:** Move all *pure* business helpers from the Python backend into `packages/core/src/`. "Pure" = no DB access, no network I/O, no FastAPI deps, no SQLAlchemy. Strict TS, fully typed, unit-tested. **Do not yet wire the web frontend or server to use them** — that happens in Step 11. Existing Python code stays in place and untouched.

### Functions to Port

From `TourCompanion/server/app/geocoder.py`:
- `haversine_km(a_lat, a_lng, b_lat, b_lng) -> float` — great-circle distance in km.
- `clean_name(name) -> str` — strip parenthetical / dash suffixes from POI names.
- `extract_city(address) -> str` — pull city token out of an address string.
- `build_queries(name, address) -> list[str]` — produce Nominatim query candidates.
- `_viewbox_around(lat, lng, delta_deg) -> tuple[float,float,float,float]` — bounding box helper.

From `TourCompanion/server/app/planner.py`:
- `_strip_code_fence(text) -> str` — strip ```json fences from LLM output.

From `TourCompanion/server/app/routes/trips.py`:
- Slug generation logic (currently inline). Extract as `generateSlug(): string` using Web Crypto (`crypto.getRandomValues` → base64url, length 10). Pure, environment-agnostic (works in Node + browser + Capacitor).
- Public sanitization logic (`_public_trip_to_detail`) — extract to `sanitizeTripForPublic(detail: TripDetail): TripDetail` taking a fully-formed TripDetail object and returning a new sanitized one (zero IDs, drop `journal`, `bookings`, per-stop `note`/`check_in_count`/`photo_paths`/`voice_transcript`). Note: iOS won't use this, but web will in Step 11 — port now for parity.

From `TourCompanion/server/frontend/index.html`:
- **KG-7 +1 parser.** Grep for `// KG-7` near line 1557. The function that parses `"HH:MM +N"` time strings and returns a sortable numeric key. Port as `parseStopTime(time: string): { minutes: number; dayOffset: number }`. Return a stable sort key as well: `stopTimeSortKey(time: string): number = dayOffset * 1440 + minutes`.

### Data Model Types

Port Pydantic schemas from `TourCompanion/server/app/schemas.py` into `packages/core/src/types/`. TS interfaces — not classes. Translate `Optional[X]` → `X | null` (NOT `X | undefined`; match JSON nullability). Translate `List[X]` → `X[]`. Use exact field names from Pydantic (snake_case, since that's the wire format).

Required interfaces:
- `Stop` (matches `StopOut`)
- `Day` (matches `DayOut`)
- `Booking` (matches `BookingOut`)
- `CompanionDoc` (matches `CompanionDocOut`)
- `RouteAsset` (matches `RouteAssetOut`)
- `StreetFood` (matches `StreetFoodOut`)
- `TripSummary`
- `TripDetail`
- `IngestIn`, `IngestOut`
- `CheckInIn`, `JournalIn`, `VoiceNoteIn`

### File Layout

```
packages/core/src/
  index.ts                  # re-exports public surface
  types/
    index.ts                # re-exports all types
    trip.ts                 # Stop, Day, Booking, CompanionDoc, RouteAsset, StreetFood, TripSummary, TripDetail
    api.ts                  # IngestIn, IngestOut, CheckInIn, JournalIn, VoiceNoteIn
  geo/
    haversine.ts            # haversineKm
    name.ts                 # cleanName, extractCity, buildQueries
    viewbox.ts              # viewboxAround
  planner/
    fence.ts                # stripCodeFence
  trips/
    slug.ts                 # generateSlug
    sanitize.ts             # sanitizeTripForPublic
  time/
    parse.ts                # parseStopTime, stopTimeSortKey
```

Naming convention: TS exports are **camelCase**, type names **PascalCase**. Internal Python snake_case in function names → camelCase in TS.

### Tests

Each module ships a vitest spec under `packages/core/tests/`. Mirror Python behavior for representative inputs. Coverage targets:

| Module | Test cases |
|---|---|
| `haversine` | (0,0)→(0,0)=0; (52.52,13.40)→(48.85,2.35) Berlin→Paris ≈ 878km ±5; antipodal |
| `name` | `"Belvedere Palace (Upper)"` → `"Belvedere Palace"`; empty; unicode |
| `viewbox` | sanity bounds around (48.2,16.4) ± 0.1 deg |
| `fence` | unwraps ```json ...```; passes plain text through; mixed |
| `slug` | length 10; charset `[A-Za-z0-9_-]`; 1000 calls → no collisions; non-empty |
| `sanitize` | known nested TripDetail → drops listed fields, zeros IDs, leaves required intact |
| `parseStopTime` | `"09:30"` → {minutes:570, dayOffset:0}; `"01:15 +1"` → {minutes:75, dayOffset:1}; `"23:00 +2"`; malformed → throw; sort key ordering |

All tests must pass: `cd TourCompanion && npm test`.

### `packages/core/src/index.ts` Public Surface

```ts
export * from "./types";
export { haversineKm } from "./geo/haversine";
export { cleanName, extractCity, buildQueries } from "./geo/name";
export { viewboxAround } from "./geo/viewbox";
export { stripCodeFence } from "./planner/fence";
export { generateSlug } from "./trips/slug";
export { sanitizeTripForPublic } from "./trips/sanitize";
export { parseStopTime, stopTimeSortKey } from "./time/parse";

export const CORE_VERSION = "0.2.0"; // bump
```

### Flags Bob Must Not Guess At

- **No DB / network / FastAPI / browser-only APIs** in `core`. Pure functions only. If a Python helper touches DB, do not port it.
- **Slug uses Web Crypto**, not Node-only `crypto.randomBytes`. Available globally in Node 20 + Capacitor WebView. Test under vitest (which runs Node).
- **Do not modify** any Python files. Step 11 deletes server duplicates once web is rewired.
- **Do not modify** the frontend `index.html`. Step 11 handles that.
- **TripDetail fields:** read `schemas.py` to capture exact shape. Match Pydantic field names exactly.
- **`buildQueries`** — read the Python carefully; it builds 3-4 alternative Nominatim query strings. Port the order exactly.
- **Bump `CORE_VERSION`** to `"0.2.0"` and update smoke test (or delete smoke test if it's redundant now).

### Verification Checklist

- [ ] `cd TourCompanion && npm test` exits 0 with ≥ 20 test cases passing
- [ ] `npm run typecheck` exits 0 with strict mode
- [ ] `npm run build` produces `packages/core/dist/` with `.d.ts` declarations for every exported symbol
- [ ] `find TourCompanion/packages/core/src -type f` matches the file layout above
- [ ] No `import` from `node:*` modules except where strictly needed (none should be needed for these pure helpers)
- [ ] No Python files modified
- [ ] No frontend files modified
- [ ] Existing FastAPI server still starts

---

Architect approval: [x] Pre-approved.
