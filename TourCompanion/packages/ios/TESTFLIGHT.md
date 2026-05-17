# Ship to TestFlight — Owner Runbook

This guide takes a fresh checkout to a build live in TestFlight. The agent has
wired every script; the steps below are the Apple-side actions only the Owner
can perform.

## Prerequisites (one-time, ~30 min of clicking + 24-48h waiting on Apple)

1. **Apple Developer Program** — $99/yr —
   https://developer.apple.com/programs/enroll/
   Apple processes the membership within 24-48 hours. You cannot upload to
   TestFlight before this finishes.

2. **Find your Team ID** — https://developer.apple.com/account → Membership.
   Copy the 10-character Team ID. Open
   `packages/ios/ios/App/ExportOptions.plist` and replace the literal
   `REPLACE_WITH_TEAM_ID` with your real Team ID. Commit that change.

3. **Create the App Store Connect record** —
   https://appstoreconnect.apple.com → My Apps → +
   - Platform: iOS
   - Bundle ID: `com.cloudaipro.tourcompanion`
   - SKU: `tourcompanion-ios`
   - Name: `TourCompanion`

4. **Create an ASC API Key** — App Store Connect → Users + Access → Keys → +
   - Role: App Manager (or higher)
   - Download the `.p8` file — Apple only lets you download it once.
   - Note the **Key ID** and the **Issuer ID**.
   - Place the key file at:
     `~/.appstoreconnect/private_keys/AuthKey_<KEY_ID>.p8`
   - Export the env vars in your shell profile:
     ```bash
     export ASC_API_KEY_ID=ABC123XYZ
     export ASC_API_ISSUER_ID=00000000-0000-0000-0000-000000000000
     ```

5. **Hook up signing in Xcode** —
   ```bash
   npm run cap:open --workspace=@tourcompanion/ios
   ```
   - Select the `App` target → Signing & Capabilities.
   - Tick **Automatically manage signing**. Select your Team.
   - Xcode generates the provisioning profile and stores it on your machine.
   - Close Xcode.

## Build + Upload (every release)

```bash
cd TourCompanion/packages/ios
npm run release:archive   # ~5 min — produces build/TourCompanion.xcarchive
npm run release:export    # ~30 s  — produces build/export/App.ipa
npm run release:upload    # ~3 min — uploads to App Store Connect
```

## After Upload

- TestFlight processing takes 10-30 min. Refresh
  https://appstoreconnect.apple.com → My Apps → TourCompanion → TestFlight.
- Once the build shows "Ready to Submit", add yourself + testers to an
  internal testing group and send invites.
- Testers install the **TestFlight** iOS app from the App Store, accept the
  invite email, then install TourCompanion from inside TestFlight.

## Bumping the build for the next upload

App Store Connect requires every TestFlight upload to have a **strictly
increasing `CFBundleVersion`**. The marketing version (`1.0.0`) can stay; the
build number cannot.

Update `CURRENT_PROJECT_VERSION` in
`packages/ios/ios/App/App.xcodeproj/project.pbxproj` (Debug + Release blocks)
before each upload — `1 → 2 → 3 → ...`. Commit that bump alongside the change
you're shipping.

## Sanity check without signing

If you want to prove the Release configuration compiles before going through
the full archive/export/upload chain (for example after a dependency change):

```bash
npm run release:archive:nosign
```

This builds the Release config against the iOS Simulator with code signing
disabled. It does not produce a shippable artifact, but it catches Release-only
compile errors fast.
