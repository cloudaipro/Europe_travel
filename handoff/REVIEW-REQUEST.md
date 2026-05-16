# Review Request — Step 11

**Step:** 11 — Web frontend consumes `@tourcompanion/core` via esbuild IIFE bundle
**Builder:** Bob
**Date:** 2026-05-16
**Ready for Review: YES**

---

## What changed (one sentence per file)

### Moved
- `TourCompanion/server/frontend/index.html` → `TourCompanion/packages/web/public/index.html` — relocate the SPA into the monorepo `packages/web/` workspace (git mv); old directory removed.

### New
- `TourCompanion/packages/web/package.json` (lines 1–17) — `@tourcompanion/web` workspace package, depends on `@tourcompanion/core` and `esbuild ^0.21`.
- `TourCompanion/packages/web/build.mjs` (lines 1–18) — esbuild driver: bundles `src/entry.ts` → `public/core.bundle.js`, IIFE, `globalName: "TC"`, target `es2020`, sourcemap on.
- `TourCompanion/packages/web/src/entry.ts` (lines 1–14) — re-exports the curated core slice the SPA needs (stopTimeSortKey, parseStopTime, cleanName, extractCity, buildQueries, haversineKm, viewboxAround, generateSlug, sanitizeTripForPublic, CORE_VERSION).
- `TourCompanion/packages/web/.gitignore` (lines 1–4) — gitignores generated bundle + map, node_modules/, dist/.
- `TourCompanion/packages/web/README.md` (lines 1–28) — overwrites placeholder with build/serve instructions; documents Step 11 scope.

### Edited (Python — exactly one file as required by brief)
- `TourCompanion/server/app/main.py` line 79 (+3/-1) — `frontend_dir` now resolves to `parent.parent.parent / "packages" / "web" / "public"`. No other Python changes.

### Edited (shell)
- `TourCompanion/server/run_local.sh` after line 30 (added 7 lines) — pre-uvicorn web bundle build: `(cd .. && npm install --silent && npm run build --workspace=@tourcompanion/web --silent)` guarded by `command -v npm` so the API still boots in minimal envs.

### Edited (SPA — exactly two surgical edits as required by brief)
- `TourCompanion/packages/web/public/index.html` line 7 — inserted `<script src="/core.bundle.js"></script>` after `<title>`, before Tailwind CDN.
- `TourCompanion/packages/web/public/index.html` lines 1559–1565 — replaced the 7-line inline KG-7 `toMinutes` impl with a 3-line version that delegates to `TC.stopTimeSortKey(t)` and falls back to `Infinity` in a `try/catch` so callers in `applyAutoSortToDay` (line 1567) keep their numeric-sort contract.

**No other SPA edits.** Inline JS volume unchanged everywhere else in `index.html`.

---

## Verification results

- `find TourCompanion/server/frontend` → "No such file or directory" — pass.
- `find TourCompanion/packages/web -type f -not -path '*/node_modules/*' -not -name 'core.bundle.js*'` → lists exactly the 6 expected files — pass.
- `cd TourCompanion && npm install && npm run build` → succeeds; emits `packages/web/public/core.bundle.js` (5.3KB) + `.js.map` (10.3KB).
- `head -c 100 packages/web/public/core.bundle.js` → `var TC = (() => { ... })` — pass (IIFE exposes `window.TC`).
- `npm test` → 67/67 core tests pass; web/ios placeholders no-op.
- `npm run typecheck` → exit 0 across all workspaces.
- Live server smoke (`PORT=8765 ./run_local.sh`):
  - `GET /` → 200, `text/html`, 157493 bytes (index.html with `/core.bundle.js` script tag visible in head).
  - `GET /core.bundle.js` → 200, `text/javascript`, 5441 bytes; body starts `var TC = (() => {`.
- `git diff --stat HEAD -- '*.py'` → only `server/app/main.py | 4 +++-` — pass.

---

## Open Questions

None. Brief was pre-approved by Architect; scope-locked to the relocation, bundle wiring, and single inline KG-7 delegation. No ambiguity arose during build.

---

## Out-of-scope reminders for Richard

- Other inline call-sites for `parseStopTime`, `cleanName`, `generateSlug`, etc. were NOT switched in this step (brief: "That is the only frontend code edit in this step"). They are exposed on `TC` ready for future incremental migration.
- Python `planner.py` and Anthropic dependency are intentionally untouched — web stays server-side-LLM.
- iOS bundling is Step 15.

**Ready for Review: YES**
