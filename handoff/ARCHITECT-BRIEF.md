# Architect Brief

## Initiative — Standalone iOS Version (continued)

Steps 8-18 complete. Now Step 19.

---

## Step 19 — iOS UX Polish

**Scope:** Safe-area handling, status bar styling, splash screen config, native voice modal (replace `window.confirm`), disable rubber-band overscroll, polish chrome interactions. App icon swap is documented as a manual Owner step (artwork required) — not implemented here.

### Build Order

1. **Plugins (Cap 6):**
   ```bash
   npm install @capacitor/status-bar @capacitor/splash-screen --workspace=@tourcompanion/ios
   npx cap sync ios
   ```

2. **Status bar + splash config — `packages/ios/capacitor.config.ts`:**
   ```ts
   const config: CapacitorConfig = {
     appId: "com.cloudaipro.tourcompanion",
     appName: "TourCompanion",
     webDir: "www",
     server: { androidScheme: "https" },
     plugins: {
       StatusBar: { style: "DARK", overlaysWebView: false, backgroundColor: "#0e0f12" },
       SplashScreen: {
         launchShowDuration: 1500,
         backgroundColor: "#0e0f12",
         showSpinner: false,
         splashFullScreen: true,
         splashImmersive: true
       }
     }
   };
   ```

3. **Boot wiring — `packages/ios/src/runtime/entry.ts`:**
   ```ts
   import { StatusBar, Style } from "@capacitor/status-bar";
   import { SplashScreen } from "@capacitor/splash-screen";

   // After window.TCStore set, before installFetchInterceptor:
   try { await StatusBar.setStyle({ style: Style.Dark }); } catch {}
   try { await SplashScreen.hide({ fadeOutDuration: 200 }); } catch {}
   ```

4. **Safe-area CSS — `packages/web/public/index.html`:**

   Locate the `<style>` block. Append a small `body.is-ios` scoped block:
   ```css
   body.is-ios .app-bar, body.is-ios .mobile-app-bar { padding-top: env(safe-area-inset-top, 0px); }
   body.is-ios .bottom-tabs, body.is-ios .mobile-tabs { padding-bottom: env(safe-area-inset-bottom, 0px); }
   body.is-ios { overscroll-behavior-y: none; -webkit-overflow-scrolling: touch; }
   body.is-ios .modal-overlay { padding: env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px) env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px); }
   ```
   Grep `index.html` for actual class names of the app bar and bottom tab strip first (likely `mob-app-bar` or `mobile-app-bar` or similar). Use the real class names.

   Also append to `<head>`:
   ```html
   <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1">
   ```
   If a `<meta name="viewport">` already exists, **modify** the existing one — add `viewport-fit=cover, maximum-scale=1` to the content. Do not duplicate.

5. **Voice recording modal — replace `window.confirm`:**

   In `packages/web/public/index.html`, add a hidden modal markup near the existing modals (grep for `as-overlay` / `modal-overlay`):
   ```html
   <div id="voice-modal" class="as-overlay hidden" role="dialog" aria-modal="true">
     <div class="as-card">
       <h3>Recording…</h3>
       <p id="voice-elapsed">00:00</p>
       <div class="as-actions">
         <button id="voice-cancel" class="ghost">Cancel</button>
         <button id="voice-stop" class="primary">Stop &amp; Save</button>
       </div>
     </div>
   </div>
   ```
   Reuse existing card classes — grep what's actually in the file (`as-card`/`as-actions`/etc.).

   Expose two helpers via the `// iOS bridge` block:
   ```js
   window.openVoiceModal = () => new Promise(resolve => {
     const m = document.getElementById("voice-modal");
     const elapsed = document.getElementById("voice-elapsed");
     const t0 = Date.now();
     const timer = setInterval(() => {
       const s = Math.floor((Date.now() - t0) / 1000);
       elapsed.textContent = `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;
     }, 250);
     const close = (action) => {
       clearInterval(timer);
       m.classList.add("hidden");
       document.getElementById("voice-stop").onclick = null;
       document.getElementById("voice-cancel").onclick = null;
       resolve(action);
     };
     document.getElementById("voice-stop").onclick = () => close("stop");
     document.getElementById("voice-cancel").onclick = () => close("cancel");
     m.classList.remove("hidden");
   });
   ```

6. **Update voice override in `entry.ts`:**
   Replace the `window.confirm("Recording…")` block:
   ```ts
   await startVoice();
   const action = await (window as any).openVoiceModal?.();
   const { path, transcript } = await stopVoice();
   if (action !== "stop") {
     (window as any).showSnack("🎤 Cancelled");
     return;
   }
   // ... continue with the existing fetch POST
   ```

7. **Disable iOS text selection on chrome** — append to safe-area CSS block:
   ```css
   body.is-ios .app-bar, body.is-ios .mobile-app-bar, body.is-ios .bottom-tabs, body.is-ios .mobile-tabs,
   body.is-ios button, body.is-ios .ts-tabs {
     -webkit-user-select: none; user-select: none; -webkit-touch-callout: none;
   }
   body.is-ios input, body.is-ios textarea { -webkit-user-select: text; user-select: text; }
   ```

8. **App icon — document only, do NOT implement:**
   In BUILD-LOG note that `packages/ios/ios/App/App/Assets.xcassets/AppIcon.appiconset/` currently holds Capacitor's default icon. To replace: drop a 1024×1024 PNG named `AppIcon-512@2x.png` (per Cap convention). Owner provides artwork; out of scope for this step.

### Verification Checklist

- [ ] `@capacitor/status-bar` + `@capacitor/splash-screen` installed; `Podfile.lock` shows both
- [ ] `capacitor.config.ts` has `plugins.StatusBar` + `plugins.SplashScreen`
- [ ] `entry.ts` calls `StatusBar.setStyle` + `SplashScreen.hide`
- [ ] `index.html` has `viewport-fit=cover` in viewport meta; safe-area + select CSS added
- [ ] `#voice-modal` markup present in `index.html`
- [ ] `window.openVoiceModal` exposed via iOS bridge block
- [ ] `entry.ts` voice override uses `openVoiceModal` instead of `window.confirm`
- [ ] `npm run build` green
- [ ] `npm run typecheck` green
- [ ] `xcodebuild ... build CODE_SIGNING_ALLOWED=NO` green
- [ ] 83+ tests pass
- [ ] No Python changes
- [ ] Web behavior unchanged — all new CSS scoped to `body.is-ios`; new `#voice-modal` hidden by default and only opened via `window.openVoiceModal` which is only called by iOS override path

### Flags Bob Must Not Guess At

- **App bar class names** — grep `index.html` for actual class names. Brief uses placeholders.
- **`viewport-fit=cover`** is required for `env(safe-area-inset-*)` to return non-zero values.
- **No app icon swap** — Owner artwork required. Document path for future swap.
- **`overscroll-behavior-y: none`** — prevents the rubber-band on the body. Modals can still scroll internally.

---

Architect approval: [x] Pre-approved.
