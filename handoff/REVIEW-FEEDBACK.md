# Review Feedback — Step 15
Date: 2026-05-16
Ready for Builder: NO

## Must Fix

- **`packages/web/public/index.html:1210-1217` + `:1437-1440` — `apiCall` 401 path nukes the missing-key UX. The Settings-modal branch never fires.**
  - On a 401, `apiCall` does two things before throwing: (a) calls `logout()` when `PUBLIC_MODE` is false — which clears `API_TOKEN`, `TRIP`, `STATE`, `TRIP_ID` and calls `showLogin()` (hides `app-shell`, shows the login overlay); (b) throws `new Error("unauthorized")`. The message reaching `submitIngest`'s catch is the literal string `"unauthorized"`. It does not contain `"missing_openai_key"`, so `e.message.indexOf("missing_openai_key") !== -1` is false and `openSettingsModal()` is never called.
  - User-visible result on iOS when Generate is pressed with no key in the Keychain: the app shell disappears, the login overlay takes over, and the error label reads `"unauthorized"`. The whole point of the 401 + missing-key shape — surfacing the Settings modal — is dead. Bob assessed this in Open Question 1 as "harmless" and claimed "Settings modal opens because submitIngest's catch fires first." Both statements are incorrect on inspection of the live code path.
  - The brief already anticipated this: *"If `apiCall` only throws status text, also add a 401-status branch by reading the underlying response. Read `apiCall` near top of index.html and pick the minimal change."* That change wasn't made.
  - Fix: in `apiCall`, before calling `logout()` on `res.status === 401`, read the body and check for the marker. If matched, throw an Error whose `.message` carries `missing_openai_key` and do not call `logout()`. Concretely, around line 1214-1217:
    ```js
    if (res.status === 401) {
      const text = await res.text();
      if (text.indexOf("missing_openai_key") !== -1) {
        throw new Error(`API 401: ${text}`);
      }
      if (!PUBLIC_MODE) logout();
      throw new Error("unauthorized");
    }
    ```
    `submitIngest`'s existing catch already matches on `e.message.indexOf("missing_openai_key")`; once the message carries the marker, the Settings modal opens correctly. No other 401 path in the app needs to change — every other 401 is a real auth 401 and still triggers logout as today.

## Should Fix

- `packages/ios/src/runtime/fetch-interceptor.ts:178-182` — the non-null assertion on line 182 is no longer needed. Line 178 narrows `window.TCSettings` to defined via the `if (!settings)` early-return. Pass `settings` directly: `return handlePlanIngest(body, store, settings);`. One-character cleanup that also resolves Bob's Open Question 3.
- `plan-handler.test.ts:107-118` — the fake `LLMClient.complete()` ignores its `options` argument. Acceptable for this suite, but a regression where `planTrip` stops passing `options.system` (the schema prompt) would not surface here. Out of scope to fix this step; noting for any future tightening.
- `plan-handler.ts:38-41` — `Number(body?.days ?? 0)` coerces strings like `"3"` to `3`. Python validates via Pydantic `int` (stricter). Behaviour matches close enough; flag only if Arch wants exact parity.

## Escalate to Architect

- None. The Must Fix above is implementable from the brief's own guidance — the brief anticipated the `apiCall` 401 swallow and told Bob to handle it. No product question is open.

## Cleared

- **Validation order in `plan-handler.ts:43-54`** — destination → days → key. Matches the brief's status codes (400 → 400 → 401). Trim correctly rejects `"   "`. `Number.isInteger` correctly rejects `0`, `15`, `3.5`, and `NaN`.
- **`TripPlan` → `TripCreateInput` mapping (`plan-handler.ts:75-116`)** — verified against `packages/core/src/store/types.ts` and `packages/core/src/types/trip.ts`. `Omit<Stop, "id" | "check_in_count" | "photo_paths" | "voice_transcript">` keeps `order_idx`, `note`, `promo` required; Bob populates all three (`order_idx: idx`, `note: ""`, `promo: null`). Bookings: `BookingPlan.url`/`.done` are required in core but `TripCreateInput.bookings` makes them optional — defensive `?? ""` and `?? false` are correct and harmless. `start_date!` / `end_date!` non-null assertions are sound: `planTrip` populates both (Step 10 contract).
- **Error envelope shapes** — every 4xx / 502 body matches the FastAPI contract exactly (same `error` + `message` keys and strings). The 200 path returns `job_id`, `trip_id`, `status: "done"`, `message`, `backend: "openai"` — same shape as `/api/plan/ingest` in Python, so the existing inline `submitIngest` (`index.html:1434-1435`) parses both `result.message` and `result.backend` without change.
- **`crypto.randomUUID()` fallback (`plan-handler.ts:118-121`)** — correct guard, returns a non-empty string in both branches. Test 6 asserts `typeof job_id === "string"` and `length > 0`.
- **`fetch-interceptor.ts` wiring (`:12, :177-183`)** — import added, route replaces the Step 14 503 stub, defensive 500 covers a missing `window.TCSettings`. `/api/plan/jobs/{id}` remains 404 per the brief.
- **Tests (`plan-handler.test.ts`, 6 tests)** — cover the four 4xx paths, the 502 throw, and the 200 persistence shape including `factoryArgs` (proves key+model are plumbed from settings) and `store.lastInput` (proves the mapping reaches `createTrip`). No real network, no SQLite. `FakeStore`'s throw-on-unused-method pattern would surface any accidental store call — good discipline.
- **Verification run** — `npm test` green locally (79/79, 73 core + 6 ios). `npm run typecheck` exit 0 across both TS workspaces. Bob's `xcodebuild` claim is consistent with the TS surfaces being clean.
- **No Python touched** — confirmed via the review-request statement and via the fact that the changes are localised to `packages/ios/`, `packages/web/public/index.html`, and `package.json` in the ios workspace.

The 5 of 6 verification items pass cleanly. The 6th — the index.html ingest catch — is wired in the wrong place (in `submitIngest` only, not in `apiCall`) and therefore never executes. That is the single blocker.
