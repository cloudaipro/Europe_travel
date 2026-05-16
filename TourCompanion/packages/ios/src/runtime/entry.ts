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
}
