# Architect Brief

## Initiative — Standalone iOS Version (continued)

Steps 8-16 complete. Now Step 17.

---

## Step 17 — Native Geolocation + GPS Check-ins on iOS

**Scope:** Install `@capacitor/geolocation`. Add `NSLocationWhenInUseUsageDescription` to Info.plist. Override `window.checkIn` on iOS to fetch current GPS coords before POSTing to `/api/stops/{id}/checkin` so the local `lat`/`lng` are stored on the check_in row. Web behavior unchanged (web `checkIn` posts empty body — server-side has no GPS).

The fetch interceptor already accepts `lat`/`lng` in the checkIn body (Step 14).

### Build Order

1. `npm install @capacitor/geolocation --workspace=@tourcompanion/ios && npx cap sync ios` from `packages/ios/`.

2. Add to `packages/ios/ios/App/App/Info.plist`:
   ```xml
   <key>NSLocationWhenInUseUsageDescription</key>
   <string>Tag your check-ins with where you visited.</string>
   ```

3. New file `packages/ios/src/runtime/geo/index.ts`:
   ```ts
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
   ```

4. Update `packages/ios/src/runtime/entry.ts` — add inside the DOMContentLoaded block, after the photo/voice overrides:
   ```ts
   import { getCoords } from "./geo";

   (window as any).checkIn = async (day: number, idx: number) => {
     const stopId = (window as any)._stopIdFor?.(day, idx);
     if (!stopId) return;
     const coords = await getCoords();   // null on denial
     try {
       const res = await fetch(`/api/stops/${stopId}/checkin`, {
         method: "POST",
         headers: { "content-type": "application/json" },
         body: JSON.stringify(coords ?? {}),
       });
       if (!res.ok) throw new Error(`check-in failed (${res.status})`);
       const s = (window as any).STATE;
       (s.check_ins[day] ??= []).includes(idx) || s.check_ins[day].push(idx);
       s.current_stop_index[day] = idx + 1;
       (window as any).showSnack(coords ? "📍 Checked in (GPS)" : "📍 Checked in");
       (window as any).renderTour(); (window as any).renderMemory();
     } catch (e: any) {
       (window as any).showSnack("Check-in failed: " + (e?.message ?? e));
     }
   };
   ```

5. Add `window.checkIn` to the `// iOS bridge` block in `index.html` if needed. (`checkIn` is a top-level `async function` declaration — already on window. Verify with grep.)

### Verification Checklist

- [ ] `@capacitor/geolocation@^6` installed, visible in `Podfile.lock`
- [ ] `NSLocationWhenInUseUsageDescription` in `Info.plist`
- [ ] `packages/ios/src/runtime/geo/index.ts` exports `getCoords`
- [ ] `entry.ts` overrides `window.checkIn` on iOS, posts `{lat,lng}` when available, `{}` when denied
- [ ] `npm run build` green
- [ ] `npm run typecheck` green
- [ ] `xcodebuild ... build CODE_SIGNING_ALLOWED=NO` green
- [ ] 79 tests still pass
- [ ] No Python changes
- [ ] No regressions in `index.html` (no edits this step unless `checkIn` is not window-accessible)

### Flags Bob Must Not Guess At

- **Permission denial is non-fatal.** `getCoords()` returns null; check-in still records with empty body.
- **No background location.** Only foreground when-in-use. v1 does not need always-on tracking.
- **Coarse fallback** — `requestPermissions` may grant only `coarseLocation` (iOS Reduced Accuracy). Still record those coords.
- **`maximumAge: 30000`** — accept a 30s-old fix to avoid hanging when GPS is slow.
- **No silent retries on timeout** — single attempt, then null.

---

Architect approval: [x] Pre-approved.
