// Ambient declarations for window globals exposed by the iOS runtime shim.
// These globals are consumed by the inline JS in packages/web/public/index.html
// (which itself has no type info — it's vanilla JS in an HTML file). Keeping
// the type union narrow surfaces shape-drift in this package's own code.

import type { TripStore, TCSettings } from "@tourcompanion/core";

declare global {
  interface Window {
    TCStore?: TripStore;
    TCSettings?: TCSettings;
  }
}

export {};
