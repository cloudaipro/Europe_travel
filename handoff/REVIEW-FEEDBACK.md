# Review Feedback — Step 18
Date: 2026-05-16
Ready for Builder: YES

## Must Fix
None.

## Should Fix
Two observations logged here for the record. Neither warrants a change in this step.

- `entry.ts:155-162` — `tryInstallTileCache` polls every 200 ms with no upper bound. On iOS, Leaflet ships from the bundled CDN `<script>` so this terminates within the first frame or two; if it never resolves, the cost is a silent 5 Hz no-op timer. Matches the brief's "use the polling form — safe in both cases." No action.
- `tiles/index.ts:53-54` — on a successful fetch+write, `tile.src` is assigned the rewritten `capacitor://localhost/_capacitor_file_...` URI. If the Capacitor 6 prefix is ever wrong, the freshly-fetched tile renders broken even though the bytes are on disk. The brief explicitly accepted this ("ship as-is — fallback path catches errors"); re-fetching on every miss would be wasteful and the `readTileUri` path on the next render hits the same prefix, so behaviour is consistent. No action.

## Escalate to Architect
None.

## Cleared

Reviewed `tiles/cache.ts`, `tiles/index.ts`, `tiles/cache.test.ts`, and the `entry.ts` diff against the Step 18 brief.

- **`cache.ts:24-31`** — `urlToKey` is deterministic FNV-1a 32-bit, base-36, dependency-free; `Math.imul` correctly handles 32-bit overflow.
- **`cache.ts:34-45`** — `readTileUri` uses `Filesystem.stat` as the existence probe (the brief's required pattern); the throw on missing file is caught and converted to `null`. Bob calls `stat` before `getUri` rather than after, as in the brief pseudo-code, but both calls are inside the same try/catch so the observable behaviour is identical. The `file://` → `capacitor://localhost/_capacitor_file_` rewrite is applied.
- **`cache.ts:48-57`** — `writeTile` persists base64 to `Directory.Cache/tiles/<key>.png` with `recursive: true` and returns the webview-safe URI. Matches brief exactly.
- **`tiles/index.ts:21-29`** — installer guards on `L?.TileLayer?.prototype?.createTile` before patching and sets the `__tcTileCacheInstalled` sentinel on `TileLayer.prototype`; a double-install (hot reload / poll race) is a no-op. Sentinel scoped to the prototype, not the instance — correct, since the patch is on the prototype.
- **`tiles/index.ts:31-64`** — `createTile` returns the `<img>` synchronously per Leaflet's contract; the async IIFE attempts cache → fetch → base64 → persist → serve. Any throw (including the added `reader.onerror`, `!res.ok` and `writeTile` failures) routes through the single catch to `tile.src = url` plus `done(null, tile)` — preserving pre-Step-18 web behaviour. The post-persist `tile.src` is the cached webview-safe URI, not the raw `file://`.
- **`cache.test.ts:10-30`** — four pure tests for `urlToKey`: determinism, base-36 shape + non-empty, distinctness across adjacent tile coords, empty-string safety. No Filesystem mocking, per brief.
- **`entry.ts:20, 150-162`** — installer is imported once and invoked from inside the existing `Capacitor.getPlatform() === "ios"` block via the 200 ms poll-until-`window.L.TileLayer`. Web SPA bundle is unaffected (the entire iOS block is gated).
- **Security.** Tile URLs originate from `this.getTileUrl(coords)` (Leaflet-controlled, not user input). `urlToKey` returns base-36 alphanumerics only, so no path-traversal risk on the cache key. base64 is written via `Filesystem.writeFile`, not via shell/eval.
- **Drift.** None. Bob added a defensive `reader.onerror` and a top-of-function `if (!L?.TileLayer?.prototype?.createTile) return;` guard — both improvements within scope. The brief's `getUri`/`stat` order was inverted; equivalent under the shared try/catch.
- **Verification reproduced locally.**
  - `npm run typecheck --workspace=@tourcompanion/ios` — green (no diagnostics from `tsc --noEmit`).
  - `npm test --workspace=@tourcompanion/ios` — **10/10 pass** (4 new `urlToKey` tests + 6 existing plan-handler), no regressions.
  - Bob's `npm run build` (175.7 kB iOS bundle, +2.5 kB), `cap sync ios`, and `xcodebuild ... CODE_SIGNING_ALLOWED=NO` BUILD SUCCEEDED reported in REVIEW-REQUEST.
- **Out-of-scope hygiene.** `git status` confirms zero `index.html` changes and zero Python changes; only `entry.ts` was modified and the new `tiles/` directory was added. No new endpoints, no new permissions, no Info.plist edits.

Step 18 is clear.
