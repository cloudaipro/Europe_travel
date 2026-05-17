# Review Feedback — Step 16
Date: 2026-05-16
Ready for Builder: YES

## Must Fix
None.

## Should Fix
None.

## Escalate to Architect
None.

## Cleared

Reviewed Step 16 — native iOS camera, filesystem, and voice recorder capture. All
brief checkpoints verified:

- **Plugins (Cap 6).** `packages/ios/package.json` pins `@capacitor/camera ^6.1.3`,
  `@capacitor/filesystem ^6.0.4`, `capacitor-voice-recorder ^6.0.3`. `Podfile.lock`
  shows `CapacitorCamera (6.1.3)`, `CapacitorFilesystem (6.0.4)`, and
  `CapacitorVoiceRecorder (6.0.3)` with matching checksums and `node_modules`
  paths.
- **Info.plist.** All four usage strings present (lines 48-55):
  `NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription`,
  `NSPhotoLibraryAddUsageDescription`, `NSMicrophoneUsageDescription`.
- **`capture/index.ts` (53 lines).** `capturePhoto` uses Base64 + `Directory.Data`
  with `recursive:true` and `saveToGallery:false`; throws on missing `base64String`;
  filename `photo-<ts>.<format ?? "jpg">`. `startVoice` gates on mic permission.
  `stopVoice` writes `voice/<ts>.m4a` and returns `{path, transcript:"", durationMs}`.
  Matches brief exactly; the brief's deliberately-throwing `recordVoiceNote`
  decoy was correctly omitted.
- **`entry.ts` DOMContentLoaded override (lines 47-115).** Lives inside the
  `Capacitor.getPlatform() === "ios"` guard, so it cannot fire on web. Uses
  `document.readyState === "loading" ? addEventListener(...,{once:true}) : run-now`
  so the override always installs *after* the SPA's inline `<script>` has
  executed and the bridge globals exist. Each call to `_stopIdFor`, `STATE`,
  `showSnack`, `renderTour`, `renderMemory` is optional-chained — a missing
  global degrades gracefully rather than throwing. Error paths surface via
  `showSnack`. The `!res.ok` interceptor check fires before any STATE
  mutation, so a failed save never produces a stale UI update.
- **`index.html` iOS bridge block.** +10 lines, additive only, immediately
  before `init();`. Exposes `_stopIdFor`, `showSnack`, `renderTour`,
  `renderMemory` as plain assignments and installs
  `Object.defineProperty(window, "STATE", {get,set,configurable:true})` —
  correct pattern because `let STATE` is reassigned later in the SPA boot;
  a plain `window.STATE = STATE` would freeze the initial `null`. `git diff
  HEAD` on `index.html` confirms +10/-0; demo `addPhoto` (line 2871) and
  demo `recordVoice` (line 2891) remain the unmodified web fallback.
- **Verification reproduced locally.**
  - `npm run typecheck --workspace=@tourcompanion/ios` — green.
  - `npm run build --workspace=@tourcompanion/ios` — green (`ios.bundle.js`
    169.6 kB, matches Bob's claim).
  - `npm test` — 79 pass (73 core + 6 iOS), no regressions.
  - `xcodebuild -workspace ios/App/App.xcworkspace -scheme App -sdk
    iphonesimulator -configuration Debug -destination 'generic/platform=iOS
    Simulator' build CODE_SIGNING_ALLOWED=NO` — **BUILD SUCCEEDED**.
- **Out-of-scope hygiene.** No Python changes. No new endpoints — both
  `/api/stops/<id>/photos-link` and `/api/stops/<id>/voice` round-trip through
  the Step 14 fetch interceptor as designed. `window.confirm` UX is the
  documented v1 compromise; Step 19 polishes per the brief. Adding no new
  tests is correct — native plugins are not Node-runnable, and the existing
  79-test surface protects everything that can be tested off-device.

Step 16 is clear.
