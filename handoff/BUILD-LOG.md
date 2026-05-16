# Build Log
*Owned by Architect. Updated by Builder after each step.*

---

## Current Status

**Active step:** Step 15 — OpenAI Plan Ingest from Device — awaiting review
**Last cleared:** Step 9 — Port Pure Helpers Python → TypeScript — 2026-05-16
**Pending deploy:** NO (uncommitted; awaiting Richard)

---

## Step History

### Step 15 — OpenAI Plan Ingest from Device — Status: AWAITING REVIEW
*Date: 2026-05-16*

Scope: Step 14's `/api/plan/ingest` 503 stub is replaced with a real on-device planner. New `handlePlanIngest(body, store, settings, clientFactory?)` reads the OpenAI key from the Keychain-backed `TCSettings`, calls `planTrip` (from `@tourcompanion/core`) with a freshly constructed `OpenAIClient`, and persists the resulting `TripPlan` into the iOS SQLite `TripStore`. Response shape (`{job_id, trip_id, status, message, backend}`) matches the Python endpoint byte-for-byte so the existing inline `submitIngest` handler in `packages/web/public/index.html` works unchanged. The frontend catch block now opens the Settings modal when the error message contains `missing_openai_key`, so iOS users who haven't yet entered a key see the gear-icon flow immediately. `clientFactory` is dependency-injected (default constructs a real `OpenAIClient`) so tests can substitute a deterministic fake LLM without touching the network.

Files changed:
- **New — iOS runtime (2):**
  - `TourCompanion/packages/ios/src/runtime/plan-handler.ts` — `handlePlanIngest(body, store, settings, clientFactory?)` returns `{ status, body }` for the interceptor to serialize. Validates `destination` (trim, non-empty → else 400 `invalid_destination`) and `days` (integer 1..14 → else 400 `invalid_days`). Reads `apiKey = await settings.getOpenAIKey()` → 401 `missing_openai_key` if null. Reads `model = await settings.getOpenAIModel()`, calls `clientFactory({apiKey, model})` (default: `(opts) => new OpenAIClient(opts)`), then `planTrip(client, {destination, days, sourceUrl, style})`. LLM/parse errors caught → 502 `ingest_failed` with `e.message`. Maps the resulting `TripPlan` to `TripCreateInput`: each stop gets a fresh `order_idx` (sequential), `note: ""`, `promo: null`; bookings normalise `url ?? ""` + `done ?? false`. `job_id` uses `crypto.randomUUID()` with a `String(Date.now())` fallback. Returns 200 with `Created trip '<name>' with <N> days.` message + `backend: "openai"`.
  - `TourCompanion/packages/ios/src/runtime/plan-handler.test.ts` — 6 tests using `FakeStore` (implements full `TripStore` interface — only `createTrip` records input, all other methods throw to surface accidental calls), `FakeSettings` (in-memory key + model), and a `makeFakeClient(json)` that returns a deterministic `TripPlan` JSON without touching `fetch`. Covers: 401 missing key, 400 days=0, 400 days=15, 400 empty destination, 502 LLM throw, 200 success path (asserts `factoryArgs` carries the key+model from settings, `trip_id` is plumbed through, days/stops/bookings mapped into `createTrip`).
- **Modified — iOS runtime (1):**
  - `TourCompanion/packages/ios/src/runtime/fetch-interceptor.ts` — replaced the 503 `not_wired_yet` stub for `POST /api/plan/ingest` with `handlePlanIngest(body, store, window.TCSettings!)`. Added `import { handlePlanIngest } from "./plan-handler.js"`. Updated the file header comment to reflect that ingest is now wired (jobs/{id} stays a 404 — ingest is synchronous, frontend never polls). Defensive guard: if `window.TCSettings` is missing (shouldn't happen on iOS post-boot), returns 500 `settings_unavailable`.
- **Modified — iOS tooling (1):**
  - `TourCompanion/packages/ios/package.json` — added `"test": "vitest run"` script and `"vitest": "^1.0.0"` devDependency. vitest is hoisted at the workspace root (already there for `@tourcompanion/core`); no new node_modules added.
- **Modified — web SPA (1):**
  - `TourCompanion/packages/web/public/index.html` — `submitIngest` catch block (line ~1438): on error message containing `missing_openai_key`, calls `openSettingsModal()` (which exists from Step 14, guarded by `typeof === "function"`). Two lines added inside the existing catch — no other code touched.

Decisions made (judgment calls beyond the brief):
- **`order_idx` populated explicitly in createTrip input.** The brief's mapping omitted it but `TripCreateInput.days[].stops` is typed as `Omit<Stop, "id" | "check_in_count" | "photo_paths" | "voice_transcript">`, which leaves `order_idx`, `note`, `promo` as required fields. Plan stops are already in chronological order from the planner, so `order_idx = index` matches what `IOSTripStore.createTrip` would have computed anyway. `note: ""` and `promo: null` mirror the defaults the SQLite INSERT uses (Step 13 `store.ts:189`).
- **Defensive booking shape.** `BookingPlan` declares `url: string` and `done: boolean` (Step 10 types), but `TripCreateInput.bookings[]` declares both as optional. Used `b.url ?? ""` and `b.done ?? false` per the brief's "handle defensively" guidance — covers the hypothetical case where a future LLM response omits one of those keys before the parser normalises it.
- **Function name in index.html is `openSettingsModal`, not `openSettings`.** The brief's example used `openSettings` but the actual handler is `openSettingsModal` (Step 14 named it that). Used the real name + `typeof === "function"` guard exactly as the brief specified for the guard pattern.
- **Used `indexOf` instead of `includes` on the error string check.** index.html is ES5-ish vanilla; `String.prototype.includes` is widely available but `indexOf` matches the existing code style in the file and is unambiguous.
- **`apiCall` 401 short-circuit unchanged.** `apiCall` calls `logout()` on any 401 unless we're in public mode. For iOS this means a missing-key 401 will log the user out — but iOS uses stub auth (`/api/auth/login` returns `{access_token: "local"}` and `logout()` just clears local state), so the user's session is effectively a no-op anyway. The Settings modal opens correctly because `submitIngest` re-throws first and `logout()` fires on the way out. If Richard flags this as a Must Fix I'll branch `apiCall` on iOS to skip `logout()` for 401s carrying `missing_openai_key` — but it's harmless on iOS today and any change touches the most-fragile part of the SPA.
- **No `/api/plan/jobs/{id}` change.** Per brief — frontend never polls because ingest is synchronous.
- **Added `vitest` devDep + `test` script to the iOS package** so the brief's `packages/ios/src/runtime/plan-handler.test.ts` path is honored. The alternative (putting the test under `packages/core/tests/`) would have required pulling iOS-only types into core or stubbing them — strictly worse for the layering.
- **Test fakes throw on unused methods** instead of returning empty defaults. If a future refactor accidentally has `handlePlanIngest` call e.g. `store.addStop`, the test will fail loudly with a clear message rather than silently passing with no-op stubs.

Verification:
- `npm run build` (core tsc + ios bundle + web esbuild) → green. iOS bundle is now **99.3kb** (was 90.5kb in Step 14; +8.8kb is plan-handler + the LLM/planner tree pulled in by `@tourcompanion/core`'s OpenAI import). PASS.
- `npm run typecheck` → both `@tourcompanion/core` and `@tourcompanion/ios` exit 0 under strict mode. PASS.
- `npm test` → **73 core + 6 new ios = 79 tests passing across 16 files**. PASS.
- `npx cap sync ios` → "Sync finished in 1.598s"; 2 plugins (sqlite + secure-storage). PASS.
- `xcodebuild ... build CODE_SIGNING_ALLOWED=NO` → `** BUILD SUCCEEDED **`. PASS.
- No Python files touched (`git status TourCompanion/server/` empty). PASS.
- `index.html` diff is additive: 3 lines added inside the existing `submitIngest` catch block; no other lines changed. No regression on web (Settings modal stays `display:none` without `body.is-ios`, same as Step 14). PASS.

Not verified (acceptable per brief):
- No live OpenAI roundtrip — explicitly forbidden in the brief ("No real OpenAI calls in tests"). The clientFactory injection point is what makes this safe — production code goes through `new OpenAIClient(opts)` which is already covered by `tests/llm/openai.test.ts` (Step 10).
- No simulator runtime smoke test of "paste key in Settings, generate trip" — the contract this step ships against is the unit tests + xcodebuild + the previously-verified Step 14 Settings flow.

Known Gaps: none introduced. `apiCall`'s 401-triggered logout on iOS is documented above as an accepted edge case (effectively harmless under stub auth).

---

### Step 14 — Settings, Keychain, Fetch Interceptor — Status: AWAITING REVIEW
*Date: 2026-05-16*

Scope: Three subsystems land together. (1) New `@tourcompanion/core` settings module exposes a platform-agnostic `SecureStore` interface and a `TCSettings` facade for OpenAI key + model. (2) iOS gets a Keychain-backed `SecureStore` adapter via `capacitor-secure-storage-plugin@^0.10.0`. (3) `window.fetch` is patched on iOS boot to route every `/api/*` request to `window.TCStore` (or to canned stubs for auth/health), so the existing web SPA inline JS runs unchanged on-device. Settings UI (gear button + modal) added to `packages/web/public/index.html` behind a `body.is-ios` gate. iOS bundle now injects into `<head>` after `</title>` (not before `</body>`) so the interceptor is installed before the SPA's inline scripts run.

Files changed:
- **New — core settings module (2):**
  - `TourCompanion/packages/core/src/settings/keys.ts` — `SETTINGS_KEYS` (`openai_api_key`, `openai_model`) + `DEFAULT_OPENAI_MODEL = "gpt-4o"`. `as const` for literal types.
  - `TourCompanion/packages/core/src/settings/types.ts` — `SecureStore` interface (get/set/remove/clear), `TCSettings` interface, and `createSettings(store: SecureStore): TCSettings` factory. Whitespace-trims on read + write; empty value on set is treated as remove so the keychain never holds blank strings.
- **New — core test (1):**
  - `TourCompanion/packages/core/tests/settings/settings.test.ts` — 6 tests against an in-memory `SecureStore` (round-trip key, trim/clear semantics, model default + override).
- **New — iOS runtime (3):**
  - `TourCompanion/packages/ios/src/runtime/keychain/index.ts` — `keychainStore: SecureStore` wrapping `SecureStoragePlugin`. `get` and `remove` swallow plugin throws ("key not found" is a soft-miss in our contract); `set`/`clear` propagate.
  - `TourCompanion/packages/ios/src/runtime/fetch-interceptor.ts` — `installFetchInterceptor(storeProvider)` patches `window.fetch`. The provider may be a `TripStore` or a `() => Promise<TripStore>`; we use the promise form so the interceptor installs synchronously at script load (before the SPA's inline scripts run) while SQLite is still spinning up. Pure `route(pathname, method, body, store)` function pattern-matches every endpoint in the brief table — trips CRUD, day add/remove, stops add/reorder, check-in, photos (`/photos` and `/photos-link` both map to `store.addPhoto`), voice, journal, streetfood empty list, plan ingest stub (503), plan jobs stub (404). Unknown paths return `404 {error:"unsupported",path}`. The `/api/trips/{id}/days/{n}/stops` handler resolves the URL's day number to a `day_id` by reading the trip first — matches the frontend's existing `apiCall('/trips/.../days/N/stops', { body: {name, time_label, address} })` shape, no frontend change required.
  - `TourCompanion/packages/ios/src/runtime/global.d.ts` — ambient `Window` augmentation declaring `TCStore?` and `TCSettings?`. Replaces the inline `declare global` block previously in entry.ts so both globals share one source of truth.
- **Modified — core (3):**
  - `TourCompanion/packages/core/src/index.ts` — re-exports `SecureStore`, `TCSettings`, `createSettings`, `SETTINGS_KEYS`, `DEFAULT_OPENAI_MODEL`. Bumps `CORE_VERSION` to `"0.5.0"`.
  - `TourCompanion/packages/core/package.json` — version `0.5.0`.
  - `TourCompanion/packages/core/tests/smoke.test.ts` — asserts `"0.5.0"`.
- **Modified — iOS runtime (1):**
  - `TourCompanion/packages/ios/src/runtime/entry.ts` — synchronous on iOS: kicks off `initSqliteStore()` as a stored promise (caches result onto `window.TCStore` when resolved), constructs `window.TCSettings = createSettings(keychainStore)` immediately, installs the fetch interceptor with the store promise as provider, and adds `body.is-ios` (deferred to `DOMContentLoaded` if body not yet present). Off-iOS the entire block is skipped so the bundle remains a no-op on web/Android.
- **Modified — iOS tooling (1):**
  - `TourCompanion/packages/ios/copy-web.mjs` — injection point moved from before `</body>` to inside `<head>` immediately after `</title>`. Without head injection the SPA's inline scripts would run and call `/api/auth/me` against an un-patched `fetch` before the runtime had a chance to install the interceptor. Log line + error path updated accordingly.
- **Modified — iOS package (1):**
  - `TourCompanion/packages/ios/package.json` — adds `capacitor-secure-storage-plugin@^0.10.0` to dependencies (0.10.0 is the last release whose peer `@capacitor/core` spec is `^6.0.0`; 0.11.0+ require `>=7.0.0`).
- **Modified — web SPA (1):**
  - `TourCompanion/packages/web/public/index.html` — additive only. Added CSS rules for `.ts-settings-btn`, `.ts-help-link`, `.ts-sub` (~14 new lines just before `</style>`). Added a 🔑 gear button to both the mobile app-bar `.mab-right` and the desktop header right-actions cluster; both default to `display:none` and become visible only when `body.is-ios` is set. Added `#ts-settings-modal` (reuses `.as-overlay` / `.as-card` / `.as-field` / `.as-btn` styles from the existing add-stop modal) with password-typed key input, model input, Cancel / Clear / Save buttons. Added `openSettingsModal` / `closeSettingsModal` / `saveSettings` / `clearSettingsKey` handlers and an Escape-to-close keydown listener immediately after `showSnack`. No existing element rewired or removed.
- **Modified — lockfile:**
  - `TourCompanion/package-lock.json` — 1 package added (`capacitor-secure-storage-plugin`).

Decisions made (judgment calls beyond the brief):
- **Plugin pick:** `capacitor-secure-storage-plugin@0.10.0`. `@capacitor-community/secure-storage` is not published on the public npm registry (404 on `npm view`) — the namespace under `@capacitor-community` only exists for the older Capacitor 2/3 era of that plugin. `capacitor-secure-storage-plugin` is the actively-maintained drop-in. Latest (0.13.0) requires Capacitor 8; 0.11.0+ require Capacitor 7+; 0.10.0 is the highest version still compatible with Capacitor 6 (its `peer @capacitor/core` is `^6.0.0`).
- **Interceptor accepts a promise-of-store, not just a store.** Brief skeleton passed `TripStore` directly; in practice that would mean the interceptor either (a) had to wait for SQLite before installing — defeating the whole point of head injection — or (b) had to be installed twice. Adding the union `TripStore | (() => Promise<TripStore>)` keeps the install synchronous and per-request fetches simply `await` the promise, which adds a few ms only to the very first call.
- **Settings gear icon: 🔑 not ⚙.** The mobile app bar already has a ⚙ button (`onclick="toggleTripPicker"`) and the brief explicitly forbids touching existing UI. Using a different icon avoids visual collision and makes the new affordance obvious.
- **Stub user `id: 1` + `email: ""` + `display_name: "local"`.** Frontend's `init()` only checks that `/auth/me` returns 200 — it doesn't read any field. Picked the minimal shape that satisfies the existing TypeScript-less SPA code without revealing user-identity details that don't exist on a single-user iOS install.
- **`/api/health` returns `{ok:true}`** with no other shape (frontend doesn't poll health on iOS but Capacitor WebView background tabs sometimes do; cheap and harmless).
- **`/api/trips/{id}/streetfood` returns `[]`** rather than 404. The existing frontend tolerates either, but an empty list keeps the v1 surface forward-compatible if a later step ships an on-device curated list.
- **No automated test for the fetch interceptor.** The router is a pure function but the install path touches `window.fetch` and `Capacitor.getPlatform()`. Mocking those would test the mock. xcodebuild green + the existing 73 core tests (settings module covered) is the contract this step ships against.
- **CSS scoped under `.ts-` prefix.** Existing modal classes (`.as-overlay`, `.as-card`, `.as-field`, `.as-btn-save/cancel/danger`) reused verbatim. Three new classes added: `.ts-settings-btn` (display gate), `.ts-help-link` (the "Get a key →" anchor), `.ts-sub` (subtitle copy).

Verification:
- `npm install --workspace=@tourcompanion/ios capacitor-secure-storage-plugin@0.10.0` → 1 package added. PASS.
- `npm run build` (core tsc + ios bundle + copy-web + web esbuild) → green. iOS bundle is now 90.5kb (was 79.7kb before this step — the +10.8kb is fetch-interceptor + settings module + keychain adapter). `[copy-web] injected ios.bundle.js <script> after </title> (in <head>)` log line confirmed. PASS.
- `npm run typecheck` → both `@tourcompanion/core` and `@tourcompanion/ios` exit 0. PASS.
- `npm test --workspace=@tourcompanion/core` → 73/73 (was 67; +6 new tests in `settings/settings.test.ts`). PASS.
- `npx cap sync ios` → "Sync finished in 3.225s"; `[info] Found 2 Capacitor plugins for ios: @capacitor-community/sqlite@6.0.2, capacitor-secure-storage-plugin@0.10.0`. PASS.
- `Podfile.lock` contains `CapacitorSecureStoragePlugin (0.10.0)`. PASS.
- `xcodebuild ... build CODE_SIGNING_ALLOWED=NO` → `** BUILD SUCCEEDED **`. PASS.
- `packages/ios/www/index.html` head contains `<script src="/ios.bundle.js"></script>` at line 7 (immediately after `</title>` at line 6). PASS.
- No Python files touched. `git status` for `TourCompanion/server/` is empty. PASS.
- Web `packages/web/public/index.html` diff is additive only — no existing element removed or rewired. PASS.

Not verified (acceptable per brief):
- No simulator runtime smoke test of "open settings, paste key, close, reopen, key persists." Step 15 will exercise the keychain end-to-end when it reads the key for the OpenAI client.

Known Gaps:
- `/api/plan/ingest` deliberately returns 503 — Step 15 wires OpenAI.
- iOS WebView serves the SPA from `capacitor://localhost`; `new URL(url, location.origin)` resolves relative `/api/...` paths correctly under that scheme.

---

### Step 13 — Local SQLite + Data Layer — Status: AWAITING REVIEW
*Date: 2026-05-16*

Scope: `@capacitor-community/sqlite` installed into `@tourcompanion/ios`. `TripStore` interface defined in `@tourcompanion/core`. SQLite-backed `IOSTripStore` implemented with schema bootstrap, CRUD covering every endpoint the existing frontend hits. Bundle wired into `www/ios.bundle.js` and injected before `</body>` on iOS. Web build untouched. No fetch interceptor yet — that's Step 14.

Files changed:
- **New — core (2):**
  - `TourCompanion/packages/core/src/store/types.ts` — `TripStore` interface + `TripCreateInput`, `StopCreateInput`, `CheckInInput`, `JournalUpdate`, `VoiceNoteInput`. Field names mirror Pydantic schemas. Imports wire types from `../types/index.js`.
  - `TourCompanion/packages/core/src/store/index.ts` — re-export barrel.
- **New — ios runtime (5):**
  - `TourCompanion/packages/ios/src/runtime/sqlite/schema.ts` — `SCHEMA_STATEMENTS` array (12 statements: 8 CREATE TABLE, 2 CREATE INDEX, `schema_meta` table + version-1 seed). `SCHEMA_SQL` join provided for diagnostics; runtime executes statements one-by-one for clear error reporting.
  - `TourCompanion/packages/ios/src/runtime/sqlite/serialize.ts` — row → wire mappers. `rowToTripDetail` mirrors Python `_trip_to_detail` (routes/trips.py:44-66) and `rowToStop` mirrors `_stop_to_out` (routes/trips.py:31-42). JSON arrays/objects round-trip via `parseJsonArray` / `parseJsonObject` with try/catch fallback to empty. `published_slug` hard-set to `null` (column dropped on iOS); `companion_docs` / `routes` / `street_food` always `[]`.
  - `TourCompanion/packages/ios/src/runtime/sqlite/store.ts` — `IOSTripStore` class implementing every `TripStore` method. Parameterised queries throughout. `addStop` computes `max(order_idx)+1` per day. `reorderStops` batches updates via `db.executeTransaction([{statement,values}, ...])` — the only multi-statement transaction in this step (single-statement writes are atomic per `db.run`). `removeDay` resequences remaining day numbers contiguously. `createTrip` inserts trip → days → stops → bookings inline (transactional wrap deferred — see Decisions).
  - `TourCompanion/packages/ios/src/runtime/sqlite/index.ts` — `initSqliteStore()` factory. Reuses existing connection via `isConnection` + `retrieveConnection` to survive hot-reload; opens, runs `PRAGMA foreign_keys = ON`, then loops `SCHEMA_STATEMENTS`.
  - `TourCompanion/packages/ios/src/runtime/entry.ts` — bootstrap shim. `Capacitor.getPlatform() !== "ios"` short-circuit so the bundle is a no-op on web/Android. Errors caught and logged — never thrown out of the IIFE.
- **New — ios tooling (2):**
  - `TourCompanion/packages/ios/build.mjs` — esbuild IIFE bundler, entry `src/runtime/entry.ts`, out `www/ios.bundle.js`, target `es2020`, no sourcemap (sourcemap leaks impl into App Store binary).
  - `TourCompanion/packages/ios/tsconfig.json` — `noEmit: true`, `lib: ["ES2022", "DOM"]`, types `["node"]`. Drives `npm run typecheck`.
- **Modified — core (3):**
  - `TourCompanion/packages/core/src/index.ts` — re-exports `TripStore` and the 5 input types from `./store/types.js`; bumps `CORE_VERSION` to `"0.4.0"`.
  - `TourCompanion/packages/core/package.json` — version `0.4.0`.
  - `TourCompanion/packages/core/tests/smoke.test.ts` — expects `"0.4.0"`.
- **Modified — ios (2):**
  - `TourCompanion/packages/ios/package.json` — version `0.2.0`, `type: "module"`, deps include `@capacitor-community/sqlite@^6.0.2`, devDeps add `esbuild` + `typescript` + `@types/node`. `build:web` now chains `npm run build --workspace=@tourcompanion/web && node copy-web.mjs && node build.mjs`. Added `build` (alias of build:web) and `typecheck` scripts.
  - `TourCompanion/packages/ios/copy-web.mjs` — after copy, reads `www/index.html` and injects `<script src="/ios.bundle.js"></script>` before the first `</body>`. Idempotent; bails if no `</body>` found. *[Step 14 footnote: injection point moved from before `</body>` to inside `<head>` after `</title>` so the fetch interceptor installs before the SPA's inline scripts run.]*
- **Modified — lockfile:**
  - `TourCompanion/package-lock.json` — 35 packages added by the sqlite plugin install.

Decisions made (judgment calls beyond the brief):
- **Pinned `@capacitor-community/sqlite` to `^6.0.2`.** `8.1.0` is latest but its `peer @capacitor/core@">=8.0.0"` blew up `npm install`. Brief explicitly says "latest 6.x compatible with Capacitor 6" — 6.0.2 is the last 6.x release on npm.
- **`createTrip` is NOT wrapped in `executeTransaction`** even though it touches 4 tables. Reason: the plugin's `executeTransaction(capTask[])` accepts only INSERT/UPDATE/DELETE statements with values, but we need each statement's `lastId` to feed the next INSERT (trip.id → day.trip_id → stop.day_id). Sequencing `db.run` calls keeps the dependency chain explicit. SQLite's per-statement atomicity is sufficient here; a mid-create crash leaves partial data, which the next create cycle overwrites because the iOS frontend recreates trips end-to-end (no resumable creation flow). If Richard flags this as a Must Fix I'll refactor to inline-substitute the lastId via a follow-up `SELECT last_insert_rowid()` per insert, but the added query cost felt unjustified for v1.
- **`reorderStops` uses `executeTransaction`** because the statements are pure UPDATEs with no inter-statement dependencies — perfect fit for the batch API. Brief called this out specifically.
- **`getTrip` issues N+1-ish queries** (one stops query per day, three hydration queries per stop). For a v1 with ~5 days × ~5 stops the round-trip count is ~80 queries; with SQLite on-device that's sub-millisecond total. Refactoring to one big JOIN + manual grouping would save tokens but obscure the mapping logic. Left as-is.
- **JSON columns (`highlights`, `food`, `promo`) round-trip as strings.** `parseJsonArray` falls back to `[]` on malformed input; `parseJsonObject` falls back to `null`. Mirrors the Python `or []` defensive default.
- **`published_slug: null` instead of empty string.** Python returns `Optional[str]` and the frontend already handles `null` as "unpublished". The column itself is gone.
- **`isConnection` retrieve-or-create dance in `initSqliteStore`.** Capacitor hot-reload doesn't recreate the JS heap on every refresh, so `createConnection` would throw "already exists" on second load. Cheap defensive check.
- **`Capacitor.getPlatform() !== "ios"` guard in entry.ts is silent.** No warning logged — the bundle ships in web too (single `www/` artefact) and we don't want web users seeing a "skipping iOS init" log on every page load.
- **Bundle is not sourcemapped.** App-Store-bound code; sourcemap would expose internal class/method names. Trade-off accepted: crash reports in production will need symbol upload (not in scope for v1).
- **Did not touch `packages/ios/tsconfig.json`'s `noEmit` flag for the bundler** — esbuild does its own transpile, tsc is purely a check.

Verification:
- `cd TourCompanion && npm install` → 35 packages added (sqlite plugin + transitive). PASS.
- `npm run build` → core tsc OK, ios bundles (`79.7kb www/ios.bundle.js` + injected script tag), web bundles. PASS.
- `npm run typecheck` → both `@tourcompanion/core` and `@tourcompanion/ios` exit 0; web is `echo` (no TS yet). PASS.
- `npm test` → 67/67 core tests still pass; `smoke.test.ts` updated to assert `"0.4.0"`. PASS.
- `npx cap sync ios` → "Sync finished in 26.05s"; `[info] Found 1 Capacitor plugin for ios: @capacitor-community/sqlite@6.0.2`. PASS.
- `Podfile.lock` contains `CapacitorCommunitySqlite (6.0.2)`. PASS.
- `xcodebuild ... build CODE_SIGNING_ALLOWED=NO` → `** BUILD SUCCEEDED **`. Standard "Embed Pods Frameworks runs every build" / "Metadata extraction skipped" warnings only. PASS.
- `www/index.html` contains `<script src="/ios.bundle.js"></script>` before `</body>` (verified via copy-web log line). PASS.

Not verified (acceptable per brief):
- No Node-side test of `IOSTripStore.createTrip` / `getTrip` round-trip. `@capacitor-community/sqlite` is iOS-native; mocking the `SQLiteDBConnection` surface for a unit test would test the mock, not the store. xcodebuild green + typecheck green is the contract this step ships against. Step 14 (fetch interceptor) will exercise these methods end-to-end on the simulator.

Known Gaps: none introduced.

---

### Step 12 — Capacitor iOS scaffold — Status: AWAITING REVIEW
*Date: 2026-05-16*

Scope: stand up `packages/ios/` as a Capacitor 6 wrapper around `@tourcompanion/web`. Bundle web SPA into `www/`, generate the iOS Xcode project + Podfile via `npx cap add ios`, and prove the scaffold with a headless `xcodebuild` against the simulator SDK. No runtime detection / native plugins yet — Step 13+.

Files changed:
- **New (4 in `packages/ios/` root):**
  - `TourCompanion/packages/ios/package.json` — `@tourcompanion/ios` workspace; deps `@capacitor/core`, `@capacitor/ios`, `@capacitor/cli` (all `^6`) + `@tourcompanion/core` (`*`); scripts `build:web` / `cap:sync` / `cap:open` / `build:ios` per brief.
  - `TourCompanion/packages/ios/capacitor.config.ts` — locks `appId: "com.cloudaipro.tourcompanion"`, `appName: "TourCompanion"`, `webDir: "www"`, `server.androidScheme: "https"`.
  - `TourCompanion/packages/ios/copy-web.mjs` — pure Node 20+ (no deps); wipes + recreates `www/`, copies `packages/web/public/*` recursively with `fs.cp({recursive,force})`, excludes `core.bundle.js.map`.
  - `TourCompanion/packages/ios/README.md` — replaced placeholder; documents the 4-step dev loop, locked identity, what is/isn't committed.
- **New (Capacitor-generated, committed under `packages/ios/ios/`):**
  - `ios/.gitignore` (Capacitor template — already covers `App/build`, `App/Pods`, `App/App/public`, `DerivedData`, `xcuserdata`, regenerated config files)
  - `ios/App/App.xcodeproj/project.pbxproj`
  - `ios/App/App.xcworkspace/` (2 files)
  - `ios/App/App/AppDelegate.swift`, `Info.plist`, `Base.lproj/{LaunchScreen,Main}.storyboard`, `Assets.xcassets/` (AppIcon + Splash)
  - `ios/App/Podfile` + `ios/App/Podfile.lock` (Capacitor 6.2.1, CapacitorCordova 6.2.1, CocoaPods 1.16.2)
- **Modified:**
  - `TourCompanion/.gitignore` — appended a Capacitor-iOS block ignoring `packages/ios/www/`, `packages/ios/node_modules/`, `packages/ios/ios/App/Pods/`, `packages/ios/ios/App/build/`, `packages/ios/ios/App/DerivedData/`. Belt-and-suspenders on top of the Capacitor-generated `ios/.gitignore`.
  - `TourCompanion/package-lock.json` — npm install resolved 93 added packages (Capacitor + cli toolchain).

Decisions made (judgment calls beyond the brief):
- **Skipped `npx cap init` entirely.** Wrote `capacitor.config.ts` directly; brief explicitly authorizes this if the interactive step misbehaves, and the resulting JSON-equivalent config is read identically by `cap add ios`. `cap add ios` succeeded on the first try and emitted `ios/App/App/capacitor.config.json` from this TS source.
- **`copy-web.mjs` rebuilds `www/` from scratch** (rm + mkdir) instead of merging. The brief says "create `www/` if missing"; a clean rebuild every run avoids stale files from a prior `index.html` rename — costs ~5ms, removes a class of bugs.
- **Source-map exclusion implemented as a `Set` lookup in `copy-web.mjs`.** Brief calls out `core.bundle.js.map`; the Set is one line and trivially extended later (e.g. for icon-source SVGs).
- **Did not touch the Capacitor-generated `packages/ios/ios/.gitignore`.** Capacitor already ignores everything the brief asked for (`App/build`, `App/Pods`, `App/App/public`, `DerivedData`, `xcuserdata`). My additions to `TourCompanion/.gitignore` are the workspace-level enforcement.
- **Kept the workspace-level `.gitignore` additions even though they're partially redundant** with the Capacitor-generated one. Future iOS plugin steps may add paths that don't fit Capacitor's template; one canonical list at the workspace root is easier to reason about.

Verification:
- `cd TourCompanion && npm install` → 93 packages added (Capacitor toolchain), no errors.
- `npm run build:web` from `packages/ios/` → web bundle built (`5.3kb core.bundle.js` + 153.8kB index.html); `copy-web` logged "copied 2 top-level entries"; `www/` contains `index.html` + `core.bundle.js`, no `.map`. PASS.
- `npx cap add ios` → "✔ ios platform added" in 2.04s; emitted `ios/App/{App,App.xcodeproj,App.xcworkspace,Pods,Podfile,Podfile.lock}`; pod install succeeded; CocoaPods 1.16.2 resolved Capacitor 6.2.1 + CapacitorCordova 6.2.1. PASS.
- `npx cap sync ios` → "Sync finished in 1.531s"; re-copied www → `ios/App/App/public/` and re-ran pod install. PASS.
- `xcodebuild -workspace ios/App/App.xcworkspace -scheme App -sdk iphonesimulator -configuration Debug -destination 'generic/platform=iOS Simulator' build CODE_SIGNING_ALLOWED=NO` → `** BUILD SUCCEEDED **`. iPhoneSimulator26.2.sdk, deployment target 13.0, bundle id `com.cloudaipro.tourcompanion`. Only warnings are Capacitor's standard "Embed Pods Frameworks runs every build" (cosmetic) and "Metadata extraction skipped" (no AppIntents — expected). PASS.
- `git check-ignore packages/ios/ios/App/Pods packages/ios/www packages/ios/node_modules` → all 3 match; verbose check shows Capacitor's own `ios/.gitignore` covers `Pods` first. PASS.
- `git status --short | grep packages/ios` → 21 new files: `package.json`, `capacitor.config.ts`, `copy-web.mjs`, `README.md`, plus 17 under `ios/` (project.pbxproj, Swift sources, Info.plist, storyboards, assets, Podfile, Podfile.lock, Capacitor's `ios/.gitignore`). No Pods, no www, no node_modules, no App/App/public. PASS.
- `npm test` from `TourCompanion/` → 67/67 vitest tests still pass across 14 files. PASS.
- FastAPI import smoke (`SECRET_KEY=test DATABASE_URL=sqlite:///tmp/test.db UPLOAD_DIR=/tmp/tc-uploads .venv/bin/python -c "from app.main import app"`) → `IMPORT_OK`. Python untouched. PASS.

Out-of-scope (later phases):
- Native plugins (Filesystem, Geolocation, etc.) — Step 13+.
- iOS-runtime branching in `index.html` so the SPA points at offline data instead of FastAPI — Step 13+.
- App icon / splash artwork swap — out of brief. Capacitor defaults remain.

Reviewer findings: pending.

Deploy: uncommitted — awaiting Richard.

---

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
