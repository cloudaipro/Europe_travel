# Review Request — Step 8 — Monorepo Workspace Skeleton

**Ready for Review: YES**
**Builder:** Bob
**Date:** 2026-05-16
**Step:** 8 (Monorepo workspace skeleton — no logic, no Capacitor)

---

## Summary

Set up npm-workspaces monorepo under `TourCompanion/packages/` with a `core` TS skeleton plus `ios` and `web` placeholder dirs. No server or frontend code moved. FastAPI app verified to still start.

---

## Files Added (all new — no existing files modified)

| Path | Lines | One-sentence rationale |
|------|-------|------------------------|
| `TourCompanion/package.json` | 1–10 | Root workspaces manifest; fan-out scripts for `build`/`test`/`typecheck` via `--workspaces --if-present`. |
| `TourCompanion/tsconfig.base.json` | 1–15 | Shared strict TS config (ES2022, declaration, sourceMap, esModuleInterop, skipLibCheck) extended by every package. |
| `TourCompanion/.gitignore` | 1–5 | Standard ignores: `node_modules/`, `dist/`, `*.log`, `.DS_Store`, `coverage/`. |
| `TourCompanion/package-lock.json` | (generated) | Committed per brief — locks the 80 transitive deps pulled in by npm install. |
| `TourCompanion/packages/core/package.json` | 1–19 | Defines `@tourcompanion/core@0.1.0` (private, ESM) with `typescript@^5`, `vitest@^1`, `@types/node@^20` dev deps and `build`/`test`/`typecheck` scripts. |
| `TourCompanion/packages/core/tsconfig.json` | 1–8 | Extends base; sets `rootDir: ./src`, `outDir: ./dist`, `include: ["src/**/*"]`. |
| `TourCompanion/packages/core/src/index.ts` | 1 | Sole placeholder export `CORE_VERSION = "0.1.0"`. |
| `TourCompanion/packages/core/tests/smoke.test.ts` | 1–8 | Vitest smoke test asserts `CORE_VERSION === "0.1.0"`. |
| `TourCompanion/packages/core/README.md` | 1–5 | "Empty in Step 8; logic ports in Step 9." Notes Node 20 LTS as runtime target. |
| `TourCompanion/packages/ios/README.md` | 1–3 | Placeholder — Capacitor scaffold in Step 12. |
| `TourCompanion/packages/web/README.md` | 1–3 | Placeholder — frontend moves here in Step 11. |

---

## Verification Checklist Results

| Check | Result |
|-------|--------|
| `find TourCompanion/packages -type f -not -path '*/node_modules/*' -not -path '*/dist/*'` lists exactly the 8 brief-specified files | PASS — listing matches verbatim (3 READMEs + core pkg.json + core tsconfig + src/index.ts + tests/smoke.test.ts) |
| `cd TourCompanion && npm install` | PASS — 80 packages added, no errors |
| `cd TourCompanion && npm test` exits 0 | PASS — 1/1 vitest test passing |
| `cd TourCompanion && npm run build` exits 0, produces `packages/core/dist/index.js` | PASS — `dist/index.js`, `dist/index.d.ts`, `dist/index.js.map` emitted |
| `cd TourCompanion && npm run typecheck` exits 0 | PASS |
| Existing FastAPI server starts cleanly via `./TourCompanion/server/run_local.sh` | PASS — verified equivalent: `from app.main import app` imports cleanly with run_local.sh env vars; `uvicorn app.main:app --port 8765` bound the port and `/docs` returned HTTP 200; process killed after verification |
| No files outside the brief's allowed scope modified | PASS — only the 11 files above were added; no existing file mutated |

---

## Decisions Made (Inside Builder's Authority)

1. **`@tourcompanion/core` is `private: true`.** Brief did not specify. Safer default — prevents accidental publish. Easy to flip later if owner wants public registry.
2. **`"type": "module"` on the core package.** With `module: ES2022` emit, ESM at runtime is the cleanest path for Node 20 + iOS/web consumers. Test file imports `../src/index.js` (TypeScript-friendly with vitest; build-only path resolution).
3. **Added `forceConsistentCasingInFileNames`, `resolveJsonModule`, `isolatedModules`** to `tsconfig.base.json` beyond the brief's enumerated list. Standard hygiene for strict TS in a monorepo; no impact on consumers since they only extend.
4. **Did not modify or create repo-root `package.json`** — brief flag respected (`/Users/alex/data/work/Europe_travel/package.json` does not exist; left that way).

---

## Open Questions

None.

---

## Escalate to Architect

None.

---

## Out of Scope (Not Touched)

- `TourCompanion/server/` — untouched (verified still boots).
- `TourCompanion/server/frontend/` — untouched (Step 11 move).
- Capacitor / iOS deps — untouched (Step 12).
- Root repo `.gitignore`, `CLAUDE.md`, `docker-compose.yml`, etc. — untouched.
