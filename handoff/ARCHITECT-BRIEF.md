# Architect Brief

## Initiative — Standalone iOS Version (continued)

Steps 8-19 complete. Now Step 20.

---

## Step 20 — TestFlight Build Scaffold + Apple Dev Onboarding

**Scope:** Wire the release build pipeline as far as it can go without Owner-only actions (Apple Dev account + signing certs + App Store Connect record). Provide turnkey scripts + a step-by-step `TESTFLIGHT.md` so the Owner can ship to TestFlight once they have signing in place.

**Cannot be done by agent:**
- Apple Dev membership ($99/yr) purchase
- App Store Connect (ASC) app record creation
- Signing certificate + provisioning profile generation
- `altool` / `xcrun notarytool` upload with ASC API key

**Can be done by agent:**
- Bump iOS version metadata in `Info.plist`
- Generate `ExportOptions.plist` for App Store distribution
- Add `release:archive` + `release:export` + `release:upload` npm scripts
- Write `TESTFLIGHT.md` Owner runbook
- Verify clean release-config build (without code signing) still succeeds

### Build Order

1. **Version metadata — `packages/ios/ios/App/App/Info.plist`:**
   ```xml
   <key>CFBundleShortVersionString</key>
   <string>1.0.0</string>
   <key>CFBundleVersion</key>
   <string>1</string>
   <key>CFBundleDisplayName</key>
   <string>TourCompanion</string>
   ```
   Add the keys if missing. If `CFBundleShortVersionString` already exists, leave it (Cap default is `1.0`); add `CFBundleVersion` if absent. Add `CFBundleDisplayName`.

2. **Export options — `packages/ios/ios/App/ExportOptions.plist`:**
   ```xml
   <?xml version="1.0" encoding="UTF-8"?>
   <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
   <plist version="1.0">
   <dict>
     <key>method</key>
     <string>app-store</string>
     <key>teamID</key>
     <string>REPLACE_WITH_TEAM_ID</string>
     <key>uploadBitcode</key>
     <false/>
     <key>uploadSymbols</key>
     <true/>
     <key>signingStyle</key>
     <string>automatic</string>
     <key>destination</key>
     <string>export</string>
   </dict>
   </plist>
   ```
   `REPLACE_WITH_TEAM_ID` stays literal — Owner fills in after Apple Dev signup.

3. **Release scripts — `packages/ios/package.json`:**
   Add scripts (preserve existing ones):
   ```json
   {
     "scripts": {
       "build:web": "...",
       "cap:sync": "...",
       "cap:open": "...",
       "build:ios": "...",
       "release:archive": "npm run build:web && npm run cap:sync && xcodebuild -workspace ios/App/App.xcworkspace -scheme App -sdk iphoneos -configuration Release -destination 'generic/platform=iOS' archive -archivePath build/TourCompanion.xcarchive",
       "release:export": "xcodebuild -exportArchive -archivePath build/TourCompanion.xcarchive -exportOptionsPlist ios/App/ExportOptions.plist -exportPath build/export",
       "release:upload": "xcrun altool --upload-app -f build/export/App.ipa -t ios --apiKey ${ASC_API_KEY_ID} --apiIssuer ${ASC_API_ISSUER_ID}"
     }
   }
   ```

4. **`packages/ios/.gitignore`:** add `build/` so archive + ipa aren't committed.

5. **Owner runbook — `packages/ios/TESTFLIGHT.md`:** create with the following sections (be precise + executable):

   ```markdown
   # Ship to TestFlight — Owner Runbook

   Prerequisites (one-time, ~30 min):
   1. Apple Developer Program — $99/yr — https://developer.apple.com/programs/enroll/
      Membership processed within 24-48h.
   2. Find your Team ID — https://developer.apple.com/account → Membership.
      Copy the 10-char ID. Paste into `packages/ios/ios/App/ExportOptions.plist`
      replacing `REPLACE_WITH_TEAM_ID`.
   3. App Store Connect — https://appstoreconnect.apple.com → My Apps → +
      - Bundle ID: `com.cloudaipro.tourcompanion`
      - SKU: `tourcompanion-ios`
      - Name: `TourCompanion`
   4. ASC API Key — Users + Access → Keys → +
      - Save the .p8 file. Note the Key ID + Issuer ID.
      - Export: `export ASC_API_KEY_ID=...` and `export ASC_API_ISSUER_ID=...`.
      - Place the .p8 file at `~/.appstoreconnect/private_keys/AuthKey_<KEY_ID>.p8`.
   5. Open the project in Xcode: `npm run cap:open --workspace=@tourcompanion/ios`
      - Select the App target → Signing & Capabilities.
      - Tick "Automatically manage signing". Select your Team.
      - Xcode generates the provisioning profile.

   Build + Upload:
   ```bash
   cd TourCompanion/packages/ios
   npm run release:archive   # ~5 min — builds .xcarchive
   npm run release:export    # ~30 s — produces build/export/App.ipa
   npm run release:upload    # ~3 min — uploads to ASC
   ```

   TestFlight propagation: 10-30 min after upload, build appears in ASC →
   TestFlight tab. Add internal testers + invite. They install via the
   TestFlight iOS app.
   ```

6. **`packages/ios/README.md`** — add a short "Release" section that points to `TESTFLIGHT.md`.

7. **Verification — no-signing release archive smoke-test:**
   The full `release:archive` will fail without a real signing identity. Add a `release:archive:nosign` script for CI/sanity:
   ```json
   "release:archive:nosign": "npm run build:web && npm run cap:sync && xcodebuild -workspace ios/App/App.xcworkspace -scheme App -sdk iphonesimulator -configuration Release -destination 'generic/platform=iOS Simulator' build CODE_SIGNING_ALLOWED=NO | tail -30"
   ```
   Run this to prove Release config compiles cleanly. (Real device archive needs signing; that's an Owner step.)

### Verification Checklist

- [ ] `Info.plist` contains `CFBundleShortVersionString=1.0.0`, `CFBundleVersion=1`, `CFBundleDisplayName=TourCompanion`
- [ ] `ExportOptions.plist` exists at `packages/ios/ios/App/ExportOptions.plist`
- [ ] `packages/ios/.gitignore` includes `build/`
- [ ] `package.json` adds `release:archive`, `release:export`, `release:upload`, `release:archive:nosign` scripts
- [ ] `TESTFLIGHT.md` exists with the 5-step prereqs + 3-command build sequence
- [ ] `npm run release:archive:nosign` exits 0 with `BUILD SUCCEEDED` (this proves Release config compiles)
- [ ] `npm test` — 83 tests still pass
- [ ] `npm run typecheck` green
- [ ] `xcodebuild ... build CODE_SIGNING_ALLOWED=NO` (Debug iphonesimulator) still green
- [ ] No Python changes
- [ ] No `index.html` changes

### Flags Bob Must Not Guess At

- **`REPLACE_WITH_TEAM_ID`** stays literal in committed file. Owner edits post-signup.
- **`release:archive` (real)** will fail in this agent session — no signing identity. Use `release:archive:nosign` for verification.
- **`release:upload`** uses env vars `ASC_API_KEY_ID` + `ASC_API_ISSUER_ID`. Document in TESTFLIGHT.md.
- **CFBundleVersion** must be a monotonically increasing integer per TestFlight upload. v1 = `1`. Bumping to `2` for the next upload is the Owner's responsibility.
- **No "app icon swap" implementation** — Step 19 already documented the path.

---

Architect approval: [x] Pre-approved.
