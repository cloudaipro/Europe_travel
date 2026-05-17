// Native foreground geolocation wrapper. `getCoords()` is the only export;
// it never throws — permission denial, timeout, or any plugin error all
// resolve to `null` so the check-in flow can still record an empty body.
//
// v1 is when-in-use only (no background tracking). Accepts coarse-accuracy
// fixes (iOS Reduced Accuracy) and a 30s-old cached fix to avoid hanging
// when GPS is slow indoors.

import { Geolocation } from "@capacitor/geolocation";

/** Returns {lat,lng} or null if permission denied / timed out. Never throws. */
export async function getCoords(): Promise<{ lat: number; lng: number } | null> {
  try {
    const perm = await Geolocation.requestPermissions();
    if (perm.location !== "granted" && perm.coarseLocation !== "granted") return null;
    const pos = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 8000,
      maximumAge: 30000,
    });
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch {
    return null;
  }
}
