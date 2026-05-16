# Architect Brief

## Initiative — Standalone iOS Version (continued)

Steps 8-10 complete. Now Step 11.

---

## Step 11 — Web Frontend Uses `@tourcompanion/core`

**Scope:** Move the existing `server/frontend/` into `packages/web/` and have it consume the shared `@tourcompanion/core` package. Add a small esbuild bundling step that produces a single browser IIFE exposing the core API on `window.TC` (concise namespace). Replace the inline KG-7 `toMinutes` function in `index.html` with a `window.TC.stopTimeSortKey` call to prove the wiring. Update FastAPI to serve from the new path. **Server-side LLM/Anthropic path stays in Python** — the web stack keeps server-side plan ingestion (no API key exposed in browser). All existing endpoints + features must continue to work.

### What Moves

```
TourCompanion/server/frontend/index.html  →  TourCompanion/packages/web/public/index.html
```

After move, the on-disk path `TourCompanion/server/frontend/` is **deleted** (no symlink, no duplicate).

### New Files

```
TourCompanion/packages/web/
  package.json          # name @tourcompanion/web, depends on @tourcompanion/core (workspace:*) + esbuild
  build.mjs             # esbuild script: bundles core → public/core.bundle.js as IIFE on globalThis.TC
  public/
    index.html          # moved from server/frontend
    core.bundle.js      # generated; gitignored at packages/web/public/core.bundle.js
  .gitignore            # public/core.bundle.js, node_modules/, dist/
  README.md
```

### `packages/web/package.json`

```json
{
  "name": "@tourcompanion/web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "node build.mjs",
    "typecheck": "echo 'no TS in web yet'",
    "test": "echo 'no tests yet'"
  },
  "dependencies": {
    "@tourcompanion/core": "*"
  },
  "devDependencies": {
    "esbuild": "^0.21"
  }
}
```

### `packages/web/build.mjs`

```js
import { build } from "esbuild";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
await mkdir(resolve(here, "public"), { recursive: true });

await build({
  entryPoints: [resolve(here, "src/entry.ts")],
  bundle: true,
  format: "iife",
  globalName: "TC",
  target: ["es2020"],
  outfile: resolve(here, "public/core.bundle.js"),
  sourcemap: true,
  logLevel: "info"
});
```

### `packages/web/src/entry.ts`

```ts
// Re-export the slice of @tourcompanion/core that the web frontend needs.
// Exposed on globalThis.TC by the IIFE bundle.
export {
  stopTimeSortKey,
  parseStopTime,
  cleanName,
  extractCity,
  buildQueries,
  haversineKm,
  viewboxAround,
  generateSlug,
  sanitizeTripForPublic,
  CORE_VERSION,
} from "@tourcompanion/core";
```

### Frontend Wiring Changes (`packages/web/public/index.html`)

**Single targeted change** in this step — prove the bundle works. Do not rewrite the SPA.

1. Add `<script src="/core.bundle.js"></script>` in `<head>` (before existing inline `<script>` blocks).
2. Replace the inline KG-7 helper near line 1559:
   ```js
   const toMinutes = (t) => { /* current inline impl */ };
   ```
   with:
   ```js
   const toMinutes = (t) => {
     // Delegate to @tourcompanion/core (KG-7 +1 parser).
     try { return TC.stopTimeSortKey(t); } catch { return Infinity; }
   };
   ```
   The `try/catch` preserves the old `Infinity`-on-bad-input contract that callers relied on.

That is the only frontend code edit in this step. Further migrations happen incrementally in later phases (out of scope for Step 11).

### Server Wiring Changes (`TourCompanion/server/app/main.py`)

Update `frontend_dir`:

```python
# OLD:
frontend_dir = Path(__file__).resolve().parent.parent / "frontend"

# NEW: points at the monorepo packages/web/public bundle.
frontend_dir = (
    Path(__file__).resolve().parent.parent.parent / "packages" / "web" / "public"
)
```

`server/app/main.py` is the only Python file modified. No other Python changes.

### Build / Run Sequence

1. From `TourCompanion/`: `npm install` (picks up new web package).
2. `npm run build` — builds core first, then web bundles `core.bundle.js`.
3. `./TourCompanion/server/run_local.sh` — server now serves the relocated frontend.

### `run_local.sh` Update

If the script references `server/frontend/`, update path. If not, leave alone.
Grep: `grep -n "frontend" TourCompanion/server/run_local.sh`.

### Flags Bob Must Not Guess At

- **Do NOT rewrite index.html.** One inline replacement (KG-7 `toMinutes`). Everything else stays inline JS.
- **Do NOT modify Python planner.py.** Server-side LLM path stays. Only `main.py` `frontend_dir` line changes.
- **Do NOT remove the Anthropic dependency from server.** Web is server-side-LLM.
- **No new server-side auth changes, no new endpoints.**
- **Verify `core.bundle.js` exposes `window.TC`** — open generated file, grep for `var TC = `.
- **Bundle is gitignored.** `packages/web/public/core.bundle.js` and `.js.map` not committed. CI / dev builds regenerate.
- **`run_local.sh` must build the bundle** before starting uvicorn, OR document that the user must `npm run build` first. Pick: add `(cd .. && npm run build --workspace=@tourcompanion/web)` to the top of `run_local.sh` IF the script is in `server/` and a relative `cd ..` reaches `TourCompanion/`. Verify by reading the script first.

### Verification Checklist

- [ ] `find TourCompanion/server/frontend` — fails (directory removed)
- [ ] `find TourCompanion/packages/web -type f -not -path '*/node_modules/*' -not -name 'core.bundle.js*'` — lists exactly the new files
- [ ] `cd TourCompanion && npm install && npm run build` succeeds
- [ ] `TourCompanion/packages/web/public/core.bundle.js` exists and starts with `var TC` (or contains `globalThis.TC`)
- [ ] `npm test` still passes (67 core tests, no web tests yet)
- [ ] `npm run typecheck` exit 0
- [ ] `./TourCompanion/server/run_local.sh` starts; `curl http://127.0.0.1:<port>/` returns the index.html (or 200 with html body)
- [ ] `curl http://127.0.0.1:<port>/core.bundle.js` returns 200 with JS body
- [ ] No other Python files modified

---

Architect approval: [x] Pre-approved.
