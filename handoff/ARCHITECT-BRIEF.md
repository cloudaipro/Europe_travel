# Architect Brief

## Initiative — Standalone iOS Version (continued)

Steps 8-9 complete. Now Step 10.

---

## Step 10 — LLM Provider Abstraction

**Scope:** Add a provider-agnostic LLM interface in `packages/core` with Anthropic + OpenAI adapters. Port the plan-ingest prompt + parser from Python `planner.py` into core. Web frontend will plug Anthropic at boot; iOS will plug OpenAI. **Do not yet wire either platform** — Step 11 wires web; Step 15 wires iOS.

### Architecture

```
packages/core/src/llm/
  types.ts          # LLMClient interface, LLMMessage, LLMOptions
  anthropic.ts      # AnthropicClient implements LLMClient
  openai.ts         # OpenAIClient implements LLMClient
  mock.ts           # MockLLMClient — for tests + no-key dev mode

packages/core/src/planner/
  prompt.ts         # SYSTEM_PROMPT, buildUserMessage()
  fence.ts          # stripCodeFence (already in Step 9 — leave in place)
  parse.ts          # parsePlanResponse(rawText) -> TripPlan
  plan.ts           # planTrip(client: LLMClient, input: PlanInput) -> TripPlan
  types.ts          # PlanInput, TripPlan, BookingPlan, DayPlan, StopPlan
```

### LLMClient Interface

```ts
export interface LLMMessage {
  role: "system" | "user";
  content: string;
}

export interface LLMOptions {
  system: string;
  messages: LLMMessage[];
  maxTokens: number;
  // optional knobs — adapters apply defaults
  temperature?: number;
  model?: string;
}

export interface LLMClient {
  readonly provider: "anthropic" | "openai" | "mock";
  complete(options: LLMOptions): Promise<string>;
}
```

`complete` returns the assistant's text content concatenated to a single string. Adapter strips provider-specific envelope (Anthropic `content` blocks, OpenAI `choices[0].message.content`).

### Anthropic Adapter

`AnthropicClient(opts: { apiKey: string; model?: string; fetchImpl?: typeof fetch })`.

- Default model: `claude-sonnet-4-6`.
- Use direct `fetch` POST to `https://api.anthropic.com/v1/messages`. Required headers: `x-api-key`, `anthropic-version: 2023-06-01`, `content-type: application/json`. **Do not** depend on `@anthropic-ai/sdk` — adds bundle weight, version drift; raw fetch is fine for this surface.
- Request body: `{ model, max_tokens, system, messages: [...], temperature? }`.
- Response → join all `content[].text` blocks → return as string.
- Errors: throw `LLMError` with `provider`, `status`, `message`.

### OpenAI Adapter

`OpenAIClient(opts: { apiKey: string; model?: string; fetchImpl?: typeof fetch })`.

- Default model: `gpt-4o` (good price/quality; user can override).
- Endpoint: `https://api.openai.com/v1/chat/completions`. Headers: `Authorization: Bearer <key>`, `content-type: application/json`.
- Request body shape: `{ model, max_tokens, messages: [{role:"system",content:system}, ...messages], temperature? }`. Note OpenAI merges system into messages array.
- Response: extract `choices[0].message.content`.
- Errors: throw `LLMError` same shape.

### Mock Adapter

`MockLLMClient()` — returns a deterministic stub JSON plan when `complete()` called. Port `_mock_plan` from `planner.py`. Used in tests + dev when no API key set.

### Prompt + Plan Module

Port `SYSTEM_PROMPT` verbatim from `planner.py`. `buildUserMessage(input)` builds the user prompt string the same way Python does.

```ts
export interface PlanInput {
  destination: string;
  days: number;      // 1..14
  sourceUrl?: string;
  style?: string;
}

export interface TripPlan {
  name: string;
  destination: string;
  season: string;
  style: string;
  pace: string;
  hotel_name: string;
  hotel_lat: number;
  hotel_lng: number;
  hotel_address: string;
  bookings: BookingPlan[];
  days: DayPlan[];
  start_date?: string;   // populated by planTrip
  end_date?: string;     // populated by planTrip
  source_url?: string;
}

export interface BookingPlan {
  label: string;
  url: string;
  done: boolean;
}

export interface DayPlan {
  n: number;
  date_label: string;
  theme: string;
  mode: string;
  stops: StopPlan[];
}

export interface StopPlan {
  time_label: string;
  name: string;
  lat: number;
  lng: number;
  address: string;
  hours: string;
  tickets: string;
  intro: string;
  highlights: string[];
  transit: string;
  washroom: string;
  food: string[];
}
```

`planTrip(client, input)`:
1. Validate `1 <= days <= 14` (mirror Python). Throw `RangeError` otherwise.
2. Build user message.
3. `raw = await client.complete({ system: SYSTEM_PROMPT, messages: [...], maxTokens: 8000 })`.
4. `text = stripCodeFence(raw)`.
5. `JSON.parse(text)` → cast to `TripPlan`. Throw `PlanParseError` on parse failure with first 500 chars.
6. Populate `start_date` (today ISO), `end_date` (today + days - 1), `source_url` (from input).
7. Return plan.

`parsePlanResponse(rawText: string): TripPlan` — exposed separately for unit testing.

### Error Types

```ts
export class LLMError extends Error {
  constructor(
    public provider: string,
    public status: number,
    message: string
  ) { super(message); this.name = "LLMError"; }
}

export class PlanParseError extends Error {
  constructor(message: string, public excerpt: string) {
    super(message);
    this.name = "PlanParseError";
  }
}
```

### Tests

| Module | Cases |
|---|---|
| `mock` | returns valid TripPlan shape for `(Vienna, 3, mixed)` |
| `anthropic` adapter | mocked fetch — extracts `content[0].text`; throws LLMError on non-200; respects custom `fetchImpl` |
| `openai` adapter | mocked fetch — extracts `choices[0].message.content`; throws LLMError on non-200 |
| `prompt` | `buildUserMessage` matches Python output byte-for-byte for known inputs |
| `parsePlanResponse` | parses valid JSON; strips code fence; throws `PlanParseError` on bad JSON with truncated excerpt |
| `planTrip` | validates days range (rejects 0, 15); calls mock client → annotates start/end/source_url; end_date = start + days - 1 |

All vitest. **Do not** make real network calls in tests — pass `fetchImpl` overrides.

### Public Surface — `packages/core/src/index.ts`

Add exports (keep existing):
```ts
export { type LLMClient, type LLMMessage, type LLMOptions, LLMError, PlanParseError } from "./llm/types";
export { AnthropicClient } from "./llm/anthropic";
export { OpenAIClient } from "./llm/openai";
export { MockLLMClient } from "./llm/mock";
export { planTrip, parsePlanResponse, buildUserMessage, SYSTEM_PROMPT } from "./planner/plan";
export {
  type PlanInput, type TripPlan, type BookingPlan,
  type DayPlan, type StopPlan
} from "./planner/types";
```

Bump `CORE_VERSION` to `"0.3.0"`.

### Flags Bob Must Not Guess At

- **No SDK deps.** Use raw `fetch`. Adapters take `fetchImpl?` for testability.
- **No real network in tests.** Mock `fetch` end-to-end.
- **OpenAI message shape:** system + user merged into messages array; Anthropic keeps system separate. This is the only structural difference.
- **Default Anthropic model:** `claude-sonnet-4-6`. Default OpenAI model: `gpt-4o`.
- **Do not** modify Python `planner.py`. Step 11 deprecates it.
- **`SYSTEM_PROMPT`** must match Python byte-for-byte. Copy as a raw template string.
- **Date handling in `planTrip`** — produce ISO date strings (`YYYY-MM-DD`), use `new Date()` for "today", compute end via millisecond math.

### Verification Checklist

- [ ] `npm test` — all prior 38 + new ≥ 18 tests pass
- [ ] `npm run typecheck` exit 0
- [ ] `npm run build` produces .d.ts for all new symbols
- [ ] `grep -r "anthropic@\|@anthropic-ai\|openai@" packages/core/package.json` → 0 hits (no SDK deps)
- [ ] No Python files modified
- [ ] No frontend files modified
- [ ] FastAPI server still starts

---

Architect approval: [x] Pre-approved.
