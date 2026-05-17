# Architect Brief

## Initiative — Standalone iOS Version (continued)

Steps 8-17 complete. Now Step 18.

---

## Step 18 — Offline Leaflet Tile Cache (iOS)

**Scope:** On iOS, every OSM tile request is intercepted: if the tile is in Filesystem cache, serve from local disk; otherwise fetch over network, save, then serve. Multi-day trips revisiting the same map area survive a no-signal period. No new UI — caching is transparent and on-demand. Web behavior unchanged.

### Approach

Override `L.TileLayer.prototype.createTile` (or the simpler `getTileUrl`) on iOS only, after Leaflet is loaded. The custom layer:

1. Computes the tile URL the standard way.
2. Hashes the URL → cache key (`tile-<hash>.png`).
3. Checks `Filesystem` for the file in `Directory.Cache/tiles/`.
4. If present → assign image src to the local `webPath` from `Filesystem.getUri`.
5. If absent → `fetch` the tile, write to Filesystem, then assign src.

### Files

```
packages/ios/src/runtime/tiles/
  index.ts        # installTileCache() — call after Leaflet is global
  cache.ts        # readTile, writeTile, urlToKey
```

`cache.ts`:

```ts
import { Filesystem, Directory } from "@capacitor/filesystem";

const TILE_DIR = "tiles";

/** Deterministic short key from a tile URL. */
export function urlToKey(url: string): string {
  // Cheap stable hash — Web Crypto SHA-1 isn't sync, so use FNV-1a 32-bit.
  let h = 0x811c9dc5;
  for (let i = 0; i < url.length; i++) {
    h ^= url.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

export async function readTileUri(url: string): Promise<string | null> {
  const key = urlToKey(url);
  try {
    const r = await Filesystem.getUri({
      path: `${TILE_DIR}/${key}.png`,
      directory: Directory.Cache,
    });
    // getUri does not check existence — confirm by stat.
    await Filesystem.stat({ path: `${TILE_DIR}/${key}.png`, directory: Directory.Cache });
    // Convert file:// to a webview-safe URI.
    return r.uri.replace(/^file:\/\//, "capacitor://localhost/_capacitor_file_");
  } catch {
    return null;
  }
}

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
```

`index.ts`:

```ts
import { readTileUri, writeTile } from "./cache";

declare const L: any;

export function installTileCache(): void {
  if (!(window as any).L) return;
  const TileLayer = (window as any).L.TileLayer;
  const origCreateTile = TileLayer.prototype.createTile;

  TileLayer.prototype.createTile = function (coords: any, done: any) {
    const tile = document.createElement("img");
    const url = this.getTileUrl(coords);

    (async () => {
      let src = await readTileUri(url);
      if (src) {
        tile.src = src;
        done(null, tile);
        return;
      }
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error("tile_http_" + res.status);
        const blob = await res.blob();
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = String(reader.result).replace(/^data:[^,]+,/, "");
          const cached = await writeTile(url, base64);
          tile.src = cached;
          done(null, tile);
        };
        reader.readAsDataURL(blob);
      } catch (e) {
        // Fall back to plain network URL (will fail gracefully if offline).
        tile.src = url;
        done(null, tile);
      }
    })();

    return tile;
  };
}
```

### Wire from `entry.ts`

After all other init, in the same DOMContentLoaded block (after Leaflet's `<script>` has loaded — Leaflet is loaded via CDN `<script>` in `index.html`, and DOMContentLoaded fires after `<head>` scripts):

```ts
import { installTileCache } from "./tiles";

// After existing overrides:
installTileCache();
```

If Leaflet is loaded lazily or after DOMContentLoaded, wrap in a 200ms poll:
```ts
const tryInstall = () => {
  if ((window as any).L?.TileLayer) { installTileCache(); return; }
  setTimeout(tryInstall, 200);
};
tryInstall();
```

Use the polling form — safe in both cases.

### Verification Checklist

- [ ] `packages/ios/src/runtime/tiles/{index.ts,cache.ts}` exist
- [ ] `entry.ts` calls `installTileCache()` via the poll-until-Leaflet-ready pattern
- [ ] `urlToKey` is deterministic — same URL produces same key (add a quick unit test in `packages/ios/src/runtime/tiles/cache.test.ts` for the pure hash function only; mock Filesystem if testing read/write)
- [ ] `npm run build` green
- [ ] `npm run typecheck` green
- [ ] `xcodebuild ... build CODE_SIGNING_ALLOWED=NO` green
- [ ] 79+ tests pass
- [ ] No Python changes
- [ ] No `index.html` edits in this step

### Flags Bob Must Not Guess At

- **Don't import Leaflet from core.** It's loaded as a CDN script in `index.html`; reach via `window.L`.
- **`Directory.Cache`** (not `Directory.Data`) — iOS may purge under storage pressure. Acceptable for tiles.
- **Hashing** — FNV-1a is sufficient. Don't use Web Crypto (async, overkill for non-cryptographic).
- **`capacitor://localhost/_capacitor_file_<path>`** — the Capacitor 6 convention for serving filesystem files into WKWebView. If the iOS version uses a different scheme, refer to `node_modules/@capacitor/ios/CapacitorWebView/*.swift` for the actual prefix. Cap 6 uses `capacitor://localhost/_capacitor_file_/...`. Bob: verify by grepping Capacitor source or test in simulator (if available); if Bob can't verify in simulator, ship as-is — fallback path catches errors.
- **No tile preload / bulk download UI** — out of scope. v2 feature.
- **WKWebView NSAppTransportSecurity** — Apple allows `https://*.tile.openstreetmap.org` by default. No Info.plist change.

---

Architect approval: [x] Pre-approved.
