# Architect Brief

## Initiative — Standalone iOS Version (continued)

Steps 8-11 complete. Now Step 12.

---

## Step 12 — Capacitor iOS Scaffold

**Scope:** Initialize Capacitor in `packages/ios/`. Bundle the existing web frontend into the iOS app. Generate the Xcode project. Successful `xcodebuild` against the iOS simulator SDK proves the scaffold builds. **Actual simulator launch + runtime testing is manual (Owner)** — out of scope for headless agent verification.

**App identity locked:**
- Bundle ID: `com.cloudaipro.tourcompanion`
- App name: `TourCompanion`
- Display name: `TourCompanion`

Environment confirmed: Xcode 26.3, CocoaPods 1.16.2 installed on this machine.

### Build Order

1. `cd TourCompanion/packages/ios/`. Remove existing placeholder README contents (or replace).

2. Create `package.json`:
   ```json
   {
     "name": "@tourcompanion/ios",
     "version": "0.1.0",
     "private": true,
     "scripts": {
       "build:web": "npm run build --workspace=@tourcompanion/web && node copy-web.mjs",
       "cap:sync": "npx cap sync ios",
       "cap:open": "npx cap open ios",
       "build:ios": "npm run build:web && npm run cap:sync && xcodebuild -workspace ios/App/App.xcworkspace -scheme App -sdk iphonesimulator -configuration Debug -destination 'generic/platform=iOS Simulator' build CODE_SIGNING_ALLOWED=NO | tail -30"
     },
     "dependencies": {
       "@capacitor/core": "^6",
       "@capacitor/ios": "^6",
       "@capacitor/cli": "^6",
       "@tourcompanion/core": "*"
     }
   }
   ```

3. From `TourCompanion/` root, `npm install` to add Capacitor deps to the workspace.

4. Create `TourCompanion/packages/ios/capacitor.config.ts`:
   ```ts
   import type { CapacitorConfig } from "@capacitor/cli";

   const config: CapacitorConfig = {
     appId: "com.cloudaipro.tourcompanion",
     appName: "TourCompanion",
     webDir: "www",
     server: {
       androidScheme: "https"
     }
   };

   export default config;
   ```

5. Create `TourCompanion/packages/ios/copy-web.mjs` — copies `packages/web/public/*` → `packages/ios/www/` (recursive copy, overwrites; create `www/` if missing). Pure node, no extra deps. Excludes `core.bundle.js.map`.

6. Run `npm run build:web` from `packages/ios/`. Verify `packages/ios/www/index.html` + `www/core.bundle.js` exist.

7. From `packages/ios/`: `npx cap init "TourCompanion" "com.cloudaipro.tourcompanion" --web-dir=www`. If the config file already exists (from step 4), `--web-dir=www` is the only thing this writes; check `cap init` behavior and skip if it errors out due to existing config.

8. `npx cap add ios` — generates `packages/ios/ios/App/` Xcode project + runs `pod install`. May take 2-5 minutes.

9. `npx cap sync ios` — copies `www/` into the iOS app + installs CocoaPods.

10. Verify `packages/ios/ios/App/App.xcworkspace/` exists and contains pods.

11. `xcodebuild -workspace ios/App/App.xcworkspace -scheme App -sdk iphonesimulator -configuration Debug -destination 'generic/platform=iOS Simulator' build CODE_SIGNING_ALLOWED=NO` — must succeed. Pipe to `tail -30` to keep log readable. Confirm `BUILD SUCCEEDED` appears.

12. Update `TourCompanion/.gitignore` (already exists) — add `packages/ios/ios/App/Pods/`, `packages/ios/ios/App/build/`, `packages/ios/www/`, `packages/ios/node_modules/`, `packages/ios/ios/App/DerivedData/`. CocoaPods + build artifacts are not committed; `Podfile.lock` IS committed.

13. Update `packages/ios/README.md` — document the dev loop:
    ```
    npm run build:web    # bundle core + copy web/public → www/
    npm run cap:sync     # sync www/ into iOS app
    npm run cap:open     # open Xcode (manual run/debug)
    npm run build:ios    # full headless build (CI / scaffold proof)
    ```

### Flags Bob Must Not Guess At

- **`cap add ios` writes Swift + Podfile + project.pbxproj.** All of these go in git (they ARE the iOS app source).
- **Pods/ dir is gitignored.** Lockfile (`Podfile.lock`) is committed.
- **Do NOT** run the simulator. `xcodebuild` headless build is the proof.
- **Capacitor 6.x** — pin major to keep stable across the rest of the roadmap. iOS plugin packages added in later steps will match this major.
- **`copy-web.mjs` is straightforward** — `fs.cp(src, dest, {recursive:true, force:true})` is enough on Node 20.
- **`cap init` may be interactive** — pass all flags. If it still hangs, write `capacitor.config.ts` directly and skip `cap init` (Capacitor only needs the config file; `cap add ios` reads from it).
- **Bundle ID + app name are locked.** Do not improvise.
- **No iOS-runtime detection added to index.html in this step.** Step 13+ branches behavior. For Step 12 the page may fail at runtime (server fetch 404s) — that's fine. The scaffold proof is build success, not functional app.

### Verification Checklist

- [ ] `packages/ios/capacitor.config.ts` exists with locked appId + appName
- [ ] `packages/ios/ios/App/App.xcworkspace/` exists
- [ ] `packages/ios/ios/App/Podfile.lock` exists and is committed
- [ ] `packages/ios/www/index.html` + `www/core.bundle.js` present after build:web
- [ ] `xcodebuild ... build CODE_SIGNING_ALLOWED=NO` exits 0 with `BUILD SUCCEEDED`
- [ ] `find packages/ios -maxdepth 3 -type d -name Pods` finds it; `git check-ignore packages/ios/ios/App/Pods` confirms ignored
- [ ] `git status` shows new files: capacitor.config.ts, copy-web.mjs, package.json, README.md, ios/App/* sources, Podfile, Podfile.lock — no Pods, no www, no node_modules
- [ ] Existing FastAPI server still starts (no Python changes)
- [ ] `npm test` (core) still passes 67/67

---

Architect approval: [x] Pre-approved.
