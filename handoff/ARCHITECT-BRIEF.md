# Architect Brief

## Initiative — Standalone iOS Version (continued)

Steps 8-13 complete. Now Step 14.

---

## Step 14 — Settings, Keychain, Fetch Interceptor

**Scope:** Wire iOS to actually run. Add a Keychain-backed secure storage plugin. Build a Settings screen (iOS-only) where users paste their OpenAI key. Install a `fetch` interceptor on iOS that routes `/api/*` requests to `window.TCStore` so the existing inline frontend JS works without a server. **Plan ingest (`/api/plan/ingest`) is the only endpoint deferred — Step 15 wires it to the OpenAI client.**

### Plugin Pick: Keychain Storage

Use **`@capacitor-community/secure-storage`** (current Cap 6 plugin, backs iOS storage with Keychain). If that exact name doesn't have a Capacitor 6-compatible release, fall back to **`capacitor-secure-storage-plugin`** (also Cap 6 compatible). Bob: pick whichever has a `^x.y.z` matching Capacitor 6, install via `npm install --workspace=@tourcompanion/ios`, then `npx cap sync ios`. Document the choice + version in BUILD-LOG.

### New Core Module — `packages/core/src/settings/`

```
packages/core/src/settings/
  types.ts        # interface TCSettings
  keys.ts         # SETTINGS_KEYS = { openaiApiKey: "openai_api_key", openaiModel: "openai_model" }
```

```ts
export interface SecureStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
}

export interface TCSettings {
  getOpenAIKey(): Promise<string | null>;
  setOpenAIKey(key: string): Promise<void>;
  clearOpenAIKey(): Promise<void>;
  getOpenAIModel(): Promise<string>;   // default: "gpt-4o"
  setOpenAIModel(model: string): Promise<void>;
}

export function createSettings(store: SecureStore): TCSettings { /* impl */ }
```

Export from `packages/core/src/index.ts`. Bump `CORE_VERSION` to `"0.5.0"`.

### iOS Plugin Adapter — `packages/ios/src/runtime/keychain/index.ts`

```ts
import type { SecureStore } from "@tourcompanion/core";
// Pick exact import based on plugin chosen:
import { SecureStoragePlugin } from "capacitor-secure-storage-plugin";
// OR:
// import { SecureStorage } from "@capacitor-community/secure-storage";

export const keychainStore: SecureStore = {
  async get(key) { try { const r = await SecureStoragePlugin.get({ key }); return r.value ?? null; } catch { return null; } },
  async set(key, value) { await SecureStoragePlugin.set({ key, value }); },
  async remove(key) { try { await SecureStoragePlugin.remove({ key }); } catch {} },
  async clear() { await SecureStoragePlugin.clear(); }
};
```

### Wire Settings into iOS Boot — `packages/ios/src/runtime/entry.ts`

After `initSqliteStore()`:
```ts
import { createSettings } from "@tourcompanion/core";
import { keychainStore } from "./keychain";

window.TCSettings = createSettings(keychainStore);
```

Declare on the Window global. `window.TCStore` already set in Step 13.

### Fetch Interceptor — `packages/ios/src/runtime/fetch-interceptor.ts`

Install on iOS boot. Intercepts requests where pathname starts with `/api/`. Maps to `window.TCStore` calls and returns synthetic `Response` objects (JSON body, correct status codes). Endpoints to handle:

| Method | Path | Handler |
|---|---|---|
| GET | `/api/health` | `200 {"ok":true}` |
| GET | `/api/auth/me` | `200 {"id":1,"email":"","display_name":"local","email_verified_at":null,"created_at":""}` (stub user — iOS skips login) |
| POST | `/api/auth/signup` | `200 {"access_token":"local"}` |
| POST | `/api/auth/login` | `200 {"access_token":"local"}` |
| POST | `/api/auth/login-json` | `200 {"access_token":"local"}` |
| GET | `/api/trips` | `store.listTrips()` |
| POST | `/api/trips` | `store.createTrip(body)` |
| GET | `/api/trips/{id}` | `store.getTrip(+id)` → 404 if null |
| DELETE | `/api/trips/{id}` | `store.deleteTrip(+id)` → 204 |
| POST | `/api/trips/{id}/days` | `store.addDay(+id)` |
| DELETE | `/api/trips/{id}/days/{n}` | `store.removeDay(+id, +n)` |
| POST | `/api/trips/{id}/days/{n}/stops` | `store.addStop({day_id: dayId, ...body})` — resolve dayId by reading current trip; if frontend already sends `day_id` use that. Read the frontend's add-stop call near `addStop`/`POST .../stops` to confirm body shape |
| PUT | `/api/trips/days/{day_id}/stops/order` | `store.reorderStops(+day_id, body.stop_ids)` |
| POST | `/api/stops/{id}/checkin` | `store.checkIn({stop_id: +id, ...body})` |
| POST | `/api/stops/{id}/photos` | `store.addPhoto(+id, body.path or body.url, body.caption)` |
| POST | `/api/stops/{id}/photos-link` | same as above |
| POST | `/api/stops/{id}/voice` | `store.addVoiceNote({stop_id: +id, ...body})` |
| PUT | `/api/trips/{id}/journal` | `store.updateJournal({trip_id:+id, journal: body.journal})` |
| GET | `/api/trips/{id}/streetfood` | `200 []` (v1 — no street food on iOS) |
| POST | `/api/plan/ingest` | `503 {"error":"not_wired_yet"}` (Step 15 implements) |
| GET | `/api/plan/jobs/{id}` | `404 {"error":"not_found"}` (Step 15 — synchronous on iOS so no job poll) |

Anything else under `/api/*` → `404 {"error":"unsupported","path":pathname}`.

Implementation skeleton:

```ts
const origFetch = window.fetch.bind(window);

export function installFetchInterceptor(store: TripStore) {
  window.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : (input as Request).url;
    const u = new URL(url, location.origin);
    if (!u.pathname.startsWith("/api/")) return origFetch(input, init);

    const method = (init?.method ?? (typeof input === "string" ? "GET" : (input as Request).method)).toUpperCase();
    const body = init?.body ? JSON.parse(String(init.body)) : null;

    try {
      const result = await route(u.pathname, method, body, store);
      return new Response(JSON.stringify(result.body), {
        status: result.status,
        headers: { "content-type": "application/json" }
      });
    } catch (err: any) {
      return new Response(JSON.stringify({ error: err.message ?? "error" }), {
        status: 500, headers: { "content-type": "application/json" }
      });
    }
  };
}
```

Add `route(pathname, method, body, store)` as a pure function that returns `{ status, body }`. Pattern-match on the table above. Use regex or split path-segments.

Wire from `entry.ts`:
```ts
import { installFetchInterceptor } from "./fetch-interceptor";
// after window.TCStore is set:
installFetchInterceptor(window.TCStore!);
```

### Settings UI in index.html (iOS-only)

Add **minimal** UI to `packages/web/public/index.html`. The Settings entry must be hidden on web. Conditionally show via `body.is-ios` class set at boot by `ios.bundle.js`.

Add to `entry.ts`:
```ts
document.body.classList.add("is-ios");
```

In `index.html`:
1. Add a small gear/cog button in the existing app bar, hidden by default. Make it visible via CSS `body.is-ios .ts-settings-btn { display: ... }`.
2. Add a modal `#ts-settings-modal` (hidden by default) with:
   - Label + `<input type="password" id="ts-openai-key" placeholder="sk-...">`
   - Optional `<input type="text" id="ts-openai-model" placeholder="gpt-4o">`
   - Save button → `window.TCSettings.setOpenAIKey(value)`, close modal, toast "Key saved"
   - Clear button → `window.TCSettings.clearOpenAIKey()`, clear input
3. On modal open, populate inputs from `await window.TCSettings.getOpenAIKey()` / `getOpenAIModel()`.

Minimal CSS — reuse existing modal classes if any (grep for `.modal-overlay`, `.modal-card`, etc.).

**Do not** rewire any existing UI elements. Just add the new ones.

### Public Surface Updates

`packages/core/src/index.ts` adds:
```ts
export { type SecureStore, type TCSettings, createSettings } from "./settings/types";
export { SETTINGS_KEYS } from "./settings/keys";
```

`window.TCSettings` declared in `packages/ios/src/runtime/global.d.ts`:
```ts
import type { TripStore, TCSettings } from "@tourcompanion/core";
declare global {
  interface Window {
    TCStore?: TripStore;
    TCSettings?: TCSettings;
  }
}
export {};
```

### Verification Checklist

- [ ] Secure storage plugin installed; visible in `packages/ios/ios/App/Podfile.lock`
- [ ] `createSettings(keychainStore)` compiles + types match in iOS package
- [ ] `CORE_VERSION === "0.5.0"`
- [ ] `packages/core` exports `SecureStore`, `TCSettings`, `createSettings`, `SETTINGS_KEYS`
- [ ] `packages/ios/src/runtime/fetch-interceptor.ts` handles every method/path in the table
- [ ] `entry.ts` installs both `window.TCSettings` and the fetch interceptor after `window.TCStore`
- [ ] Settings gear visible only when `body.is-ios` is set; modal opens; save/clear wired
- [ ] `npm run build` succeeds across all workspaces
- [ ] `npm run typecheck` exit 0
- [ ] `xcodebuild ... build CODE_SIGNING_ALLOWED=NO` exits 0
- [ ] Core tests still pass (67+, may grow if settings.test.ts added)
- [ ] No Python changes
- [ ] Web `packages/web/public/index.html` modified only to add: settings button, settings modal, related CSS. Existing app behavior unchanged on web

### Flags Bob Must Not Guess At

- **Auth endpoints on iOS return synthetic OK responses.** Don't crash the existing login flow code — let it call `/api/auth/me`, get the stub user, and proceed.
- **`/api/plan/ingest`** returns 503 from the interceptor. The existing frontend will surface an error to the user. Step 15 will wire OpenAI.
- **Settings modal copy:** keep it short. Title "OpenAI API Key", subtitle "Required for trip planning. Stored in iOS Keychain.", a small "Get a key →" link to `https://platform.openai.com/api-keys`.
- **No model dropdown.** Free-text input with placeholder `gpt-4o`. Power-user feature.
- **CSS reuse:** grep `index.html` for existing modal class names. Use them.
- **Do not** touch web bundle behavior. The `body.is-ios` class is set by `ios.bundle.js` only.
- **Don't bypass `await`** on `window.TCStore` if it's not yet ready when interceptor fires. Boot order in `entry.ts`: `await initSqliteStore() → set TCStore → set TCSettings → installFetchInterceptor → mark body is-ios`. Existing index.html boot will run before interceptor is ready; ensure your boot completes synchronously *before* the page's own boot code runs — load `ios.bundle.js` before existing inline scripts, and have its top-level `await` block all subsequent code. Use a `<script>` tag injection that places `ios.bundle.js` in `<head>` BEFORE the existing inline scripts. Update `copy-web.mjs` to inject in `<head>` (right after `<title>`) not before `</body>`.
- **For Step 13 the injection point was before `</body>`** — change to head injection in this step. Update Step 13's BUILD-LOG entry accordingly (one-line note).

---

Architect approval: [x] Pre-approved.
