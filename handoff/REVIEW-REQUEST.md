# Review Request — Step 15: OpenAI Plan Ingest from Device

**Step:** 15 — OpenAI Plan Ingest from Device
**Ready for Review:** YES
**Builder:** Bob

---

## Summary

Replaces the Step 14 `/api/plan/ingest` 503 stub with a real on-device OpenAI planner. Reads the OpenAI key from the Keychain-backed `TCSettings`, calls `planTrip` from `@tourcompanion/core`, persists the resulting `TripPlan` via `IOSTripStore.createTrip`. Response shape matches the Python endpoint so the existing inline `submitIngest` handler works unchanged. Frontend catch block now opens the Settings modal when the error message contains `missing_openai_key`. `clientFactory` injection point added for tests so no live network calls occur.

All `npm test` (79 tests), `npm run typecheck`, `npm run build`, and `xcodebuild` are green.

---

## Files to Review

### New

**`TourCompanion/packages/ios/src/runtime/plan-handler.ts`** (lines 1–133)
The new handler. Key spots:
- Lines 38–62 — request validation (destination + days range).
- Lines 64–71 — missing-key 401 + client construction (uses `clientFactory` so tests inject a fake).
- Lines 73–80 — LLM call wrapped in try/catch → 502 `ingest_failed` on throw.
- Lines 82–115 — `TripPlan` → `TripCreateInput` mapping. `order_idx = idx`, `note: ""`, `promo: null`, `b.url ?? ""`, `b.done ?? false` cover the optional/required mismatches.
- Lines 117–131 — `crypto.randomUUID()` with `Date.now()` fallback; 200 response shape matches Python `IngestOut`.

**`TourCompanion/packages/ios/src/runtime/plan-handler.test.ts`** (lines 1–271)
- Lines 22–40 — `FakeSettings` (in-memory key + model).
- Lines 44–104 — `FakeStore` implementing the full `TripStore` interface; only `createTrip` records input, every other method throws to surface accidental calls.
- Lines 107–115 — `makeFakeClient(json)` returns a deterministic stub `LLMClient` (no network).
- Lines 117–155 — `validPlanJson(destination, days)` builds a parser-compatible `TripPlan` JSON.
- Lines 157–172 — Test 1: 401 missing key (asserts `store.lastInput === null`).
- Lines 174–183 — Test 2: 400 days=0.
- Lines 185–194 — Test 3: 400 days=15.
- Lines 196–205 — Test 4: 400 empty destination (`"   "` trimmed).
- Lines 207–224 — Test 5: 502 when LLM throws.
- Lines 226–266 — Test 6: 200 success — asserts `factoryArgs` carry key+model, `trip_id` plumbed through, days/stops/bookings mapped into `createTrip`.

### Modified

**`TourCompanion/packages/ios/src/runtime/fetch-interceptor.ts`**
- Lines 1–11 — header comment updated (ingest no longer 503-stubbed).
- Line 12 — `import { handlePlanIngest } from "./plan-handler.js"`.
- Lines 176–183 — replaced 503 stub with `handlePlanIngest(body, store, window.TCSettings!)` plus defensive `settings_unavailable` 500 if `window.TCSettings` is somehow missing.

**`TourCompanion/packages/ios/package.json`**
- Line 10 — added `"test": "vitest run"`.
- Line 26 — added `"vitest": "^1.0.0"` to devDependencies (hoisted from workspace root; no new install needed).

**`TourCompanion/packages/web/public/index.html`**
- Lines ~1436–1441 — `submitIngest` catch block: 2 additional lines that check `e.message` for `missing_openai_key` and call `openSettingsModal()` if defined. No other code in the file touched.

---

## Verification Run

- `npm run build` → green. iOS bundle 99.3kb (was 90.5kb pre-Step-15; +8.8kb is plan-handler + the LLM/planner code pulled by the new `OpenAIClient` import).
- `npm run typecheck` → green across both `@tourcompanion/core` and `@tourcompanion/ios`.
- `npm test` → **79 tests** in 16 files (73 core + 6 new ios). All pass.
- `npx cap sync ios` + `xcodebuild ... build CODE_SIGNING_ALLOWED=NO` → `** BUILD SUCCEEDED **`.
- No Python files touched; `git status TourCompanion/server/` empty.

---

## Open Questions

1. **`apiCall` 401 → `logout()`.** When the user hits Generate with no OpenAI key, the 401 makes `apiCall` call `logout()` on the way out. On iOS this is harmless because auth is stubbed and `logout()` just clears local state — the Settings modal opens because `submitIngest`'s catch fires first. But it's mildly ugly. Should we add an iOS-specific bypass in `apiCall` for `missing_openai_key` 401s, or accept the current behaviour? Documented in BUILD-LOG.

2. **Auto-test for the `submitIngest` `openSettingsModal()` call.** index.html has no test infrastructure (vanilla JS in an HTML file). I left it untested. The catch block is 3 lines; visual/runtime testing on the simulator is straightforward but out of scope here.

3. **`fetch-interceptor.ts` `window.TCSettings!` non-null assertion.** The defensive `settings_unavailable` 500 below it makes the `!` lossless at runtime, but stylistically it's a TS escape hatch. Alternative: take a `() => TCSettings | undefined` provider param like `storeProvider`. Did not change the function signature this step — let me know if it's worth restructuring.

---

## What I Need From Richard

A standard review pass. Particularly: the mapping at lines 82–115 of `plan-handler.ts` is the largest single block, and the optional/required field handling there is where the biggest landmine sits if I missed a corner. The test exercises the booking + stops mapping but doesn't exhaustively cover every optional field.
