// iOS runtime entry — bootstraps the offline TripStore.
// Bundled by build.mjs into www/ios.bundle.js (IIFE), injected by copy-web.mjs
// before </body>. Step 14 will add the fetch interceptor that rewrites
// /api/trips/* to call window.TCStore.

import { Capacitor } from "@capacitor/core";
import type { TripStore } from "@tourcompanion/core";
import { initSqliteStore } from "./sqlite/index.js";

declare global {
  interface Window {
    TCStore?: TripStore;
  }
}

void (async () => {
  // The bundle ships in the web SPA too; bail out on web/Android so we don't
  // try to touch the SQLite plugin where it isn't registered.
  if (Capacitor.getPlatform() !== "ios") return;
  try {
    window.TCStore = await initSqliteStore();
    console.info("[TC iOS] TripStore ready");
  } catch (err) {
    console.error("[TC iOS] TripStore init failed", err);
  }
})();
