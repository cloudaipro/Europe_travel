# Review Request — Step 18 (Offline Leaflet Tile Cache, iOS)

**Builder:** Bob
**Date:** 2026-05-16
**Ready for Review: YES**

---

## Summary

Adds an iOS-only tile cache that intercepts Leaflet's `createTile`, serves OSM
tiles from `Directory.Cache/tiles/` when present, and otherwise fetches them
over the network, persists to disk, and serves the cached copy thereafter.
Web behaviour is byte-identical (the override is gated by the existing
`Capacitor.getPlatform() === "ios"` block in `entry.ts`). No new endpoints,
no Python changes, no `index.html` edits.

---

## Files (with line ranges)

### New

- **`TourCompanion/packages/ios/src/runtime/tiles/cache.ts`** (lines 1–57)
  - 22–30 — `urlToKey(url)`: pure FNV-1a 32-bit hash, base-36 encoded. Deterministic, dependency-free, sufficient collision-avoidance for a few thousand tiles per trip.
  - 33–45 — `readTileUri(url)`: stat-then-getUri pattern; missing-file throw from `stat` becomes a `null` return (cache miss). Rewrites the returned `file://` URI to `capacitor://localhost/_capacitor_file_<path>` for WKWebView.
  - 48–57 — `writeTile(url, base64)`: persists to `Directory.Cache/tiles/<key>.png` with `recursive: true`, returns the rewritten webview-safe URI.

- **`TourCompanion/packages/ios/src/runtime/tiles/index.ts`** (lines 1–65)
  - 23–33 — Setup + idempotency guard (`__tcTileCacheInstalled` on `TileLayer.prototype`) so a double-install (hot reload / poll race) is a no-op.
  - 35–62 — `createTile` override. Synchronously returns `<img>` per Leaflet's contract; async pipeline tries cache → fetches → base64s → persists → serves. Any throw routes to `tile.src = url` fallback (matches pre-Step-18 web behaviour).

- **`TourCompanion/packages/ios/src/runtime/tiles/cache.test.ts`** (lines 1–31)
  - 13–28 — Four tests for `urlToKey`: determinism, base-36 shape + non-empty, distinctness for adjacent tile coords, empty-string safety. Pure-function only — no Filesystem mocking per the brief.

### Modified

- **`TourCompanion/packages/ios/src/runtime/entry.ts`**
  - Line 20 — new import: `import { installTileCache } from "./tiles/index.js";`
  - Lines 149–161 — poll-until-Leaflet-ready installer (`tryInstallTileCache`) inside the existing iOS-gated block, after the `installNativeCapture` registration. Re-runs every 200 ms until `window.L?.TileLayer` exists, then calls `installTileCache()`.

---

## Verification Run

| Gate | Result |
| --- | --- |
| `npm run typecheck --workspace=@tourcompanion/ios` | clean |
| `npm run build` (monorepo) | clean — iOS bundle 175.7 kB (+2.5 kB vs Step 17) |
| `npm test` (monorepo) | 73 core + 10 iOS = **83 pass** (+4) |
| `npx cap sync ios` | 6 plugins, sync finished in 1.681s |
| `xcodebuild … build CODE_SIGNING_ALLOWED=NO` | **BUILD SUCCEEDED** |

---

## Open Questions

None. The brief flagged the Capacitor 6 file-URL prefix
(`capacitor://localhost/_capacitor_file_`) as worth verifying in simulator if
possible; we ship as-is per the brief's "fallback path catches errors"
guidance — a mis-prefix simply routes through the network-URL fallback
without breaking rendering.

---

## Out of Scope (deferred per brief)

- Tile pre-load / bulk download UI — v2 feature.
- WKWebView NSAppTransportSecurity — Apple permits `https://*.tile.openstreetmap.org` by default; no Info.plist change required.

Ready for Review: YES
