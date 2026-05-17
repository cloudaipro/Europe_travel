# Review Request — Step 17: Native Geolocation + GPS Check-ins on iOS

**Step:** 17 — Native Geolocation + GPS Check-ins on iOS
**Date:** 2026-05-16
**Ready for Review:** YES
**Builder:** Bob

---

## Scope

Native iOS geolocation tagging for the existing check-in flow. iOS-only
override of the SPA's `window.checkIn` (declared as `async function checkIn`
in `packages/web/public/index.html`) that asks for foreground location
permission, fetches a single current-position fix, and POSTs `{lat,lng}` (or
`{}` on denial / timeout) to `/api/stops/<id>/checkin`. Step 14's fetch
interceptor already accepts `lat`/`lng` in the body — no new endpoints. Web
behavior unchanged.

---

## Files Changed

### New

- `TourCompanion/packages/ios/src/runtime/geo/index.ts` (lines 1-25)
  - `getCoords()` — lines 12-24: requests permissions, returns null unless `location === "granted"` or `coarseLocation === "granted"`; otherwise `Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 })` and returns `{lat,lng}`. Any throw → null. Single attempt.

### Modified

- `TourCompanion/packages/ios/src/runtime/entry.ts` (lines 1-148)
  - Import added — line 19 (`getCoords` from `./geo/index.js`)
  - `window.checkIn` override — lines 111-140 (inside the existing `installNativeCapture` DOMContentLoaded block, right after the `recordVoice` override at line 109). Calls `getCoords()`, POSTs `/api/stops/<id>/checkin` with `coords ?? {}`, then mirrors the SPA's local state mutation (`STATE.check_ins[day].push(idx)`, `STATE.current_stop_index[day] = idx + 1`) and re-renders Tour + Memory. Snack message is tagged `"(GPS)"` when coords were captured.

- `TourCompanion/packages/ios/ios/App/App/Info.plist` (lines 1-59)
  - `NSLocationWhenInUseUsageDescription` — lines 56-57 ("Tag your check-ins with where you visited.")

- `TourCompanion/packages/ios/package.json`
  - `@capacitor/geolocation ^6.1.1` added to `dependencies`

- `TourCompanion/packages/ios/ios/App/Podfile.lock`
  - `CapacitorGeolocation (6.1.1)` pod entry added (auto-managed by `npx cap sync ios`)

- `TourCompanion/package-lock.json` — npm lockfile update for `@capacitor/geolocation`

### Unchanged but verified

- `TourCompanion/packages/web/public/index.html` — `async function checkIn(day, idx)` (line 2859) is a top-level declaration inside a classic `<script>`; it's already on window. The `// iOS bridge` block at lines 3452-3460 needs no addition. Web POST stays `{}` — same as Step 14 behavior.
- `TourCompanion/packages/ios/src/runtime/fetch-interceptor.ts` — `/checkin` route at lines 122-131 already reads `payload.lat`/`payload.lng` (defaulted to `null`).

---

## Verification

- `npm run typecheck --workspace=@tourcompanion/ios` — **green**
- `npm run build` (full monorepo) — **green** (`ios.bundle.js` 173.2 kB, +3.6 kB vs Step 16)
- `npm test` (full monorepo) — **79 tests pass** (73 core + 6 iOS)
- `npx cap sync ios` — clean, **6 plugins detected** (sqlite, camera, filesystem, geolocation, secure-storage, voice-recorder)
- `xcodebuild -workspace ios/App/App.xcworkspace -scheme App -sdk iphonesimulator -configuration Debug -destination 'generic/platform=iOS Simulator' build CODE_SIGNING_ALLOWED=NO` — **BUILD SUCCEEDED**
- No Python files touched.
- `index.html` unchanged this step (verified via the architect-brief's grep check that `checkIn` is window-accessible as-is).

---

## Notes for Reviewer

- **iOS-only.** Override is inside the existing `Capacitor.getPlatform() === "ios"` guard. Web `checkIn` is untouched and still posts `{}`.
- **Permission denial is non-fatal.** `getCoords()` returns null on denial / timeout / any plugin throw; the check-in still POSTs with `{}` and is recorded server-side (the row just has null lat/lng). Snack text drops the `(GPS)` suffix in that case so the user can tell.
- **Coarse-accuracy fallback** — `requestPermissions` may return `coarseLocation: "granted"` only (iOS 14+ Reduced Accuracy toggle). The override treats that as success — coarse coords are still useful for tagging.
- **`maximumAge: 30000`** — a 30s-old fix is accepted so the GPS doesn't have to warm from cold every check-in. Tradeoff: a moving user gets the previous stop's coords if they check in <30s after the last one. Acceptable for a foot-tour app where stops are typically minutes apart.
- **Single attempt, no retries** — `timeout: 8000` then null, per brief.
- **State mutation safety** — wrapped in `if (state)` with `??=` guards on `check_ins` and `current_stop_index` (the brief's example used the terse `(s.check_ins[day] ??= []).includes(idx) || s.check_ins[day].push(idx)`; the override's longer form survives a check-in that fires before SPA `init()` has populated STATE).
- **`window.checkIn` is auto-bound on window.** Top-level `async function` declarations in a classic `<script>` are window-accessible (same pattern as the photo/voice overrides). No bridge change needed; verified via grep — `index.html` line 2859 declares it as a function, line 2833 calls it via inline `onclick="checkIn(...)"`.
- **No new tests** — Capacitor Geolocation has no Node-runnable shim, same as Camera/Filesystem/VoiceRecorder in Step 16. Existing 79 tests pass.
- **No Python changes.**

---

**Ready for Review: YES**
