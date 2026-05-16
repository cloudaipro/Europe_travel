# Architect Brief

## Initiative — Standalone iOS Version (continued)

Steps 8-14 complete. Now Step 15.

---

## Step 15 — OpenAI Plan Ingest from Device

**Scope:** Replace the Step 14 `/api/plan/ingest` 503 stub with a real handler that:
1. Reads the OpenAI key from `TCSettings`. If missing, returns `401 {"error":"missing_openai_key"}`.
2. Constructs `OpenAIClient` (already in core).
3. Calls `planTrip(client, input)` from core.
4. Persists the resulting plan via `store.createTrip(input)`.
5. Returns `{job_id, trip_id, status:"done", message, backend:"openai"}` — same shape as the Python endpoint so the existing frontend handler in `index.html:1434` works unchanged.

### Endpoint Contract (from Python `/api/plan/ingest`)

Request body (matches `schemas.IngestIn`):
```json
{ "destination": "Vienna", "days": 3, "style": "mixed", "source_url": "" }
```

Response on success (200):
```json
{
  "job_id": "<uuid string>",
  "trip_id": 42,
  "status": "done",
  "message": "Created trip 'Vienna' with 3 days.",
  "backend": "openai"
}
```

Response on missing key (401):
```json
{ "error": "missing_openai_key", "message": "Add your OpenAI key in Settings." }
```

Response on bad days (400):
```json
{ "error": "invalid_days", "message": "Days must be between 1 and 14." }
```

Response on OpenAI error (502):
```json
{ "error": "ingest_failed", "message": "<LLMError or PlanParseError message>" }
```

### Implementation

New file `packages/ios/src/runtime/plan-handler.ts`:

```ts
import { OpenAIClient, planTrip, type TripStore, type TCSettings, type TripPlan } from "@tourcompanion/core";

export async function handlePlanIngest(
  body: Record<string, unknown> | null,
  store: TripStore,
  settings: TCSettings
): Promise<{ status: number; body: unknown }> {
  const destination = String(body?.destination ?? "").trim();
  const days = Number(body?.days ?? 0);
  const style = String(body?.style ?? "");
  const sourceUrl = String(body?.source_url ?? "");

  if (!destination) return { status: 400, body: { error: "invalid_destination", message: "Destination is required." } };
  if (!Number.isInteger(days) || days < 1 || days > 14) {
    return { status: 400, body: { error: "invalid_days", message: "Days must be between 1 and 14." } };
  }

  const apiKey = await settings.getOpenAIKey();
  if (!apiKey) {
    return { status: 401, body: { error: "missing_openai_key", message: "Add your OpenAI key in Settings." } };
  }
  const model = await settings.getOpenAIModel();
  const client = new OpenAIClient({ apiKey, model });

  let plan: TripPlan;
  try {
    plan = await planTrip(client, { destination, days, sourceUrl, style });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { status: 502, body: { error: "ingest_failed", message: msg } };
  }

  // Persist into local SQLite via TripStore.
  const trip = await store.createTrip({
    name: plan.name,
    destination: plan.destination,
    start_date: plan.start_date!,
    end_date: plan.end_date!,
    season: plan.season,
    style: plan.style,
    pace: plan.pace,
    source_url: plan.source_url ?? "",
    hotel_name: plan.hotel_name,
    hotel_lat: plan.hotel_lat ?? null,
    hotel_lng: plan.hotel_lng ?? null,
    hotel_address: plan.hotel_address,
    days: plan.days.map(d => ({
      n: d.n,
      date_label: d.date_label,
      theme: d.theme,
      mode: d.mode,
      stops: d.stops.map(s => ({
        time_label: s.time_label,
        name: s.name,
        address: s.address,
        lat: s.lat ?? null,
        lng: s.lng ?? null,
        hours: s.hours,
        tickets: s.tickets,
        intro: s.intro,
        highlights: s.highlights,
        transit: s.transit,
        washroom: s.washroom,
        food: s.food,
      })),
    })),
    bookings: plan.bookings.map(b => ({ label: b.label, url: b.url, done: b.done })),
  });

  const jobId = (typeof crypto !== "undefined" && "randomUUID" in crypto)
    ? crypto.randomUUID()
    : String(Date.now());

  return {
    status: 200,
    body: {
      job_id: jobId,
      trip_id: trip.id,
      status: "done",
      message: `Created trip '${trip.name}' with ${plan.days.length} days.`,
      backend: "openai",
    },
  };
}
```

### Wire into Fetch Interceptor

`packages/ios/src/runtime/fetch-interceptor.ts` — replace the `/api/plan/ingest` 503 block:

```ts
if (path === "/api/plan/ingest" && method === "POST") {
  return handlePlanIngest(body, store, window.TCSettings!);
}
```

`installFetchInterceptor` already receives `store`. `TCSettings` is read from window at handler call time (set during boot).

### Update Step 14 Compat — `TripStore.createTrip` Field Verification

`createTrip` must accept the input shape this handler builds. Confirm by reading `packages/core/src/store/types.ts` `TripCreateInput`. If `bookings.url`/`bookings.done` are optional and we pass them as concrete values, that's compatible. Verify `IOSTripStore.createTrip` correctly populates `bookings` table from the input. If not — that's a Step 13 gap to fix here (file a Should Fix on yourself in the BUILD-LOG).

### `/api/plan/jobs/{id}` Endpoint

Step 14 stubbed this as `404 not_found`. Keep as-is — the existing frontend doesn't poll because ingest is synchronous.

### Tests

Add `packages/core/tests/llm/openai-plan.test.ts`:
- End-to-end mock: `MockLLMClient` → `planTrip` → returns valid TripPlan. (Already covered in Step 10 — skip if redundant.)

Add `packages/ios/src/runtime/plan-handler.test.ts` (Node-runnable, mock store + settings):
- Missing key → 401
- `days = 0` → 400
- `days = 15` → 400
- Empty destination → 400
- Success path with `MockLLMClient`-equivalent — too coupled to internal `OpenAIClient`; skip live OpenAI test, instead verify the **persistence path** with a fake `OpenAIClient` injected. **Refactor:** `handlePlanIngest` should accept an optional `clientFactory` parameter (default: `(opts) => new OpenAIClient(opts)`) so tests can substitute. Update signature accordingly.

Updated signature:
```ts
export async function handlePlanIngest(
  body: Record<string, unknown> | null,
  store: TripStore,
  settings: TCSettings,
  clientFactory: (opts: { apiKey: string; model: string }) => LLMClient = (opts) => new OpenAIClient(opts)
): Promise<{ status: number; body: unknown }>
```

In tests, pass a factory that returns `MockLLMClient` (or a stub that returns a deterministic JSON plan).

Wrap settings + store with fakes:
```ts
class FakeSettings implements TCSettings {
  constructor(private key: string | null, private model = "gpt-4o") {}
  async getOpenAIKey() { return this.key; }
  async setOpenAIKey(k: string) { this.key = k; }
  async clearOpenAIKey() { this.key = null; }
  async getOpenAIModel() { return this.model; }
  async setOpenAIModel(m: string) { this.model = m; }
}
class FakeStore implements TripStore {
  // implement minimal stubs — only createTrip is exercised; others throw
}
```

### Frontend Touch-up — Surface the Missing-Key Case

`packages/web/public/index.html`: the inline ingest handler near `1434` already catches errors and shows `e.message`. The `apiCall` helper turns non-2xx into thrown errors. **Adjust the catch** so that on iOS a missing key triggers opening the Settings modal:

Locate the catch block; one targeted edit:
```js
} catch (e) {
  progEl.classList.add("hidden"); btn.disabled = false; btn.textContent = "Generate"; errEl.textContent = e.message;
  if (e.message && e.message.includes("missing_openai_key")) {
    if (typeof openSettings === "function") openSettings();
  }
}
```

`openSettings()` already exists from Step 14. The string-match on `missing_openai_key` is fragile but acceptable for v1 — the error JSON is surfaced through `apiCall` (which throws with the JSON body or a stringified version). If `apiCall` only throws status text, also add a 401-status branch by reading the underlying response. Read `apiCall` near top of index.html and pick the minimal change.

### Verification Checklist

- [ ] `packages/ios/src/runtime/plan-handler.ts` exists and is wired into the interceptor
- [ ] `npm run build` green
- [ ] `npm run typecheck` green
- [ ] `npm test` — prior 73 + new plan-handler tests pass
- [ ] `xcodebuild` headless green
- [ ] `index.html` ingest catch updated to open Settings on missing key
- [ ] No Python changes
- [ ] No regression on web (Settings modal still hidden without `body.is-ios`)

### Flags Bob Must Not Guess At

- **No real OpenAI calls in tests.** Pass a `clientFactory` that returns a fake.
- **Bookings shape**: `BookingPlan` has `label, url, done` per Step 10 types. `TripCreateInput.bookings` per Step 13 has `{label, url?, done?}`. Optional-vs-required mismatch — handle the assignment defensively (`url ?? ""`, `done ?? false`).
- **`crypto.randomUUID()`** is available in iOS WKWebView (Capacitor) but not all environments — keep the `Date.now()` fallback.
- **Date population in plan**: `planTrip` sets `start_date` and `end_date`; both are guaranteed non-null after the call.
- **Do not** wire `/api/plan/jobs/{id}` to anything — the frontend never polls it.

---

Architect approval: [x] Pre-approved.
