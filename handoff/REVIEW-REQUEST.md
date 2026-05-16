# Review Request — Step 12

**Step:** 12 — Capacitor iOS scaffold
**Ready for Review:** YES
**Builder:** Bob
**Date:** 2026-05-16

---

## Summary

Stood up `TourCompanion/packages/ios/` as a Capacitor 6 wrapper around the existing web SPA. Web bundle copies into `www/`, `npx cap add ios` generated the Xcode project + Podfile, headless `xcodebuild` against the simulator SDK exits 0 with `BUILD SUCCEEDED`. No native plugins yet (Step 13+). No iOS-runtime branching in `index.html` yet — brief §"Flags Bob Must Not Guess At" explicitly defers it; the scaffold proof is build success, not runtime function.

Bundle identity locked exactly as specified:
- `appId: "com.cloudaipro.tourcompanion"`
- `appName: "TourCompanion"`

---

## Files to review

### New — `packages/ios/` root (human-authored)

| File | Lines | What it does |
|---|---|---|
| `TourCompanion/packages/ios/package.json` | 1–17 | `@tourcompanion/ios` workspace; Capacitor 6 deps + `@tourcompanion/core` `*`; scripts `build:web` / `cap:sync` / `cap:open` / `build:ios` per brief verbatim. |
| `TourCompanion/packages/ios/capacitor.config.ts` | 1–12 | Locked appId / appName / webDir / androidScheme. |
| `TourCompanion/packages/ios/copy-web.mjs` | 1–40 | Pure-Node copy from `packages/web/public/` → `packages/ios/www/`. Rewrites `www/` from scratch each run. Excludes `core.bundle.js.map` via a `Set`. |
| `TourCompanion/packages/ios/README.md` | 1–28 | Replaces placeholder. Documents dev loop + identity + what is/isn't committed. |

### New — `packages/ios/ios/` (Capacitor-generated, committed)

| File | Notes |
|---|---|
| `packages/ios/ios/.gitignore` | Capacitor template — ignores `App/build`, `App/Pods`, `App/App/public`, `DerivedData`, `xcuserdata`, regenerated config files. Untouched. |
| `packages/ios/ios/App/App.xcodeproj/project.pbxproj` | Capacitor template; bundle id baked in via project settings. |
| `packages/ios/ios/App/App.xcworkspace/{contents.xcworkspacedata, xcshareddata/IDEWorkspaceChecks.plist}` | 2 files. |
| `packages/ios/ios/App/App/AppDelegate.swift` | Capacitor default. |
| `packages/ios/ios/App/App/Info.plist` | Capacitor default. |
| `packages/ios/ios/App/App/Base.lproj/{LaunchScreen,Main}.storyboard` | Capacitor defaults. |
| `packages/ios/ios/App/App/Assets.xcassets/{AppIcon,Splash}` | Capacitor placeholder art. |
| `packages/ios/ios/App/Podfile` | 22 lines — Capacitor 6 pod refs via relative path into `node_modules`. |
| `packages/ios/ios/App/Podfile.lock` | Pins Capacitor 6.2.1, CapacitorCordova 6.2.1; CocoaPods 1.16.2. |

### Modified

| File | Lines | Change |
|---|---|---|
| `TourCompanion/.gitignore` | 7–12 (appended) | Belt-and-suspenders block: `packages/ios/www/`, `packages/ios/node_modules/`, `packages/ios/ios/App/{Pods,build,DerivedData}/`. Capacitor's own `ios/.gitignore` already covers most of this; the workspace-level rules make the intent explicit. |
| `TourCompanion/package-lock.json` | (machine-generated) | `npm install` resolved 93 added packages for Capacitor toolchain. |

### Untouched (proof of scope discipline)

- `TourCompanion/server/` — zero Python edits this step.
- `TourCompanion/packages/web/` — unchanged.
- `TourCompanion/packages/core/` — unchanged.
- `TourCompanion/package.json` — no root-level changes needed (workspaces glob already covers `packages/*`).

---

## Verification I ran

- `npm install` from `TourCompanion/` → 93 packages added, no errors.
- `npm run build:web` from `packages/ios/` → `www/index.html` (153.8kB) + `www/core.bundle.js` (5.3kB), no `.map`.
- `npx cap add ios` → success in 2.04s; pod install succeeded.
- `npx cap sync ios` → success in 1.531s; re-ran pod install cleanly.
- `xcodebuild ... build CODE_SIGNING_ALLOWED=NO | tail -30` → `** BUILD SUCCEEDED **`. Only warnings: Capacitor's standard "Embed Pods Frameworks runs every build" (cosmetic) and "Metadata extraction skipped. No AppIntents.framework dependency found" (expected for a no-AppIntents app).
- `npm test` from `TourCompanion/` → 67/67 vitest tests pass across 14 files. Unchanged from Step 11.
- `SECRET_KEY=test ... .venv/bin/python -c "from app.main import app"` → `IMPORT_OK`. FastAPI server still imports.
- `git check-ignore -v packages/ios/ios/App/Pods` → matched by Capacitor's `ios/.gitignore` line 4. `packages/ios/www` matched by my workspace-level rule. `packages/ios/node_modules` matched by the existing root `node_modules/` rule.
- `git status --short | grep packages/ios | wc -l` → 21 new files; manual scan confirms zero Pods / www / node_modules / App/App/public entries.

---

## Verification checklist (from brief)

- [x] `packages/ios/capacitor.config.ts` exists with locked appId + appName
- [x] `packages/ios/ios/App/App.xcworkspace/` exists
- [x] `packages/ios/ios/App/Podfile.lock` exists and is committed
- [x] `packages/ios/www/index.html` + `www/core.bundle.js` present after build:web
- [x] `xcodebuild ... build CODE_SIGNING_ALLOWED=NO` exits 0 with `BUILD SUCCEEDED`
- [x] `find packages/ios -maxdepth 3 -type d -name Pods` finds it; `git check-ignore` confirms ignored
- [x] `git status` shows new files: capacitor.config.ts, copy-web.mjs, package.json, README.md, ios/App/* sources, Podfile, Podfile.lock — no Pods, no www, no node_modules
- [x] Existing FastAPI server still starts (no Python changes)
- [x] `npm test` (core) still passes 67/67

---

## Judgment calls Richard may want to confirm

1. **Skipped `npx cap init` entirely.** Brief authorizes this if interactive prompts hang; wrote `capacitor.config.ts` by hand instead. `cap add ios` succeeded on first try and emitted `ios/App/App/capacitor.config.json` from this TS source.
2. **`copy-web.mjs` wipes `www/` before each copy** rather than merging. Cheaper to reason about; cost is negligible (2 entries, ~5ms).
3. **Kept workspace-level `.gitignore` additions** even though Capacitor's auto-generated `packages/ios/ios/.gitignore` already covers most. Future iOS-plugin steps may add paths outside Capacitor's template; one canonical list at workspace root is easier to maintain.
4. **Did not touch app icon / splash artwork.** Capacitor placeholders remain; brief doesn't ask for branding in Step 12.
5. **No iOS-runtime branch in `index.html`** — brief explicitly defers this to Step 13+. The SPA will fail at runtime when launched in the simulator (fetches a non-existent server). That's fine — Step 12's deliverable is build success.

---

## Open questions

None. Brief was unambiguous; every checklist item is green.

## Escalate to Architect

None.

---

**Ready for Review: YES**
