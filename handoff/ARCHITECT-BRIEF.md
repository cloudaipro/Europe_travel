# Architect Brief

## Initiative — Standalone iOS Version

**Goal:** Ship a standalone iOS app of TourCompanion alongside the existing client/server web version. Shared business logic in a TypeScript `core` package. Native shell via Capacitor.

**Owner decisions locked:**
1. Capacitor (not native Swift, not PWA)
2. Shared core package (Python → TS port)
3. Full feature parity (photos + voice notes + map + check-ins)
4. iOS uses **OpenAI GPT** API key (web stays Anthropic). Key stored in iOS Keychain.
5. Leaflet in WebView on both platforms
6. No login/auth on iOS. No publish flow on iOS. No sync with web.

**Roadmap:** Steps 8 → 20. Each step deployed + logged before next.

---

## Step 8 — Monorepo Workspace Skeleton

**Scope:** Introduce monorepo layout with `packages/` directory. Create `core` TS package skeleton + `ios` placeholder dir + `web` placeholder dir. Set up npm workspaces + root TS build config. **Do NOT move existing server or frontend code.** Existing FastAPI app must still run unchanged.

### Build Order

1. Create directories:
   - `TourCompanion/packages/core/`
   - `TourCompanion/packages/core/src/`
   - `TourCompanion/packages/core/tests/`
   - `TourCompanion/packages/ios/` (placeholder with README only)
   - `TourCompanion/packages/web/` (placeholder with README only — actual move happens in Step 11)

2. Create root `TourCompanion/package.json`:
   ```json
   {
     "name": "tourcompanion-monorepo",
     "private": true,
     "workspaces": ["packages/*"],
     "scripts": {
       "build": "npm run build --workspaces --if-present",
       "test": "npm run test --workspaces --if-present",
       "typecheck": "npm run typecheck --workspaces --if-present"
     }
   }
   ```

3. Create `TourCompanion/tsconfig.base.json` — strict mode, ES2022 target, declaration output, sourceMap, esModuleInterop, skipLibCheck. All package tsconfigs extend this.

4. Create `TourCompanion/packages/core/package.json`:
   - `"name": "@tourcompanion/core"`
   - `"version": "0.1.0"`
   - `"main": "./dist/index.js"`, `"types": "./dist/index.d.ts"`
   - `"files": ["dist"]`
   - Dev deps: `typescript@^5`, `vitest@^1`, `@types/node@^20`
   - Scripts: `build` (`tsc`), `test` (`vitest run`), `typecheck` (`tsc --noEmit`)

5. Create `TourCompanion/packages/core/tsconfig.json` extending base, with `rootDir: ./src`, `outDir: ./dist`, `include: ["src/**/*"]`.

6. Create `TourCompanion/packages/core/src/index.ts` with a single placeholder export:
   ```ts
   export const CORE_VERSION = "0.1.0";
   ```

7. Create `TourCompanion/packages/core/tests/smoke.test.ts` — imports `CORE_VERSION` and asserts equality.

8. Create `TourCompanion/packages/core/README.md` — one paragraph: "Shared business logic. Empty in Step 8; logic ports in Step 9." Note Node 20 LTS as target.

9. Create `TourCompanion/packages/ios/README.md` — "Placeholder. Capacitor scaffold in Step 12."

10. Create `TourCompanion/packages/web/README.md` — "Placeholder. Frontend moves here in Step 11. Server stays at `TourCompanion/server/` for now."

11. Update `TourCompanion/.gitignore` (create if missing) — entries: `node_modules/`, `dist/`, `*.log`, `.DS_Store`, `coverage/`.

12. Verify build chain green:
    - `cd TourCompanion && npm install` succeeds
    - `npm run build` succeeds
    - `npm run test` succeeds (smoke test passes)
    - `npm run typecheck` succeeds

13. Verify existing app untouched:
    - `./TourCompanion/server/run_local.sh` still starts. At minimum confirm Python imports + uvicorn binds to port. Document the result in BUILD-LOG.

### Flags Bob Must Not Guess At

- **Do not move** `TourCompanion/server/` or `TourCompanion/server/frontend/` in this step. Path stability matters.
- **Do not add** business logic to `core` yet. Empty skeleton only. Step 9 ports logic.
- **Do not** install Capacitor or any iOS deps. Step 12 scaffolds iOS.
- **Node target:** Node 20 LTS. Document in `packages/core/README.md`.
- Commit `package-lock.json` at `TourCompanion/`.
- If a top-level `package.json` already exists in repo root (`/Users/alex/data/work/Europe_travel/`) — do not modify it. Place the monorepo `package.json` at `TourCompanion/package.json` only.

### Verification Checklist

- [ ] `find TourCompanion/packages -type f -not -path '*/node_modules/*' -not -path '*/dist/*'` lists exactly the files this brief specifies
- [ ] `cd TourCompanion && npm test` exits 0
- [ ] `cd TourCompanion && npm run build` exits 0, produces `packages/core/dist/index.js`
- [ ] `npm run typecheck` exits 0
- [ ] Existing FastAPI server starts cleanly via `./TourCompanion/server/run_local.sh` (kill after verifying port bind)
- [ ] No files outside `TourCompanion/packages/`, `TourCompanion/package.json`, `TourCompanion/tsconfig.base.json`, `TourCompanion/package-lock.json`, `TourCompanion/.gitignore` modified

---

*Subsequent step briefs (9-20) issued by Architect when prior step clears.*

---

Architect approval: [x] Pre-approved.
