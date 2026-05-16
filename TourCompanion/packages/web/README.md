# @tourcompanion/web

Web frontend for TourCompanion. Vanilla-JS SPA (`public/index.html`) plus an
esbuild step that bundles `@tourcompanion/core` into `public/core.bundle.js`
as an IIFE exposed on `window.TC`.

## Build

```bash
# from TourCompanion/ (monorepo root)
npm install
npm run build  # builds core, then bundles core → packages/web/public/core.bundle.js
```

The bundle is gitignored — every dev/CI build regenerates it.

## Serve

FastAPI (`server/app/main.py`) serves `packages/web/public/` as the static
root in dev and Docker. Run `./server/run_local.sh` from `TourCompanion/server/`
after a `npm run build`.

## Step 11 Scope

This step adds the bundling pipeline plus one inline wiring change in
`index.html` (`toMinutes` now delegates to `TC.stopTimeSortKey`). Further
migration of inline JS to the core package happens incrementally.
