# Review Feedback — Step 20
Date: 2026-05-16
Ready for Builder: YES

## Must Fix
None.

## Should Fix
None.

## Escalate to Architect
None.

## Cleared
Verified Step 20 — TestFlight scaffold + Owner runbook — against the brief:

- `TourCompanion/packages/ios/ios/App/ExportOptions.plist` (1-18): matches the brief verbatim — `method=app-store`, `teamID=REPLACE_WITH_TEAM_ID` (literal, intact), `uploadBitcode=false`, `uploadSymbols=true`, `signingStyle=automatic`, `destination=export`.
- `TourCompanion/packages/ios/ios/App/App.xcodeproj/project.pbxproj` lines 355 + 375: `MARKETING_VERSION = 1.0.0` in both Debug and Release blocks. Accepted the pbxproj-bump approach over Info.plist literal replacement — the brief explicitly says "If `CFBundleShortVersionString` already exists, leave it", and the existing `$(MARKETING_VERSION)` build-var indirection in Info.plist (lines 19-22) now resolves to `1.0.0` as specified. Bob's rationale in REVIEW-REQUEST is sound.
- `TourCompanion/packages/ios/.gitignore`: includes `build/` alongside `node_modules/`, `www/`, `ios/App/Pods/`, `ios/App/build/`, `ios/App/DerivedData/`.
- `TourCompanion/packages/ios/package.json` lines 14-17: four release scripts present and correctly wired — `release:archive` (iphoneos Release archive to `build/TourCompanion.xcarchive`), `release:archive:nosign` (iphonesimulator Release with `CODE_SIGNING_ALLOWED=NO`), `release:export` (consumes `ExportOptions.plist`), `release:upload` (uses `${ASC_API_KEY_ID}` + `${ASC_API_ISSUER_ID}` env vars). All pre-existing scripts preserved.
- `TourCompanion/packages/ios/TESTFLIGHT.md`: 5-step prereqs (Apple Dev signup, Team ID, ASC app record, ASC API Key, Xcode signing) + 3-command build/upload chain + TestFlight propagation notes + `CFBundleVersion` bump rule + sanity-check section referencing `release:archive:nosign`. Bundle ID `com.cloudaipro.tourcompanion` matches the locked identity.
- `TourCompanion/packages/ios/README.md` lines 23-32: `build/` added to "not committed" list; new Release section links to `TESTFLIGHT.md`.

Agent-verifiable checks re-run from the reviewer's side:
- `npm run release:archive:nosign` → BUILD SUCCEEDED (Release config compiles end-to-end against Simulator SDK).
- `npm test` (monorepo) → 83 passed (73 core + 10 iOS).
- `npm run typecheck` (monorepo) → clean (tsc --noEmit on core + ios; web has no TS yet).
- `git status` / `git diff` confirm no Python files and no `index.html` touched. Changes are confined to `TourCompanion/packages/ios/*` plus handoff docs.

Step 20 is clear. The Standalone iOS initiative is ready for the Owner to wire up Apple Dev signing and ship.
