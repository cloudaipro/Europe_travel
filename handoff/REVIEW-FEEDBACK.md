# Review Feedback — Step 9
Date: 2026-05-16
Ready for Builder: YES

## Must Fix

None.

## Should Fix

- `TourCompanion/packages/core/src/time/parse.ts:26-28` — `parseStopTime` throws on
  `hours > 23 || mins > 59` (e.g. `"99:99"`), but neither the Python source nor the
  frontend `toMinutes` (index.html ~1559) does any range check. The frontend regex
  `^(\d{1,2}):(\d{2})(?:\s*\+(\d+))?` happily matches `"99:99"` and returns
  `99*60+99 = 5999`. Bob's added range check is a behavior strictening the brief
  did not request. Low impact in practice (the UI never produces 99:99), but it
  diverges from the documented "port the KG-7 parser" mandate. Recommend either
  (a) drop the range check to preserve parity, or (b) note the deviation in
  BUILD-LOG as an intentional hardening. Not a blocker.

- `TourCompanion/packages/core/src/trips/slug.ts:8,23` — the `URLSAFE_RE` sanity
  check uses `/[A-Za-z0-9_-]+/` (unanchored), so any slug containing at least one
  urlsafe char would pass the guard even if it contained other characters.
  base64url output cannot produce such a slug, so this is defense-in-depth that
  is currently ineffective. Anchor it as `/^[A-Za-z0-9_-]+$/` if the guard is
  meant to actually validate. Not a blocker.

## Escalate to Architect

None.

## Cleared

Reviewed 11 new source files + 7 new test files + 3 modified files against
ARCHITECT-BRIEF Step 9.

Verification results (run from `TourCompanion/`):

- `npm test` — 38/38 tests pass across 8 files (>= 20 required).
- `npm run typecheck` — strict mode, exits 0.
- `npm run build` — `packages/core/dist/` produced with `.d.ts` for every module
  (index, types/{trip,api,index}, geo/{haversine,name,viewbox},
  planner/fence, trips/{slug,sanitize}, time/parse).
- `grep -r "node:" packages/core/src` — zero matches.
- `grep -r ": any\b\|as any\b" packages/core/src` — zero matches.
- `git diff --stat TourCompanion/server/` — empty. No Python files touched.
- `git diff --stat TourCompanion/server/frontend/` — empty. No frontend touched.

Behavioral parity spot-checks vs Python originals:

- `haversineKm` — formula matches `haversine_km` line-for-line; Berlin->Paris
  test asserts ~878km within +/-5.
- `cleanName` / `extractCity` / `buildQueries` — regexes and trailing-suffix
  list match `_PAREN_RE` / `_LEADING_VERB_RE` / `clean_name` / `extract_city` /
  `build_queries` exactly. **`buildQueries` order matches Python exactly:**
  `cleaned+city`, `cleaned`, `cleaned+address`, `address`, deduped first-seen.
  Confirmed via test `tests/geo/name.test.ts:54-65`.
- `viewboxAround` — returns `[lng-d, lat-d, lng+d, lat+d]` matching Python
  `_viewbox_around` 4-tuple ordering.
- `stripCodeFence` — handles `\n` split / fall-through and trailing-fence
  `rsplit` semantics matching `_strip_code_fence` (planner.py:91-98).
- `generateSlug` — 8 random bytes -> base64url -> first 10 chars, mirroring
  `secrets.token_urlsafe(8)[:10]`. Uses Web Crypto (`crypto.getRandomValues` +
  global `btoa`), no Node-only deps; works in Node 20, browsers, and Capacitor
  WebView. 1000-call no-collision test passes.
- `sanitizeTripForPublic` — drops exactly the fields the brief lists
  (`journal`, `bookings`, `published_slug`, plus per-stop `note` /
  `check_in_count` / `photo_paths` / `voice_transcript`); zeros trip / day /
  stop IDs; does not mutate input (verified by dedicated test). Decision #5
  per spec — brief says "returning a new sanitized one".
- `parseStopTime` / `stopTimeSortKey` — KG-7 invariant
  `"00:24 +1"` (1464) > `"23:42"` (1422) preserved (test parse.test.ts:32-37).

Type shape parity vs `schemas.py`:

- All field names preserved snake_case (`order_idx`, `time_label`, `date_label`,
  `start_date`, `end_date`, `published_slug`, `companion_docs`, `street_food`,
  `hotel_lat`, `hotel_lng`, `hotel_address`, `check_in_count`, `photo_paths`,
  `voice_transcript`, `price_band`, `price_huf`, `locality_score`, `photo_url`,
  `pdf_path`, `map_url`, `day_n`, `file_path`).
- `Optional[X]` -> `X | null` (not `| undefined`) — matches JSON wire format.
- Pydantic bare `list` -> `unknown[]` (decision #1); `dict | None` ->
  `Record<string, unknown> | null` (decision #2); `date` -> ISO `string`
  (decision #3). All reasonable boundary-type decisions; documented in
  REVIEW-REQUEST.
- `TripDetail` field set matches `schemas.py:128-150` exactly (21 fields incl.
  arrays).

Out-of-scope confirmed untouched: `server/app/geocoder.py`,
`server/app/planner.py`, `server/app/routes/trips.py`, `server/app/schemas.py`,
`server/frontend/index.html`, `packages/ios/`, `packages/web/`,
`docker-compose.yml`, `CLAUDE.md`.

`CORE_VERSION` consistent: `src/index.ts:12 = "0.2.0"`,
`package.json:3 = "0.2.0"`, `tests/smoke.test.ts` updated.

Step 9 is clear.
