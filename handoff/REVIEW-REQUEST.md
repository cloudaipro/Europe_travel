# Review Request — Step 16: Camera + Filesystem + Voice Recorder (Native iOS Capture)

**Step:** 16 — Camera + Filesystem + Voice Recorder (Native iOS Capture)
**Date:** 2026-05-16
**Ready for Review:** YES
**Builder:** Bob

---

## Scope

Native iOS capture for photos and voice notes. iOS-only override of the SPA's
demo `addPhoto` / `recordVoice` handlers using Capacitor Camera, Filesystem,
and capacitor-voice-recorder. Files persist to `Directory.Data`; paths
round-trip through Step 14's `/api/stops/<id>/photos-link` and
`/api/stops/<id>/voice` fetch interceptor — no new endpoints. Web behavior
unchanged.

---

## Files Changed

### New

- `TourCompanion/packages/ios/src/runtime/capture/index.ts` (lines 1-53)
  - `capturePhoto()` — lines 12-30
  - `startVoice()` — lines 32-37
  - `stopVoice()` — lines 39-53

### Modified

- `TourCompanion/packages/ios/src/runtime/entry.ts` (lines 1-117)
  - Import added — line 18 (`capturePhoto, startVoice, stopVoice` from `./capture/index.js`)
  - DOMContentLoaded override block — lines 48-115 (installs `window.addPhoto` + `window.recordVoice`; registers via `document.addEventListener("DOMContentLoaded", ...)` if `document.readyState === "loading"`, else runs immediately)

- `TourCompanion/packages/ios/ios/App/App/Info.plist` (lines 1-57)
  - `NSCameraUsageDescription` — lines 48-49
  - `NSPhotoLibraryUsageDescription` — lines 50-51
  - `NSPhotoLibraryAddUsageDescription` — lines 52-53
  - `NSMicrophoneUsageDescription` — lines 54-55

- `TourCompanion/packages/ios/package.json` (lines 17, 20, 24)
  - `@capacitor/camera ^6.1.3`
  - `@capacitor/filesystem ^6.0.4`
  - `capacitor-voice-recorder ^6.0.3`

- `TourCompanion/package-lock.json` — npm lockfile updates for the three plugins

- `TourCompanion/packages/web/public/index.html`
  - iOS bridge block right before `init();` near end of inline `<script>` (search `// iOS bridge`) — exposes `_stopIdFor`, `showSnack`, `renderTour`, `renderMemory` on window, plus a getter/setter `Object.defineProperty` for `STATE` (because `let STATE` does not auto-attach). Web behavior unchanged.

---

## Verification

- `npm run typecheck --workspace=@tourcompanion/ios` — **green**
- `npm run build --workspace=@tourcompanion/ios` — **green** (`ios.bundle.js` 169.6 kB)
- `npm test` (full monorepo) — **79 tests pass** (73 core + 6 iOS)
- `npx cap sync ios` — clean, all 5 plugins detected (sqlite, camera, filesystem, secure-storage, voice-recorder)
- `xcodebuild -workspace ios/App/App.xcworkspace -scheme App -sdk iphonesimulator -configuration Debug -destination 'generic/platform=iOS Simulator' build CODE_SIGNING_ALLOWED=NO` — **BUILD SUCCEEDED**

---

## Notes for Reviewer

- **iOS-only.** The override is inside the `Capacitor.getPlatform() === "ios"` guard. Web SPA's demo `addPhoto` / `recordVoice` are unchanged.
- **DOMContentLoaded sequencing.** `ios.bundle.js` is injected into `<head>` via `copy-web.mjs` — it parses BEFORE the SPA's inline `<script>` runs. That means at script-load the SPA's `addPhoto` / `_stopIdFor` are not yet on window. The override therefore registers on DOMContentLoaded (or runs synchronously if the DOM already finished parsing), which fires after the inline `<script>` block has executed and bridge globals are attached.
- **STATE bridging via getter/setter.** `let STATE = null;` then later `STATE = ...;` inside the inline SPA means a plain `window.STATE = STATE` assignment would freeze the old value. `Object.defineProperty` with a getter/setter gives the iOS code a live read on the current SPA value.
- **`window.confirm` UX is intentional v1 compromise** — Step 19 polishes with a styled modal per brief.
- **`saveToGallery: false`** — photos stay sandboxed; `NSPhotoLibraryAddUsageDescription` is still required by Apple's Camera plugin gate even when unused.
- **No new tests** — native plugins are not Node-runnable. Existing 79 tests still pass.
- **No Python changes.**

---

**Ready for Review: YES**
