# Review Feedback — Step 19
Date: 2026-05-16
Ready for Builder: YES

## Must Fix
None.

## Should Fix
Two small notes for BUILD-LOG follow-up — do not gate this step:

- `index.html:1115` — `-webkit-overflow-scrolling: touch` is a deprecated iOS-Safari
  property (no-op on modern WKWebView). Harmless, but log to BUILD-LOG so a future
  cleanup pass can drop it. The `overscroll-behavior-y: none` rule on the same line
  is what actually kills the rubber-band.
- `entry.ts:103` — the `?? "stop"` default after `openVoiceModal?.()` means a
  *missing* helper resolves "save the recording", and the *missing-DOM-node* path
  inside `openVoiceModal` (index.html:3511) also resolves `"stop"`. Two layers of
  the same fallback — consistent and safe, but worth a one-line comment so the
  next reader doesn't suspect dead code. Inline fix is 30 seconds; otherwise log.

## Escalate to Architect
- **`maximum-scale=1` accessibility (Bob's open question).** This disables iOS
  pinch-zoom globally in the SPA. For an app-style native shell, the conventional
  choice — and Bob's call matches the brief. However, WCAG 2.1 SC 1.4.4 ("Resize
  text") expects users to be able to zoom to 200%. The same `<meta>` ships in the
  public web build at `/` (where `body.is-ios` never fires but the viewport meta
  still applies), so the zoom-lock leaks to web users. Arch + Owner call:
  (a) accept as-is, (b) drop `maximum-scale=1` and rely on `touch-action:
  manipulation` on buttons to suppress double-tap zoom, or (c) inject the meta
  dynamically from `entry.ts` so it only applies on iOS. Not a code bug — a
  product decision about accessibility posture.

## Cleared
Reviewed `packages/ios/package.json` (Cap 6 pinned; `@capacitor/status-bar
^6.0.3` and `@capacitor/splash-screen ^6.0.4` added), `capacitor.config.ts`
(plugins.StatusBar + plugins.SplashScreen as briefed), `entry.ts` (imports +
fire-and-forget async IIFE wrapping `StatusBar.setStyle` and `SplashScreen.hide`,
voice override using `openVoiceModal` in place of `window.confirm`),
`index.html` viewport meta (`viewport-fit=cover, maximum-scale=1` appended),
`body.is-ios`-scoped CSS block — all class names verified against real DOM
(`mobile-app-bar`, `app-header`, `day-strip-mobile`, `nav-tab-wrap`, `as-overlay`,
`modal-backdrop`); `#voice-modal` markup reusing the existing
`.as-card`/`.as-actions`/`.as-btn-cancel`/`.as-btn-save` design system; and
`window.openVoiceModal` helper with defensive null-node fallback. Web's
`recordVoice` (index.html:2930) untouched. `Podfile.lock` shows
`CapacitorStatusBar (6.0.3)` + `CapacitorSplashScreen (6.0.4)`. Builder reports
xcodebuild green, 83 tests pass, typecheck green. No Python, no schema, no new
endpoints, no test regressions. Step 19 is clear.
