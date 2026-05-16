# Review Request — Step 9 — Port Pure Helpers Python → TypeScript

**Ready for Review: YES**
**Builder:** Bob
**Date:** 2026-05-16
**Step:** 9 (Pure helpers ported into `@tourcompanion/core`; no Python/frontend changes)

---

## Summary

Ported all pure business helpers from the Python backend + KG-7 frontend parser into `packages/core/src/`. Strict TS, pure functions, snake_case wire types, camelCase exports, comprehensive vitest coverage. Public surface and `CORE_VERSION` bumped per brief. Web/server still use the Python originals — Step 11 rewires them.

---

## Files Added (11 new)

| Path | Lines | One-sentence rationale |
|------|-------|------------------------|
| `TourCompanion/packages/core/src/types/trip.ts` | 1–96 | TS interfaces mirroring Pydantic `StopOut`/`DayOut`/`BookingOut`/`CompanionDocOut`/`RouteAssetOut`/`StreetFoodOut`/`TripSummary`/`TripDetail` — snake_case fields, `\| null` for Optional. |
| `TourCompanion/packages/core/src/types/api.ts` | 1–26 | `IngestIn`/`IngestOut`/`CheckInIn`/`JournalIn`/`VoiceNoteIn` — request/response payload shapes. |
| `TourCompanion/packages/core/src/types/index.ts` | 1–2 | Re-exports all types. |
| `TourCompanion/packages/core/src/geo/haversine.ts` | 1–23 | `haversineKm(aLat, aLng, bLat, bLng): number` — direct port of Python `haversine_km`. |
| `TourCompanion/packages/core/src/geo/name.ts` | 1–55 | `cleanName`/`extractCity`/`buildQueries` — POI name normalization + Nominatim query candidate order preserved. |
| `TourCompanion/packages/core/src/geo/viewbox.ts` | 1–13 | `viewboxAround(lat,lng,delta)` → `[lonMin,latMin,lonMax,latMax]`; exported `Viewbox` tuple type. |
| `TourCompanion/packages/core/src/planner/fence.ts` | 1–15 | `stripCodeFence(text)` — unwraps ```json/``` fences with the same edge-case handling as the Python original. |
| `TourCompanion/packages/core/src/trips/slug.ts` | 1–27 | `generateSlug()` — Web Crypto `getRandomValues` → base64url → first 10 chars; matches Python `secrets.token_urlsafe(8)[:10]`. |
| `TourCompanion/packages/core/src/trips/sanitize.ts` | 1–28 | `sanitizeTripForPublic(detail)` — immutable copy that zeros IDs and drops journal/bookings/published_slug + per-stop note/check_in_count/photo_paths/voice_transcript. |
| `TourCompanion/packages/core/src/time/parse.ts` | 1–33 | `parseStopTime("HH:MM [+N]")` + `stopTimeSortKey(time)` — KG-7 parser; throws on malformed input. |
| `TourCompanion/packages/core/tests/geo/haversine.test.ts` | 1–28 | Identity, Berlin→Paris (≈878 km ±5), antipodal half-circumference, symmetry. |
| `TourCompanion/packages/core/tests/geo/name.test.ts` | 1–79 | cleanName paren/verb/suffix/unicode + extractCity postal + buildQueries order/dedupe/empty cases. |
| `TourCompanion/packages/core/tests/geo/viewbox.test.ts` | 1–22 | Bounds around (48.2,16.4)±0.1, zero-delta collapse, ordering invariant. |
| `TourCompanion/packages/core/tests/planner/fence.test.ts` | 1–30 | ```json fence unwrap, plain text passthrough, whitespace handling, inline-fence edge case. |
| `TourCompanion/packages/core/tests/trips/slug.test.ts` | 1–25 | Length 10, urlsafe alphabet, 1000-call no-collision. |
| `TourCompanion/packages/core/tests/trips/sanitize.test.ts` | 1–98 | Strips listed fields, leaves public fields intact, does not mutate input. |
| `TourCompanion/packages/core/tests/time/parse.test.ts` | 1–45 | Same-day, +N next-day, malformed throws, sort-key ordering (00:24+1 > 23:42). |

## Files Modified (3)

| Path | Lines | Change |
|------|-------|--------|
| `TourCompanion/packages/core/src/index.ts` | 1–13 | Replaced placeholder with full public surface per brief; `CORE_VERSION = "0.2.0"`. |
| `TourCompanion/packages/core/package.json` | 3 | Version bumped `0.1.0` → `0.2.0`. |
| `TourCompanion/packages/core/tests/smoke.test.ts` | 5–7 | Updated assertion to `"0.2.0"`. |

---

## Verification Checklist Results

| Check | Result |
|-------|--------|
| `cd TourCompanion && npm test` exits 0 with ≥ 20 test cases | PASS — 38/38 tests across 8 files |
| `cd TourCompanion && npm run typecheck` exits 0 (strict mode) | PASS |
| `cd TourCompanion && npm run build` produces `packages/core/dist/` with `.d.ts` per exported symbol | PASS — `.d.ts` emitted for every module (index, types/*, geo/*, planner/*, trips/*, time/*) |
| `find TourCompanion/packages/core/src -type f` matches brief layout | PASS — 11/11 source files exactly as specified |
| No `import` from `node:*` modules | PASS — grep returns zero matches |
| No Python files modified | PASS — `git diff --stat TourCompanion/server/` empty |
| No frontend files modified | PASS — `git diff --stat TourCompanion/server/frontend/` empty |
| Existing FastAPI server still starts | PASS — `from app.main import app` returns `IMPORT_OK` under venv with `SECRET_KEY` + `DATABASE_URL` + `UPLOAD_DIR` env |

---

## Decisions Made (Inside Builder's Authority)

1. **`Stop.highlights` and `Stop.food` typed as `unknown[]`** — Pydantic declares them as bare `list` with no inner type; preserved that shape rather than guessing (no `: list[str]` annotation in `schemas.py`). Consumers can refine when the schema tightens.
2. **`Stop.promo` typed as `Record<string, unknown> | null`** — Pydantic uses `dict | None`; chose the most permissive but well-formed shape.
3. **`start_date` / `end_date` typed as `string` (ISO date)** — Pydantic's `date` becomes a `YYYY-MM-DD` string at the JSON boundary; using `string` avoids forcing `Date` parsing in pure helpers.
4. **`parseStopTime` throws on malformed input** rather than returning `Infinity` like the frontend `toMinutes`. The frontend sort wraps the call in a permissive sentinel; the pure helper should signal bad input clearly. `stopTimeSortKey` is the building block the new sort caller will compose with whatever fallback they need.
5. **`sanitizeTripForPublic` does not mutate input** — Python mutates in place; the brief says "returning a new sanitized one", so the TS version is immutable via spread. Verified by a dedicated test.
6. **`Viewbox` exported as a readonly tuple type alias** alongside `viewboxAround` — gives consumers a typed handle for the 4-tuple without leaking implementation details.
7. **`CORE_VERSION` bumped to `0.2.0` in both `src/index.ts` and `package.json`** and the smoke test updated, per brief instruction.

---

## Open Questions

None.

---

## Escalate to Architect

None.

---

## Out of Scope (Not Touched)

- `TourCompanion/server/app/geocoder.py` / `planner.py` / `routes/trips.py` / `schemas.py` — untouched (Step 11 retires duplicates).
- `TourCompanion/server/frontend/index.html` — untouched (Step 11 swaps `toMinutes` to `stopTimeSortKey`).
- `TourCompanion/packages/ios/` and `TourCompanion/packages/web/` — still placeholder READMEs.
- Root `package.json`, `docker-compose.yml`, `CLAUDE.md` — untouched.
