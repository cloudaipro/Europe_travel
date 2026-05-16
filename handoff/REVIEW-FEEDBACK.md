# Review Feedback — Step 11
Date: 2026-05-16
Ready for Builder: YES

## Must Fix
None.

## Should Fix
None.

## Escalate to Architect
None.

## Cleared

Reviewed Step 11 — web frontend relocated into `packages/web/`, esbuild IIFE bundle exposing `@tourcompanion/core` on `window.TC`, single inline KG-7 `toMinutes` delegated to `TC.stopTimeSortKey`, and `frontend_dir` repointed in `server/app/main.py`. All brief constraints honored:

- **File moves / new files** — `TourCompanion/server/frontend/` is gone (`find` errors). `TourCompanion/packages/web/` contains exactly the expected 6 source files (`package.json`, `build.mjs`, `src/entry.ts`, `.gitignore`, `README.md`, `public/index.html`); generated `core.bundle.js` + `.map` are present locally but `git check-ignore` confirms both are ignored via `packages/web/.gitignore`, and `git ls-files` shows neither is committed.
- **`packages/web/package.json`** — matches brief verbatim (name `@tourcompanion/web`, depends on `@tourcompanion/core: "*"`, devDep `esbuild ^0.21`, scripts wired).
- **`packages/web/build.mjs`** — matches brief verbatim (esbuild IIFE, `globalName: "TC"`, `es2020`, sourcemap on, outfile `public/core.bundle.js`).
- **`packages/web/src/entry.ts`** — re-exports exactly the 10 curated symbols specified (`stopTimeSortKey`, `parseStopTime`, `cleanName`, `extractCity`, `buildQueries`, `haversineKm`, `viewboxAround`, `generateSlug`, `sanitizeTripForPublic`, `CORE_VERSION`).
- **`index.html` surgical edits** — `git diff HEAD -- TourCompanion/server/frontend/index.html TourCompanion/packages/web/public/index.html` shows rename-with-modify of 3 inserted / 5 deleted lines, *only*:
  - line 7: `<script src="/core.bundle.js"></script>` inserted before Tailwind CDN.
  - lines 1560–1563: 5-line inline parser replaced with the 3-line `try { return TC.stopTimeSortKey(t); } catch { return Infinity; }` delegation. Surrounding KG-7 comment and `applyAutoSortToDay` caller at line 1565 intact; `Infinity`-on-bad-input contract preserved.
  - Line-count math confirms no hidden reformatting: previous file 3352 lines → 3350 lines = -5 + 3 = -2, exactly the diff. No other JS touched.
- **`server/app/main.py`** — `git diff --name-only -- '*.py'` lists only `main.py`. Diff is +3/-1 on the `frontend_dir` line: now `Path(__file__).resolve().parent.parent.parent / "packages" / "web" / "public"`. No other Python files mutated; `planner.py` untouched; Anthropic dep stays.
- **`run_local.sh`** — pre-uvicorn block added: `(cd .. && npm install --silent && npm run build --workspace=@tourcompanion/web --silent)` guarded by `command -v npm`. Skips silently when npm absent; API still boots in minimal envs. Build runs *before* uvicorn line as required.
- **Verification** — ran from `TourCompanion/`:
  - `npm test` → 14 files, **67/67 core tests pass** (web placeholder no-ops).
  - `npm run typecheck` → exit 0 across workspaces (core `tsc --noEmit` clean, web no-TS placeholder).
  - `npm run build` → emits `public/core.bundle.js` (5.3kb) + `.js.map` (10.3kb).
  - `head -c 50 core.bundle.js` → `var TC = (() => {` — IIFE on `window.TC` confirmed.
  - Live server smoke (`PORT=8766 ./run_local.sh`): `GET /` → 200 `text/html` 157493 bytes; `GET /core.bundle.js` → 200 `text/javascript` 5441 bytes, body starts `var TC = (() => {`.

No drift, no out-of-scope edits, no broken contracts. Step 11 is clear.
