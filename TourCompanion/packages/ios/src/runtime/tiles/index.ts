// Step 18 — Leaflet tile-layer override that routes every tile request
// through the Filesystem cache (see ./cache.ts). Installed once per app
// launch, after Leaflet has been loaded via the SPA's CDN `<script>`.
//
// Strategy:
//   1. Patch L.TileLayer.prototype.createTile globally — every tile layer
//      created afterwards inherits the cached behaviour.
//   2. Compute the tile URL the standard way.
//   3. Try the Filesystem cache first; on hit, assign the local URI.
//   4. On miss, fetch over the network, base64-encode, persist, then
//      serve from the cached URI on next render.
//   5. On any fetch / write error, fall back to the plain network URL so
//      the tile still attempts to load when bandwidth comes back — the
//      web SPA's behaviour pre-Step-18.
//
// The override is iOS-only by virtue of being called from entry.ts, which
// gates on Capacitor.getPlatform() === "ios".

import { readTileUri, writeTile } from "./cache.js";

export function installTileCache(): void {
  const L = (window as any).L;
  if (!L?.TileLayer?.prototype?.createTile) return;

  const TileLayer = L.TileLayer;
  // Guard against double-install — entry.ts polls until Leaflet is ready
  // and we don't want to chain overrides on hot-reload.
  if ((TileLayer.prototype as any).__tcTileCacheInstalled) return;
  (TileLayer.prototype as any).__tcTileCacheInstalled = true;

  TileLayer.prototype.createTile = function (coords: any, done: any) {
    const tile = document.createElement("img");
    const url = this.getTileUrl(coords);

    (async () => {
      try {
        const cached = await readTileUri(url);
        if (cached) {
          tile.src = cached;
          done(null, tile);
          return;
        }
        const res = await fetch(url);
        if (!res.ok) throw new Error("tile_http_" + res.status);
        const blob = await res.blob();
        const base64: string = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () =>
            resolve(String(reader.result).replace(/^data:[^,]+,/, ""));
          reader.onerror = () => reject(reader.error ?? new Error("read_failed"));
          reader.readAsDataURL(blob);
        });
        const persisted = await writeTile(url, base64);
        tile.src = persisted;
        done(null, tile);
      } catch {
        // Fall back to plain network URL — fails gracefully if offline.
        tile.src = url;
        done(null, tile);
      }
    })();

    return tile;
  };
}
