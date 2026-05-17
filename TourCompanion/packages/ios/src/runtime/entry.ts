// iOS runtime entry — bootstraps the offline TripStore, settings store,
// and the /api/* fetch interceptor that turns the web SPA into a
// self-contained iOS app. Bundled by build.mjs into www/ios.bundle.js
// (IIFE) and injected into <head> of www/index.html by copy-web.mjs.
//
// Critical sequencing: the fetch interceptor is installed SYNCHRONOUSLY at
// script-load (before the SPA's inline boot kicks off any /api/* fetch),
// and it awaits a TripStore promise per-request. That decouples
// "interceptor available" from "SQLite ready" — the SPA can begin booting
// immediately and the first /api/* call just blocks the extra few ms while
// the SQLite plugin initialises.

import { Capacitor } from "@capacitor/core";
import { createSettings, type TripStore } from "@tourcompanion/core";
import { initSqliteStore } from "./sqlite/index.js";
import { keychainStore } from "./keychain/index.js";
import { installFetchInterceptor } from "./fetch-interceptor.js";
import { capturePhoto, startVoice, stopVoice } from "./capture/index.js";
// ./global.d.ts contributes ambient Window type augmentations; no runtime emit.

// Synchronous on iOS: build the TripStore promise, install interceptor +
// TCSettings before the SPA's inline scripts run. The bundle ships in the
// web SPA artefact too, so skip everything off-iOS.
if (Capacitor.getPlatform() === "ios") {
  const storePromise: Promise<TripStore> = (async () => {
    const store = await initSqliteStore();
    window.TCStore = store;
    return store;
  })().catch((err) => {
    console.error("[TC iOS] TripStore init failed", err);
    throw err;
  });

  window.TCSettings = createSettings(keychainStore);
  installFetchInterceptor(() => storePromise);

  // Mark the body once the DOM exists so iOS-only UI (settings gear) shows.
  const markIos = () => document.body?.classList.add("is-ios");
  if (document.body) markIos();
  else document.addEventListener("DOMContentLoaded", markIos, { once: true });

  storePromise.then(
    () => console.info("[TC iOS] runtime ready"),
    () => {},
  );

  // Step 16 — override the SPA's demo addPhoto / recordVoice handlers with
  // native capture once the DOM (and thus the SPA's function declarations +
  // iOS bridge globals) is in place. We deliberately register on
  // DOMContentLoaded rather than at script-load: the SPA's <script> is
  // parsed after this bundle runs, so its top-level decls aren't on window
  // yet at this point.
  const installNativeCapture = () => {
    (window as any).addPhoto = async (day: number, idx: number) => {
      const stopId = (window as any)._stopIdFor?.(day, idx);
      if (!stopId) return;
      try {
        const { path } = await capturePhoto();
        const res = await fetch(`/api/stops/${stopId}/photos-link`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ path }),
        });
        if (!res.ok) throw new Error(`photo save failed (${res.status})`);
        const state = (window as any).STATE;
        if (state) {
          state.stop_photos ??= {};
          state.stop_photos[`${day}-${idx}`] ??= [];
          state.stop_photos[`${day}-${idx}`].push(path);
        }
        (window as any).showSnack?.("📷 Photo captured");
        (window as any).renderTour?.();
        (window as any).renderMemory?.();
      } catch (e: any) {
        (window as any).showSnack?.("Photo failed: " + (e?.message ?? e));
      }
    };

    (window as any).recordVoice = async (day: number, idx: number) => {
      const stopId = (window as any)._stopIdFor?.(day, idx);
      if (!stopId) return;
      try {
        await startVoice();
        // v1 UX: WKWebView native confirm gates stop. Step 19 replaces with a styled modal.
        const proceed = window.confirm("Recording… tap OK to stop");
        const { path, transcript } = await stopVoice();
        if (!proceed) {
          (window as any).showSnack?.("🎤 Cancelled");
          return;
        }
        const res = await fetch(`/api/stops/${stopId}/voice`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ transcript, audio_path: path }),
        });
        if (!res.ok) throw new Error(`voice save failed (${res.status})`);
        const state = (window as any).STATE;
        if (state) {
          state.voice_notes ??= {};
          state.voice_notes[`${day}-${idx}`] = transcript || "(audio note)";
        }
        (window as any).showSnack?.("🎤 Voice note saved");
        (window as any).renderTour?.();
        (window as any).renderMemory?.();
      } catch (e: any) {
        (window as any).showSnack?.("Voice failed: " + (e?.message ?? e));
      }
    };
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installNativeCapture, { once: true });
  } else {
    installNativeCapture();
  }
}
