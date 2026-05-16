# Review Request — Step 14

**Step:** 14 — Settings, Keychain, Fetch Interceptor
**Ready for Review:** YES
**Builder:** Bob

---

## Summary

Three subsystems land together so iOS can run end-to-end against on-device data:

1. **Core settings module** — new `SecureStore` interface + `TCSettings` facade backed by any keychain-style store. `CORE_VERSION` bumped to `0.5.0`.
2. **iOS Keychain adapter** — `capacitor-secure-storage-plugin@0.10.0` (Cap 6 compatible) wrapped behind `SecureStore`. The `@capacitor-community/secure-storage` name in the brief is not published on npm — fallback documented in BUILD-LOG.
3. **Fetch interceptor + settings UI** — `window.fetch` is patched at script-load (head injection) so the existing inline SPA JS keeps making `fetch("/api/...")` calls but they route to `window.TCStore` (or canned stubs for auth/health). A 🔑 gear in the app bar opens a modal for the user's OpenAI key; the gear is `display:none` unless `body.is-ios` is set.

The copy-web injection point moved from before `</body>` to inside `<head>` after `</title>` — required so the interceptor exists before the SPA's inline boot runs.

`/api/plan/ingest` returns 503 as instructed; Step 15 wires OpenAI.

---

## Files Changed

### New — Core settings module
- **`TourCompanion/packages/core/src/settings/keys.ts`** (lines 1–9)
  `SETTINGS_KEYS` constant (`openai_api_key`, `openai_model`) + `DEFAULT_OPENAI_MODEL = "gpt-4o"`.
- **`TourCompanion/packages/core/src/settings/types.ts`** (lines 1–61)
  `SecureStore` interface, `TCSettings` interface, `createSettings(store)` factory with trim/clear semantics for both key and model.

### New — Core tests
- **`TourCompanion/packages/core/tests/settings/settings.test.ts`** (lines 1–75)
  6 tests against an in-memory SecureStore — round-trip, trim, clear, model default + override.

### New — iOS runtime
- **`TourCompanion/packages/ios/src/runtime/keychain/index.ts`** (lines 1–37)
  `keychainStore: SecureStore` wrapping `SecureStoragePlugin`. Soft-misses on `get` / `remove` (plugin throws on missing key).
- **`TourCompanion/packages/ios/src/runtime/fetch-interceptor.ts`** (lines 1–266)
  - `route(path, method, body, store)` (lines 25–168) — pure pattern-matcher covering every endpoint in the brief's table.
  - `installFetchInterceptor(storeProvider)` (lines 170–266) — synchronous patch of `window.fetch`. Accepts a `TripStore` *or* a `() => Promise<TripStore>` so install can precede SQLite readiness. First /api/* request awaits the promise.
- **`TourCompanion/packages/ios/src/runtime/global.d.ts`** (lines 1–15)
  Ambient `Window` augmentation declaring `TCStore?` and `TCSettings?`.

### Modified — Core
- **`TourCompanion/packages/core/src/index.ts`** (lines 40–47)
  Re-exports the new settings types/factory; `CORE_VERSION` → `"0.5.0"` (line 47).
- **`TourCompanion/packages/core/package.json`** (line 3) — version `0.5.0`.
- **`TourCompanion/packages/core/tests/smoke.test.ts`** (lines 5–7) — asserts `"0.5.0"`.

### Modified — iOS
- **`TourCompanion/packages/ios/src/runtime/entry.ts`** (full rewrite, lines 1–45)
  On iOS: builds the store promise, sets `window.TCSettings`, installs interceptor, marks `body.is-ios` (deferred to `DOMContentLoaded` if body not yet present). Off-iOS the block is skipped.
- **`TourCompanion/packages/ios/copy-web.mjs`** (header lines 1–8 + injection lines 39–60)
  Injects `<script src="/ios.bundle.js"></script>` after `</title>` inside `<head>` instead of before `</body>`. Errors out if no `</title>` found.
- **`TourCompanion/packages/ios/package.json`** (line 21)
  Adds `"capacitor-secure-storage-plugin": "^0.10.0"`.

### Modified — Web SPA (additive only)
- **`TourCompanion/packages/web/public/index.html`** — five additive blocks:
  - **Line 839** — 🔑 `ts-settings-btn` added inside `<div class="mab-right">` (mobile app bar).
  - **Lines 878–879** — 🔑 `ts-settings-btn` added inside desktop header right-actions cluster.
  - **Lines 1096–1108** — CSS for `.ts-settings-btn` (display gate), `.ts-help-link`, `.ts-sub` immediately before `</style>`.
  - **Lines 1157–1179** — `#ts-settings-modal` HTML block (password key input, model input, Cancel/Clear/Save). Reuses `.as-overlay` / `.as-card` / `.as-field` / `.as-btn-*` classes.
  - **Lines 3203–3263** — `openSettingsModal`, `closeSettingsModal`, `saveSettings`, `clearSettingsKey`, plus an Escape-to-close `keydown` listener immediately after `showSnack`.

  No existing element rewired or removed.

### Modified — Lockfile
- **`TourCompanion/package-lock.json`** — 1 package added.

---

## Verification

- `npm run build` — green (core tsc + ios bundle 90.5kb + web esbuild + `[copy-web] injected ... after </title>`).
- `npm run typecheck` — green across `@tourcompanion/core` and `@tourcompanion/ios`.
- `npm test --workspace=@tourcompanion/core` — **73/73** passing (was 67; +6 in `settings/settings.test.ts`).
- `npx cap sync ios` — both plugins reported: `@capacitor-community/sqlite@6.0.2`, `capacitor-secure-storage-plugin@0.10.0`.
- `Podfile.lock` contains `CapacitorSecureStoragePlugin (0.10.0)`.
- `xcodebuild ... build CODE_SIGNING_ALLOWED=NO` — `** BUILD SUCCEEDED **`.
- `packages/ios/www/index.html` line 7 (right after `</title>` at line 6) contains `<script src="/ios.bundle.js"></script>`. Head injection confirmed.
- No Python files touched.

---

## Open Questions

1. **`/api/auth/me` stub fields.** Returned `{id:1, email:"", display_name:"local", email_verified_at:null, created_at:""}` per the brief. If the SPA later starts rendering `display_name` into a header, the placeholder may need a friendlier value. No frontend reads it today.
2. **iOS WebView base URL.** `new URL(url, location.origin)` resolves under `capacitor://localhost`. Verified locally — flagging in case Richard wants an explicit test.
3. **First-request latency.** The interceptor awaits the store promise before routing. SQLite init is sub-100ms on simulator; no user-visible regression expected.

---

**Ready for Review: YES**
