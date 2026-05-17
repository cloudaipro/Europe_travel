# Review Feedback — Step 17
Date: 2026-05-16
Ready for Builder: YES

## Must Fix
None.

## Should Fix
None.

## Escalate to Architect
None.

## Cleared

Reviewed Step 17 — native iOS foreground geolocation + `window.checkIn` override.
All brief checkpoints verified:

- **Plugin (Cap 6).** `packages/ios/package.json` pins
  `@capacitor/geolocation ^6.1.1`. `Podfile.lock` shows
  `CapacitorGeolocation (6.1.1)` (line 13), declared dependency (line 34),
  spec path under `node_modules/@capacitor/geolocation` (lines 55-56), and
  checksum `ef657a46a125be74010f4ce57caae173c23204d2` (line 68).
- **Info.plist.** `NSLocationWhenInUseUsageDescription` present at lines
  56-57 with the brief-specified string ("Tag your check-ins with where
  you visited."). When-in-use only; no `Always`/background key — correct
  per "No background location."
- **`geo/index.ts` (25 lines).** Matches brief exactly. Single attempt.
  Blanket `try { ... } catch { return null; }` wraps both the permission
  request and the position fetch, so denial, plugin throw, and
  `getCurrentPosition` timeout all degrade to `null`. Accepts
  `perm.location === "granted"` **or** `perm.coarseLocation === "granted"`
  (iOS Reduced Accuracy fallback). `enableHighAccuracy: true`,
  `timeout: 8000`, `maximumAge: 30000` — all per brief. No retries.
- **`entry.ts` override (lines 111-140).** Lives inside the
  `Capacitor.getPlatform() === "ios"` guard and inside the
  `installNativeCapture` DOMContentLoaded block, so it cannot fire on web
  and cannot install before the SPA's `checkIn` declaration exists.
  Calls `await getCoords()` then POSTs `coords ?? {}` — never blocks on
  permission failure. `!res.ok` check fires before any STATE mutation, so
  a failed POST never produces a stale UI. STATE mutation is
  null-guarded (`if (state)` + `??=` on `check_ins`, `??=` on
  `current_stop_index`, `includes()` guard on `push`) — safer than the
  brief's terse one-liner and correctly survives a check-in that fires
  before SPA `init()` populates STATE. Snack message conditionally
  appends `"(GPS)"` only when coords were captured, so the user can
  distinguish a tagged check-in from an untagged one.
- **`index.html` unchanged.** Grep confirms `async function checkIn(day,
  idx)` declared at line 2859 in a classic top-level `<script>` — already
  window-accessible (same pattern as `addPhoto`/`recordVoice`). The Step
  16 iOS bridge block at line 3456 exposes `_stopIdFor` which the
  override relies on. No edit required this step; Bob correctly skipped.
- **Fetch interceptor compatibility.** `fetch-interceptor.ts` lines
  122-138 (Step 14) reads `payload.lat ?? null` and `payload.lng ?? null`,
  so the override's `{}` body is accepted and persists a check-in row
  with null coords — exactly the non-fatal denial path the brief
  requires.
- **Verification reproduced locally.**
  - `npm run typecheck --workspace=@tourcompanion/ios` — green (no
    diagnostics emitted by `tsc --noEmit`).
  - `npm test` — 79 pass (73 core + 6 iOS), no regressions.
  - Bob's `xcodebuild ... CODE_SIGNING_ALLOWED=NO` — **BUILD SUCCEEDED**
    (per request; pod entry + checksum confirm a clean `cap sync`).
- **Out-of-scope hygiene.** No Python changes. No new endpoints. No new
  tests — Capacitor Geolocation has no Node-runnable shim, same
  precedent as Camera/Filesystem/VoiceRecorder in Step 16. No drift from
  the brief; the longer state-mutation form vs. the brief's one-liner is
  a defensive improvement, not a scope expansion.

Step 17 is clear.
