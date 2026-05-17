// Step 18 — Offline Leaflet tile cache (iOS).
//
// Pure URL → key hashing plus thin Filesystem read/write helpers. The
// Leaflet tile-layer override in ./index.ts uses these to serve OSM tiles
// from `Directory.Cache/tiles/` whenever a tile has been seen before;
// otherwise the tile is fetched, persisted, and then served. Multi-day
// trips revisiting the same map area survive a no-signal period.
//
// Directory.Cache is correct: iOS may evict under storage pressure, which
// is the right policy for tiles (regenerable, not user-authored data).
// Hashing is FNV-1a 32-bit — synchronous, dependency-free, and ample for
// collision-avoidance on a few thousand tile URLs per trip.
//
// The `capacitor://localhost/_capacitor_file_<path>` rewrite is the
// Capacitor 6 convention for serving filesystem files into WKWebView; the
// `file://` URI returned by Filesystem is not directly loadable by the
// webview.

import { Filesystem, Directory } from "@capacitor/filesystem";

const TILE_DIR = "tiles";

/** Deterministic 32-bit FNV-1a hash, base-36 encoded. Same URL → same key. */
export function urlToKey(url: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < url.length; i++) {
    h ^= url.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/** Resolve a cached tile to a webview-loadable URI, or null when absent. */
export async function readTileUri(url: string): Promise<string | null> {
  const key = urlToKey(url);
  const path = `${TILE_DIR}/${key}.png`;
  try {
    // stat throws when the file is missing — that's our existence check.
    await Filesystem.stat({ path, directory: Directory.Cache });
    const r = await Filesystem.getUri({ path, directory: Directory.Cache });
    return r.uri.replace(/^file:\/\//, "capacitor://localhost/_capacitor_file_");
  } catch {
    return null;
  }
}

/** Persist a tile payload (base64) and return the webview-loadable URI. */
export async function writeTile(url: string, base64: string): Promise<string> {
  const key = urlToKey(url);
  const w = await Filesystem.writeFile({
    path: `${TILE_DIR}/${key}.png`,
    data: base64,
    directory: Directory.Cache,
    recursive: true,
  });
  return w.uri.replace(/^file:\/\//, "capacitor://localhost/_capacitor_file_");
}
