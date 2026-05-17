# Review Request — Step 20: TestFlight Build Scaffold + Apple Dev Onboarding

**Builder:** Bob
**Date:** 2026-05-16
**Ready for Review: YES**

This is the **final step of the Standalone iOS initiative.** After Richard clears
it, the workspace is ready for the Owner to wire up Apple Dev signing and ship
to TestFlight.

---

## Summary

Wired the release build pipeline as far as it can go without Owner-only Apple
account actions. Added four npm scripts (archive / archive:nosign / export /
upload), an `ExportOptions.plist` with a literal `REPLACE_WITH_TEAM_ID`
placeholder, a `.gitignore` to keep build artefacts out of the repo, an Owner
runbook in `TESTFLIGHT.md`, and pointed the iOS package README at it. Bumped
`MARKETING_VERSION` in the pbxproj from `1.0` → `1.0.0` so the build-var
indirection in `Info.plist` resolves to the value the brief specifies.

Verified: `release:archive:nosign` → BUILD SUCCEEDED. Debug build still
SUCCEEDED. 83 tests pass. Typecheck clean.

---

## Files Changed

### New files

**`TourCompanion/packages/ios/ios/App/ExportOptions.plist`** (lines 1-17)
- Verbatim from the brief: `method=app-store`, `teamID=REPLACE_WITH_TEAM_ID`
  (literal — Owner fills in post-signup), `uploadBitcode=false`,
  `uploadSymbols=true`, `signingStyle=automatic`, `destination=export`.

**`TourCompanion/packages/ios/.gitignore`** (lines 1-6)
- Lists `node_modules/`, `www/`, `build/` (new, for release archive output),
  `ios/App/Pods/`, `ios/App/build/`, `ios/App/DerivedData/`. Mirrors what the
  README already documented as "not committed".

**`TourCompanion/packages/ios/TESTFLIGHT.md`** (lines 1-78)
- 5-step prereqs (Apple Dev signup → Team ID → ASC app record → ASC API Key →
  Xcode signing).
- 3-command build/upload chain (`release:archive` / `release:export` /
  `release:upload`).
- TestFlight propagation timeline + bump rule for `CFBundleVersion` on the
  next upload.
- Sanity-check section pointing at `release:archive:nosign`.

### Modified files

**`TourCompanion/packages/ios/ios/App/App.xcodeproj/project.pbxproj`**
- Line 355: `MARKETING_VERSION = 1.0;` → `MARKETING_VERSION = 1.0.0;` (Debug block).
- Line 375: `MARKETING_VERSION = 1.0;` → `MARKETING_VERSION = 1.0.0;` (Release block).
- `CURRENT_PROJECT_VERSION = 1` (lines 351, 371) already correct — untouched.

**`TourCompanion/packages/ios/package.json`** (lines 13-17 added)
- Added `release:archive` — full `iphoneos` Release archive (Owner will run after signing wired).
- Added `release:archive:nosign` — `iphonesimulator` Release smoke-test with `CODE_SIGNING_ALLOWED=NO` (the agent-verifiable proof-of-compile).
- Added `release:export` — `xcodebuild -exportArchive` consuming the `ExportOptions.plist`.
- Added `release:upload` — `xcrun altool --upload-app` with ASC API env vars.
- All pre-existing scripts (`build:web`, `build`, `test`, `typecheck`, `cap:sync`, `cap:open`, `build:ios`) preserved.

**`TourCompanion/packages/ios/README.md`** (lines 24-30)
- Added `build/` to the "not committed" list.
- New "Release" section pointing at `TESTFLIGHT.md`.

### Info.plist (unchanged)
- Pre-grep showed `CFBundleShortVersionString`, `CFBundleVersion`, and
  `CFBundleDisplayName` all already present. Display name is literal
  `TourCompanion`; version keys use build-var indirection
  (`$(MARKETING_VERSION)`, `$(CURRENT_PROJECT_VERSION)`), which is Xcode-idiomatic.
  Bumping `MARKETING_VERSION` in the pbxproj makes the resolved value match
  the brief's spec without breaking Xcode's project-level version management.

---

## Verification Results

| Check | Result |
|---|---|
| `Info.plist` has CFBundle{ShortVersionString,Version,DisplayName} | YES (resolved to `1.0.0` / `1` / `TourCompanion`) |
| `ExportOptions.plist` exists | YES |
| `packages/ios/.gitignore` includes `build/` | YES |
| `package.json` has four new release scripts | YES |
| `TESTFLIGHT.md` exists with 5-step prereqs + 3-command chain | YES |
| `npm run release:archive:nosign` → BUILD SUCCEEDED | YES |
| `npm test` (monorepo) → 83 tests pass | YES (73 core + 10 iOS) |
| `npm run typecheck` (monorepo) → clean | YES |
| `npm run build:ios` (Debug iphonesimulator) → BUILD SUCCEEDED | YES |
| No Python changes | YES |
| No `index.html` changes | YES |
| `REPLACE_WITH_TEAM_ID` stays literal in committed file | YES |

---

## Open Questions

None. Brief was unambiguous and the Owner-vs-agent scope split was precisely
defined.

---

## Notes for Richard

- **Why MARKETING_VERSION instead of replacing the Info.plist build-var ref?**
  The brief shows literal-string XML for the keys but also explicitly says "If
  `CFBundleShortVersionString` already exists, leave it." Replacing the
  build-var with a literal would contradict that clause and force a two-place
  edit on every future version bump. Bumping the pbxproj setting keeps the
  Xcode-idiomatic indirection and makes the resolved bundle value match the
  brief.
- **`release:archive:nosign` is the agent-side verifiable build.** The real
  `release:archive` will fail in any environment without a signing identity —
  the brief itself flags this. The no-sign variant compiles the Release config
  end-to-end against the Simulator SDK; if it builds, the Release config is
  sound.
- **Two Swift-6-mode warnings in Pods/SwiftKeychainWrapper** are pre-existing
  (visible in Step 17/18/19 builds too); not introduced by this step.
