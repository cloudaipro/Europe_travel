# Build Log
*Owned by Architect. Updated by Builder after each step.*

---

## Current Status

**Active step:** Step 11 — Web frontend uses `@tourcompanion/core` (esbuild bundle on `window.TC`) — awaiting review
**Last cleared:** Step 9 — Port Pure Helpers Python → TypeScript — 2026-05-16
**Pending deploy:** NO (committed locally; no remote configured)

---

## Step History

### Step 11 — Web frontend consumes `@tourcompanion/core` via esbuild IIFE bundle — Status: AWAITING REVIEW
*Date: 2026-05-16*

Scope: relocate the SPA from `server/frontend/` to `packages/web/public/`, add an esbuild step that bundles a curated slice of `@tourcompanion/core` into `public/core.bundle.js` as an IIFE on `window.TC`, point FastAPI's static mount at the new path, and prove end-to-end wiring with a single inline replacement: KG-7 `toMinutes` now delegates to `TC.stopTimeSortKey`. Server-side LLM (Python `planner.py`) untouched — web stays server-side-LLM.

Files changed:
- **Moved (git mv):** `TourCompanion/server/frontend/index.html` → `TourCompanion/packages/web/public/index.html`. Directory `server/frontend/` removed.
- **New:**
  - `TourCompanion/packages/web/package.json` — `@tourcompanion/web` workspace; depends on `@tourcompanion/core` (`*`) + `esbuild ^0.21` dev dep; `build`/`typecheck`/`test` scripts.
  - `TourCompanion/packages/web/build.mjs` — esbuild script: bundles `src/entry.ts` → `public/core.bundle.js` (IIFE, `globalName: TC`, target `es2020`, sourcemap on).
  - `TourCompanion/packages/web/src/entry.ts` — re-exports the curated core slice the SPA needs: `stopTimeSortKey`, `parseStopTime`, `cleanName`, `extractCity`, `buildQueries`, `haversineKm`, `viewboxAround`, `generateSlug`, `sanitizeTripForPublic`, `CORE_VERSION`.
  - `TourCompanion/packages/web/.gitignore` — ignores `public/core.bundle.js`, `public/core.bundle.js.map`, `node_modules/`, `dist/`.
  - `TourCompanion/packages/web/README.md` — overwrites the prior placeholder with build/serve instructions.
- **Edited:**
  - `TourCompanion/server/app/main.py` (line 79) — `frontend_dir` repointed to `parent.parent.parent / "packages" / "web" / "public"`. Only Python edit in this step (+3/−1).
  - `TourCompanion/server/run_local.sh` — added pre-uvicorn build hook: `(cd .. && npm install --silent && npm run build --workspace=@tourcompanion/web --silent)` guarded by `command -v npm` so the API still boots in minimal envs.
  - `TourCompanion/packages/web/public/index.html` line 7 — added `<script src="/core.bundle.js"></script>` immediately after `<title>`, before Tailwind. Lines 1559–1565 — replaced the 7-line inline `toMinutes` with the 3-line delegating version: `try { return TC.stopTimeSortKey(t); } catch { return Infinity; }`. **No other SPA edits.**

Decisions made (judgment calls beyond the brief):
- **Bundle the IIFE under `globalName: "TC"`** (concise namespace) as specified; verified the emitted file starts with `var TC = (() => { ... })()`.
- **`try/catch` preserves the legacy `Infinity`-on-bad-input contract** — callers in `applyAutoSortToDay` (line 1567) read `min: toMinutes(s.time)` and sort numerically; throwing would corrupt the sort. The catch is silent and total.
- **`run_local.sh` build step uses `--silent` + npm presence check** so non-Node deployments (e.g. CI building the wheel only) don't fail at boot — they just emit a one-line skip notice.
- **No symlink, no duplicate of `index.html`.** Old `server/frontend/` directory is fully removed; FastAPI serves the canonical copy from `packages/web/public/`.

Verification:
- `find TourCompanion/server/frontend` → "No such file or directory" (passes).
- `find TourCompanion/packages/web -type f -not -path '*/node_modules/*' -not -name 'core.bundle.js*'` → 6 expected files (passes).
- `npm install && npm run build` from `TourCompanion/` succeeds; emits `public/core.bundle.js` (5.3KB) + `.map` (10.3KB).
- `head -c 100 packages/web/public/core.bundle.js` shows `var TC = (() => { ... })`.
- `npm test` → 67/67 core tests pass; web/ios placeholders no-op.
- `npm run typecheck` → exit 0 across workspaces.
- Live server smoke (`PORT=8765 ./run_local.sh`):
  - `GET /` → 200, `text/html`, 157493 bytes (index.html, with `/core.bundle.js` script tag in head).
  - `GET /core.bundle.js` → 200, `text/javascript`, 5441 bytes, body starts `var TC = (() => {`.
- No other Python files modified (git diff confirms).

Out-of-scope (later phases):
- Further migration of inline JS in `index.html` to `@tourcompanion/core` (parseStopTime, cleanName, etc. are exposed on `TC` but no other call-sites switched in this step).
- iOS bundling — Step 15.

Reviewer findings: pending.

Deploy: not committed yet — awaiting Richard.

---

### Step 10 — LLM Provider Abstraction (Anthropic + OpenAI adapters) + plan ingest port — Status: AWAITING REVIEW
*Date: 2026-05-16*

Scope: add provider-agnostic LLM interface in `packages/core/src/llm/` (Anthropic + OpenAI raw-fetch adapters + Mock), port `SYSTEM_PROMPT`, user-message builder, parser, and `plan_trip` orchestration from `server/app/planner.py` into `packages/core/src/planner/`. Web frontend / iOS not wired (Steps 11 / 15). Python `planner.py` untouched.

Files changed:
- **New (8 source + 6 tests):**
  - `packages/core/src/llm/types.ts` — `LLMClient`, `LLMMessage`, `LLMOptions`, `LLMError`, `PlanParseError`.
  - `packages/core/src/llm/anthropic.ts` — `AnthropicClient` (raw `fetch` POST → `/v1/messages`, joins `content[].text` blocks, throws `LLMError` on non-200). Accepts `fetchImpl` for tests. Default model `claude-sonnet-4-6`.
  - `packages/core/src/llm/openai.ts` — `OpenAIClient` (raw `fetch` POST → `/v1/chat/completions`, merges system into messages, extracts `choices[0].message.content`). Default model `gpt-4o`.
  - `packages/core/src/llm/mock.ts` — `MockLLMClient` returns deterministic stub plan JSON (ports `_mock_plan`); parses user message to recover destination/days/style.
  - `packages/core/src/planner/types.ts` — `PlanInput`, `TripPlan`, `BookingPlan`, `DayPlan`, `StopPlan` (snake_case wire fields).
  - `packages/core/src/planner/prompt.ts` — `SYSTEM_PROMPT` (byte-for-byte copy of Python), `buildUserMessage(input)`.
  - `packages/core/src/planner/parse.ts` — `parsePlanResponse(rawText)` (strip fence + `JSON.parse`, throws `PlanParseError` with 500-char excerpt).
  - `packages/core/src/planner/plan.ts` — `planTrip(client, input)` (1..14 range guard → user msg → `client.complete` → parse → annotate `start_date`/`end_date`/`source_url`). Re-exports `SYSTEM_PROMPT`/`buildUserMessage`/`parsePlanResponse`.
  - Tests: `tests/llm/mock.test.ts` (3), `tests/llm/anthropic.test.ts` (6), `tests/llm/openai.test.ts` (5), `tests/planner/prompt.test.ts` (4), `tests/planner/parse.test.ts` (5), `tests/planner/plan.test.ts` (6).
- **Modified (3):**
  - `packages/core/src/index.ts` — added LLM + planner exports; bumped `CORE_VERSION` to `"0.3.0"`.
  - `packages/core/package.json` — version `0.2.0` → `0.3.0`.
  - `packages/core/tests/smoke.test.ts` — assertion bumped to `"0.3.0"`.

Key decisions:
- **No SDK dependency.** Both adapters use raw `fetch` and accept an optional `fetchImpl` so vitest can inject a vi.fn — verified by tests asserting URL/headers/body shape end-to-end.
- **`SYSTEM_PROMPT`** copied verbatim from Python as a template literal. The Python source uses `"""\` (suppressing leading newline) and ends with `\n`; the TS template literal matches that end-of-string behavior.
- **`buildUserMessage` matches Python byte-for-byte.** Verified by a prompt-test against a hand-computed expected string for both URL-present and URL-absent inputs.
- **Mock client parses the user message** rather than carrying side-channel state, so it works through the `LLMClient.complete` contract just like real adapters. The brief said "port `_mock_plan`" — the only way to get destination/days/style at `complete()` time without breaking the interface was to read them out of the user message produced by `buildUserMessage`. Lossless because the format is fixed.
- **Date math in `planTrip`** uses UTC (`Date.UTC(...)` + `86400000`-ms steps). Python `date.today()` is timezone-naive local; UTC is the lowest-surprise choice for a portable core. Aligned with how `start_date` is treated downstream as an ISO date string.
- **`planTrip` does not overwrite `start_date`/`end_date`/`source_url` if the model already supplied them** — mirrors Python's `plan.setdefault(...)`. Test pins this behavior.
- **`PlanParseError.excerpt`** is `text.slice(0, 500)` — matches Python's `text[:500]` log slice.
- **`StopPlan.highlights`/`food`** typed as `string[]` (not `unknown[]` like the existing `Stop` wire type) because the SYSTEM_PROMPT schema specifies bullet-string arrays; this is the producer side, not the consumer.

Verification:
- `cd TourCompanion && npm test` → **67/67** vitest tests across 14 files (38 from Step 9 + 29 new: mock 3, anthropic 6, openai 5, prompt 4, parse 5, plan 6). PASS.
- `npm run typecheck` → exits 0 under strict mode. PASS.
- `npm run build` → tsc emits `.d.ts` + `.js` + `.js.map` for every new symbol under `packages/core/dist/llm/` and `packages/core/dist/planner/` (anthropic.d.ts, openai.d.ts, mock.d.ts, types.d.ts, prompt.d.ts, parse.d.ts, plan.d.ts). PASS.
- `grep -r "anthropic@\|@anthropic-ai\|openai@" packages/core/package.json` → zero hits. PASS (no SDK deps).
- `git diff --stat -- TourCompanion/server/ TourCompanion/server/frontend/` → empty. PASS (Python + frontend untouched).
- FastAPI import smoke: `SECRET_KEY=test DATABASE_URL=sqlite:///tmp/test.db UPLOAD_DIR=/tmp/tc-uploads .venv/bin/python -c "from app.main import app"` → `IMPORT_OK`. PASS.

### Step 9 — Port Pure Helpers Python → TypeScript — Status: COMPLETE
*Date: 2026-05-16*

Scope: port all *pure* business helpers from `TourCompanion/server/app/{geocoder,planner,routes/trips}.py` and the KG-7 frontend +N parser into `TourCompanion/packages/core/src/`. TS interfaces for Pydantic schemas. Strict mode, full unit tests. Python and frontend left untouched — Step 11 will retire the duplicates.

Files changed:
- **New (11 source + 7 tests):**
  - `packages/core/src/types/trip.ts` — `Stop`/`Day`/`Booking`/`CompanionDoc`/`RouteAsset`/`StreetFood`/`TripSummary`/`TripDetail` interfaces, snake_case fields, `| null` for Pydantic Optionals.
  - `packages/core/src/types/api.ts` — `IngestIn`/`IngestOut`/`CheckInIn`/`JournalIn`/`VoiceNoteIn`.
  - `packages/core/src/types/index.ts` — type barrel.
  - `packages/core/src/geo/haversine.ts` — `haversineKm`.
  - `packages/core/src/geo/name.ts` — `cleanName` (paren + leading-verb + trailing-suffix), `extractCity`, `buildQueries` (4-candidate order preserved).
  - `packages/core/src/geo/viewbox.ts` — `viewboxAround` + exported `Viewbox` tuple type.
  - `packages/core/src/planner/fence.ts` — `stripCodeFence`.
  - `packages/core/src/trips/slug.ts` — `generateSlug` via Web Crypto `getRandomValues` → base64url → 10-char prefix.
  - `packages/core/src/trips/sanitize.ts` — `sanitizeTripForPublic` (immutable copy).
  - `packages/core/src/time/parse.ts` — `parseStopTime` + `stopTimeSortKey`.
  - Tests: `tests/geo/haversine.test.ts`, `tests/geo/name.test.ts`, `tests/geo/viewbox.test.ts`, `tests/planner/fence.test.ts`, `tests/trips/slug.test.ts`, `tests/trips/sanitize.test.ts`, `tests/time/parse.test.ts`.
- **Modified (3):**
  - `packages/core/src/index.ts` — replaced placeholder with the full public surface from the brief; `CORE_VERSION = "0.2.0"`.
  - `packages/core/package.json` — version `0.1.0` → `0.2.0`.
  - `packages/core/tests/smoke.test.ts` — assertion bumped to `"0.2.0"`.

Key decisions:
- `Stop.highlights` and `Stop.food` typed as `unknown[]` because Pydantic declares them as bare `list` with no inner type — preserved the openness rather than guessing a string element type.
- `Stop.promo` typed `Record<string, unknown> | null` to match Pydantic `dict | None`.
- `start_date` / `end_date` left as `string` (ISO date) — that's the wire form; pure helpers shouldn't force `Date` parsing.
- `parseStopTime` **throws** on malformed input rather than returning `Infinity` (which the frontend `toMinutes` used as a soft fallback). Pure helper should signal cleanly; the Step 11 caller composes any fallback.
- `sanitizeTripForPublic` returns a fresh object via spread (Python mutates in place, but the brief specifies "returning a new sanitized one"). Mutation guard test included.
- `Viewbox` exported as a readonly tuple type alias so consumers get a typed handle without leaking implementation details.

Verification:
- `cd TourCompanion && npm test` → 38/38 vitest tests across 8 files (haversine 4, name 13, viewbox 3, fence 6, slug 2, sanitize 3, parse 6, smoke 1). PASS.
- `npm run typecheck` → exits 0 under strict mode. PASS.
- `npm run build` → tsc emits `.d.ts` + `.js` + `.js.map` for every module under `packages/core/dist/`. PASS.
- File layout: `find TourCompanion/packages/core/src -type f` matches the brief's layout exactly (11 files). PASS.
- `grep -rn "from \"node:\|require(\"node:\|from 'node:" packages/core/src packages/core/tests` → zero hits. PASS.
- `git diff --stat -- TourCompanion/server/` → empty. PASS (no Python or frontend mods).
- FastAPI server import: `SECRET_KEY=test DATABASE_URL=sqlite:///tmp/test.db UPLOAD_DIR=/tmp/tc-uploads .venv/bin/python -c "from app.main import app"` → `IMPORT_OK`. PASS.

### Step 8 — Monorepo workspace skeleton — Status: COMPLETE
*Date: 2026-05-16*

Scope: introduce npm-workspaces monorepo layout under `TourCompanion/packages/` to set up the standalone-iOS initiative. No server/frontend code moved; no business logic ported.

Files changed (all new):
- `TourCompanion/package.json` — root workspaces manifest (`packages/*`); scripts `build`/`test`/`typecheck` fan out via `--workspaces --if-present`.
- `TourCompanion/tsconfig.base.json` — strict, ES2022, declaration + sourceMap, esModuleInterop, skipLibCheck. Extended by every package tsconfig.
- `TourCompanion/.gitignore` — `node_modules/`, `dist/`, `*.log`, `.DS_Store`, `coverage/`.
- `TourCompanion/package-lock.json` — committed (npm install resolved 80 packages).
- `TourCompanion/packages/core/package.json` — `@tourcompanion/core@0.1.0`, private, `type: module`, dev deps `typescript@^5`, `vitest@^1`, `@types/node@^20`.
- `TourCompanion/packages/core/tsconfig.json` — extends base, `rootDir: ./src`, `outDir: ./dist`.
- `TourCompanion/packages/core/src/index.ts` — sole export `CORE_VERSION = "0.1.0"`.
- `TourCompanion/packages/core/tests/smoke.test.ts` — vitest asserts `CORE_VERSION === "0.1.0"`.
- `TourCompanion/packages/core/README.md` — placeholder note, Node 20 LTS target.
- `TourCompanion/packages/ios/README.md` — placeholder, Capacitor scaffold in Step 12.
- `TourCompanion/packages/web/README.md` — placeholder, frontend moves in Step 11.

Key decisions:
- `@tourcompanion/core` set `"private": true` to avoid any accidental publish; brief did not specify, leaning safe.
- `"type": "module"` on core package so emitted ESM (`module: ES2022`) matches Node 20 ESM resolution. Test imports use `.js` suffix on a `.ts` source to satisfy strict `isolatedModules` + NodeNext-style consumers when core ships to ios/web later.
- Added `forceConsistentCasingInFileNames`, `resolveJsonModule`, `isolatedModules` to `tsconfig.base.json` (defaults for safe TS strict mode; not specified in brief but standard hygiene).
- Did **not** modify repo-root `.gitignore` or create a repo-root `package.json` — brief flag honored.

Verification:
- `find TourCompanion/packages -type f -not -path '*/node_modules/*' -not -path '*/dist/*'` lists exactly the 8 files from the brief. PASS.
- `cd TourCompanion && npm install` → 80 packages added, no errors. PASS.
- `npm run build` → tsc produced `packages/core/dist/index.js` (+ `.d.ts`, `.js.map`). PASS.
- `npm test` → 1/1 vitest test passing. PASS.
- `npm run typecheck` → exits 0. PASS.
- FastAPI server: `python -c "from app.main import app"` with env vars set → `IMPORT_OK`. Started `uvicorn app.main:app --port 8765` (forked); `curl /docs` returned HTTP 200 and alembic ran context impl; killed cleanly. Server runtime untouched. PASS.

### Step 7 — KG-8 rate limit + KG-9 real 404 — Status: COMPLETE
*Date: 2026-05-15*

Files changed:
- `app/config.py` — `rate_public: str = "60/minute"`.
- `app/routes/trips.py` — added `Request` import; added `limiter`/`settings` imports; decorated `get_public_trip` with `@limiter.limit(settings.rate_public)` and added `request: Request` param (slowapi requirement).
- `app/main.py` — `serve_public_spa` now takes `db` dependency and returns 404 when slug not found; added `Annotated`/`Depends`/`Session`/`get_db`/`Trip` imports.

Verification (live curl):
- `GET /p/hrm7ivghPU` → 200 (existing slug).
- `GET /p/nope` → 404 (invalid slug, no more SPA shell).
- `GET /api/public/trips/hrm7ivghPU` → 200.
- `GET /api/public/trips/nope` → 404.
- Burst test 70 requests in <1s: first 59 → 200, then 429 rate-limited. Limit 60/min per IP holds.

Deploy: committed locally 2026-05-15.

---

### Step 6 — KG-3b Publish flow — Status: COMPLETE
*Date: 2026-05-15*

Files changed:
- `app/models.py` — `Trip.published_slug` (String(20), nullable, unique, indexed).
- `app/schemas.py` — `TripDetail.published_slug` Optional[str].
- `alembic/versions/5b693a15c159_add_trip_published_slug.py` — migration with unique index.
- `app/routes/trips.py` — `POST /api/trips/{id}/publish` (idempotent, `secrets.token_urlsafe(8)[:10]` slug + 5-retry collision loop); `DELETE /api/trips/{id}/publish` (204); `_public_trip_to_detail()` helper strips sensitive fields + zeros internal ids.
- `app/routes/public.py` (or trips.py) — `public_router` `GET /api/public/trips/{slug}` no-auth route.
- `app/main.py` — `GET /p/{slug}` serves index.html before catch-all static mount.
- `frontend/index.html` — `PUBLIC_MODE`/`PUBLIC_SLUG` detection; `publicFetch()` no-auth helper; `bootPublic()` skips login; `body.is-public` CSS hides FAB cluster, day +/-, Auto-sort CTA, Publish pill, nav arrow, trip picker, logout, verify banner; `#publish-modal` reuses `.as-overlay`/`.as-card` styles; `openPublishModal`/`publishTrip`/`unpublishTrip`/`copyPublishUrl`/`closePublishModal` handlers; `TRIP_PUBLISHED_SLUG` set by `adaptTrip`.

Decisions:
- Slug: `secrets.token_urlsafe(8)[:10]` — ~60 bits entropy, 5-retry collision loop.
- Sanitization: drops `journal`, `bookings`, per-stop `note`/`check_in_count`/`photo_paths`/`voice_transcript`; also zeros `trip.id`/`day.id`/`stop.id` and nulls `published_slug` in response so internal ids don't leak.
- Route ordering: `/p/{slug}` registered BEFORE StaticFiles catch-all in main.py to win the match.
- Public-mode hide list expanded beyond brief: trip picker + logout + verify banner also hidden.

Reviewer findings:
- Bob's 4 curl verifications all pass (POST → slug; GET public no-auth → 200 sanitized; `/p/<slug>` → 200 HTML; DELETE → 204; subsequent GET → 404).
- Idempotent re-POST returns same slug; unauth POST → 401.
- Arch live sweep: Publish modal renders (Title "Publish trip", URL `http://127.0.0.1:8000/p/hrm7ivghPU`, Close/Copy/Unpublish buttons). Public viewer at `/p/hrm7ivghPU` loads in second tab without auth; `PUBLIC_MODE=true`, `body.is-public`, all edit controls `display:none`, `has_journal=false`, `has_bookings=0`, 10 days rendered.

Known limitations (logged as KGs):
- KG-8 — No rate limit on `/api/public/trips/{slug}` (low risk; slug entropy ~60 bits prevents enumeration).
- KG-9 — `/p/<invalid>` returns SPA shell with in-app 404 card rather than 404 HTTP status (acceptable UX; SPA renders error state).

Deploy: committed locally 2026-05-15.

---

### Step 5 — KG-3a Add-stop FAB + endpoint — Status: COMPLETE
*Date: 2026-05-15*

Files changed:
- `app/routes/trips.py` — +39 lines: `StopCreateIn` pydantic model + `POST /api/trips/{trip_id}/days/{day_n}/stops`. Lazy import `geocode_query`; best-effort `(0,0)` fallback if geocode fails or address empty.
- `frontend/index.html` — +93 lines: orange `+` FAB rewired; new `#add-stop-modal` overlay; `.as-*` CSS; `openAddStopModal`/`closeAddStopModal`/`submitAddStop` handlers; dedicated mobile-safe Esc listener.

Decisions:
- Own `#add-stop-modal` (separate namespace from the templated `#modal` system) — simpler than retrofitting `openModal(kind)`.
- `lat/lng = 0.0` on geocode miss, matching existing `_has_real_seed` convention; background geocoder may retry later.
- order_idx = `max(existing) + 1` (append).

Live verification:
- Modal opens via FAB tap, name required validation works.
- Submit "Belvedere Palace" with address "Prinz-Eugen-Strasse 27, 1030 Wien" geocoded successfully → lat=48.1912, lng=16.3798 (correct Vienna coords).
- Stop count incremented; UI refreshed; modal closed.
- 401/400/404 paths all verified via curl.

Deploy: committed locally 2026-05-15.

---

### Step 4 — KG-6 race + KG-7 +1 parser + KG-2 promo — Status: COMPLETE
*Date: 2026-05-15*

Files changed:
- `app/models.py` — `Stop.promo` JSON nullable column.
- `app/schemas.py` — `StopOut.promo` Optional[dict].
- `app/routes/trips.py` — `_stop_to_out` passes promo through.
- `app/seed.py` + `app/seed_data/vienna_budapest.py` — demo promo on Vienna Airport.
- `alembic/versions/8e2c011bf237_add_stop_promo.py` — new migration + idempotent op.execute seed.
- `frontend/index.html` — `esc()` helper, `.plan-promo-m` CSS + render, KG-6 try/finally on +/−, KG-7 "+N" regex parser, `adaptTrip` passes promo + URL scheme guard (https/http only).

Decisions:
- Promo shape: `{label, price, url}` JSON dict; nullable; mobile-only banner.
- KG-6: `try/finally` around button.disabled.
- KG-7: regex captures optional `\+(\d+)` for day offset; `dayOffset * 1440 + minutes` sort key.
- URL scheme guard: only `^https?://` allowed; otherwise href falls back to `#` (prevents `javascript:` XSS).

Reviewer findings:
- Richard hit usage limit mid-review; Arch self-reviewed inline.
- Arch checks: migration idempotent (WHERE promo IS NULL), downgrade drops column, `esc()` on all 3 promo fields, `target="_blank" rel="noopener"`, try/finally correct, regex anchored.
- Arch live sweep: API returns promo on stop 28 (Vienna Airport); after hard reload, promo banner renders with "DEAL Vienna eSIM (demo) €19 ›" in orange under Vienna Airport card.

Deploy: committed locally 2026-05-15.

---

### Step 3 — Wire Auto-sort + day add/remove (KG-3 partial close) — Status: COMPLETE
*Date: 2026-05-14*

Files changed:
- `TourCompanion/server/app/routes/trips.py` — +38 lines (`timedelta` import + `POST /api/trips/{trip_id}/days` `add_day` + `DELETE /api/trips/{trip_id}/days/{day_n}` `remove_day`). Reuses `_owned()`, `_trip_to_detail()`.
- `TourCompanion/server/frontend/index.html` — +65 lines (`refreshTrip()`, `autoSortCurrentDay()`, `addDay()`, `removeLastDay()` helpers; 3 onclick rewires; removed `disabled` + `title="Coming soon"` from Auto-sort CTA, `+`, `−`).

Decisions:
- Auto-sort is frontend-only — reuses existing `PUT /api/trips/days/{day_id}/stops/order` endpoint with stops re-sorted by `time_label` ascending.
- Day add: appends after last, `date_label = trip.start_date + (n-1) days` formatted `"%a %d %b"` (matches existing seed format), extends `trip.end_date` if needed.
- Day remove: only the last day, refuses if it's the only one. Cascade deletes stops via existing relationship. Pulls `trip.end_date` back by 1 day.
- Both new endpoints return full `TripDetail` for single-round-trip refresh.

Reviewer findings:
- Richard: CLEAR — 0 blockers, 1 should-fix (log race condition on `+` double-tap as KG-6). All 5 of Bob's judgment calls approved.
- Arch live sweep: add 10→11 days OK, remove 11→10 days OK, auto-sort verifiably re-orders stops (Day 1 demo data confirmed reordering after a manual mis-order). No console errors. Onclick handlers wired correctly. Discovered KG-7 (auto-sort parses "00:24 +1" as 24 min, sorting next-day timestamps to top).

Deploy: committed locally 2026-05-14.

---

### Step 2 — KG-1 mobile stop card redesign — Status: COMPLETE
*Date: 2026-05-14*

Files changed:
- `TourCompanion/server/frontend/index.html` — ~155 lines added (125 CSS mobile-scoped, 5 CSS hide rule ≥768px, 18-line `_catGlyph()` helper, ~25-line mobile card + transit row template inside `renderPlanDayContent`). Zero deletions. New CSS classes: `.plan-stop-card-m`, `.pscm-thumb`, `.pscm-badge`, `.pscm-info`, `.pscm-time-row`, `.pscm-cat-icon`, `.pscm-name`, `.pscm-duration`, `.pscm-nav-arrow`, `.plan-transit-row-m`, `.pttrm-icon`, `.pttrm-dur`, `.pttrm-chev`.

Decisions made:
- ALONGSIDE rendering: emit both `<details>` (desktop) and `.plan-stop-card-m` (mobile) per stop; CSS toggles visibility by viewport.
- Notes indicator pulls from `STATE.voice_notes[\`${n}-${i}\`]` + `STATE.stop_photos[\`${n}-${i}\`]` — same keys as Tour and Memory tabs.
- Duration fallback `"Stay 1h 00m"` literal (spec §3.5.1 names this format; stop data has no duration field).
- `.walk-connector` also hidden on mobile to prevent double-render alongside `.plan-transit-row-m`.
- `_catGlyph()` maps `_stopCategory()` output to spec §1.6 emoji; falls back to 🕒.
- Nav arrow uses `event.stopPropagation()` so card-body click doesn't double-fire.

Reviewer findings:
- Richard: CLEAR — 0 blockers, 0 should-fixes. All four of Bob's judgment calls approved.
- Arch live sweep: mobile cards render per spec at 390/500px; transit rows correct; tap card → flies map + snaps half; tap nav arrow → opens Google Maps in new tab; desktop 1280px shows only `<details>` (16/16 visible, 0/16 mobile-cards visible) — pixel-frozen.

Deploy: committed locally 2026-05-14.

---

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

- **KG-1** — Stop card in sheet uses existing `<details>` markup; spec §3.5.1 literal redesign deferred — logged 2026-05-14. **CLOSED 2026-05-14 (Step 2):** new `.plan-stop-card-m` markup added alongside `<details>`. Mobile shows new card (60×60 thumb + red shield badge + category-icon + time + name + duration + 36×36 nav arrow); transit row between consecutive stops. Desktop unchanged (16/16 details visible, 0/16 mobile cards visible at ≥768px).
- **KG-2** — Promo banner — logged 2026-05-14. **CLOSED 2026-05-15 (Step 4):** Stop.promo JSON field + Alembic migration + Pydantic + adaptTrip passthrough + mobile orange banner with URL scheme guard. Demo seeded on Vienna Airport.
- **KG-3** — Auto-sort + `+` FAB + Publish + day `+`/`−` stubs — logged 2026-05-14. **PARTIAL CLOSE 2026-05-14 (Step 3):** Auto-sort + day `+`/`−` wired. **CLOSED 2026-05-15 (Steps 5 + 6):** Add-stop FAB (modal + endpoint + geocode) and Publish flow (slug + public viewer + sanitization) shipped. All four stubs are real.
- **KG-8** — Rate limit on public route — logged 2026-05-15. **CLOSED 2026-05-15 (Step 7):** slowapi `@limiter.limit("60/minute")` on `get_public_trip`. Burst test confirms 429 after 59 requests.
- **KG-9** — `/p/<invalid-slug>` 404 — logged 2026-05-15. **CLOSED 2026-05-15 (Step 7):** `serve_public_spa` queries DB and raises 404 if slug not found.
- **KG-6** — Day +/- race — logged 2026-05-14. **CLOSED 2026-05-15 (Step 4):** try/finally disables button during request.
- **KG-7** — Auto-sort "+N" notation — logged 2026-05-14. **CLOSED 2026-05-15 (Step 4):** regex `/^(\d{1,2}):(\d{2})(?:\s*\+(\d+))?/` adds `dayOffset * 1440` to sort key.
- **KG-4** — Visual scratch test at 1280px done via diff-read only — logged 2026-05-14. **CLOSED 2026-05-14:** verified live at 1280×800 in claude-in-chrome during runtime sweep; desktop pixel-identical to baseline.

---

## Architecture Decisions
*Locked decisions that cannot be changed without breaking the system.*

- **Single-file constraint** — all UI in one `index.html`. Relocated 2026-05-16 (Step 11) from `TourCompanion/server/frontend/index.html` to `TourCompanion/packages/web/public/index.html`. The single-file invariant still holds; only the path changed.
- **Desktop ≥1024px is pixel-frozen** — any visual change at desktop is a regression — 2026-05-14.
- **Sheet snap state owned by CSS class on `.plan-sheet-shell`** (`sheet--peek/--half/--full`); JS only writes the class — 2026-05-14.
- **No new external libraries** — Tailwind CDN + Leaflet only — 2026-05-14.
