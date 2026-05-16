# Review Feedback — Step 10
Date: 2026-05-16
Ready for Builder: YES

## Must Fix

None.

## Should Fix

None.

## Escalate to Architect

None. (One observation, not a defect — flagged here for visibility only, no action
required from Bob:)

- TS Anthropic adapter defaults to `claude-sonnet-4-6` per brief.
  Python `server/app/config.py:39` still defaults to `claude-haiku-4-5-20251001`.
  Step 11 retires Python so this divergence is by design; flagging only so Arch
  confirms Step 11 keeps the TS default rather than carrying the Python default
  forward.

## Cleared

Reviewed 8 new source files + 6 new test files + 3 modified files against
ARCHITECT-BRIEF Step 10. Cross-referenced `server/app/planner.py` for parity.

Verification results (run from `TourCompanion/`):

- `npm test` — 67/67 pass across 14 files (38 prior + 29 new; brief required ≥ 18).
- `npm run typecheck` — strict mode, exits 0.
- `npm run build` — `.d.ts` emitted for every new symbol under `dist/llm/`
  (anthropic, openai, mock, types) and `dist/planner/` (plan, parse, prompt, types).
- `grep "anthropic@\|@anthropic-ai\|openai@" packages/core/package.json` — 0 hits.
  devDependencies = `@types/node`, `typescript`, `vitest` only. No SDKs.
- `git status` — `server/` and `server/frontend/` untouched. No Python files
  modified.
- No real network in tests: every adapter test injects `fetchImpl = vi.fn(...)`;
  planner tests use `MockLLMClient` and an inline `FixedClient`.
- Strict TS: only `any` occurrence in `src/llm/` + `src/planner/` is the literal
  string `"any"` for `season` in `buildMockPlan` (matches Python).

Behavioral parity spot-checks vs Python `planner.py`:

- **`SYSTEM_PROMPT` byte-for-byte** — Python `len = 1300`, TS `len = 1300`,
  full string equality confirmed by Python diff harness comparing
  `planner.py:11-47` against the TS template literal. Includes leading line
  (Python `"""\` suppresses the leading newline) and trailing `\n`.
- **`buildUserMessage` byte-for-byte** vs `_call_anthropic` user-msg builder
  (planner.py:104-110): `Destination:`, `Number of days:`, `Style:` (default
  `mixed`), optional `Source URL:`, blank line, `Return the JSON object.` Pinned
  by tests at `tests/planner/prompt.test.ts:5-30` for URL-present and URL-absent
  forms.
- **`AnthropicClient`** — POST `https://api.anthropic.com/v1/messages`; headers
  `x-api-key`, `anthropic-version: 2023-06-01`, `content-type: application/json`;
  body `{model, max_tokens, system, messages, temperature?}`; joins
  `content[].text` blocks (filtered by `typeof b.text === "string"`, matching
  Python `hasattr(b, "text")`). Default model `claude-sonnet-4-6`. Non-200 →
  `LLMError("anthropic", status, message)`. `fetchImpl` injectable. Six tests.
- **`OpenAIClient`** — POST `https://api.openai.com/v1/chat/completions`; header
  `Authorization: Bearer <key>`; system merged into `messages[]` as
  `{role:"system", content:system}` ahead of caller messages; default model
  `gpt-4o`; extracts `choices[0].message.content`; missing/empty choices → `""`.
  Non-200 → `LLMError("openai", status, …)`. Five tests.
- **`MockLLMClient`** — `_mock_plan` port matches Python field-for-field: name
  template `${dest} ${days}-day ${style} (mock)`, hotel placeholder, exactly 2
  bookings, `9 + 2*j` time labels (`09:00, 11:00, 13:00, 15:00`), 4 stops/day,
  identical literals for `hours`, `tickets`, `washroom`, `food`, `transit`,
  `intro`. Recovers `PlanInput` by reversing the fixed `buildUserMessage` format
  — lossless because that format is itself under test. `provider = "mock"`.
- **`parsePlanResponse`** — reuses Step 9 `stripCodeFence`, then `JSON.parse`,
  throws `PlanParseError` with `text.slice(0, 500)`. Matches Python `text[:500]`
  in `_call_anthropic` (planner.py:122) — both truncate after fence strip.
  Excerpt-length test pins `≤ 500` and `== 500` on a 1000-char payload.
- **`planTrip`** — rejects `days = 0` and `days = 15` with `RangeError("days must
  be 1..14")` matching Python `ValueError("days must be 1..14")` (modulo type —
  brief explicitly upgrades to RangeError). Accepts `days = 1` (test:
  `start_date === end_date`) and `days = 14` (implicit via mock path). UTC date
  math: `start = Date.UTC(today)`, `end = start + (days - 1) * 86400000 ms`,
  ISO `YYYY-MM-DD`. Setdefault semantics preserved — model-supplied
  `start_date`/`end_date`/`source_url` are not overwritten
  (test `plan.test.ts:59-78`, mirrors Python `plan.setdefault(...)`).
  `source_url` defaults to `""` when input omits it (matches Python).
- **`LLMError`** — public `provider`, `status` + super `message`,
  `name = "LLMError"`. **`PlanParseError`** — super `message`, public `excerpt`,
  `name = "PlanParseError"`. Both match brief shapes verbatim.

Public surface — `src/index.ts:13-27`:

- Types: `LLMClient`, `LLMMessage`, `LLMOptions`, `PlanInput`, `TripPlan`,
  `BookingPlan`, `DayPlan`, `StopPlan`.
- Classes: `LLMError`, `PlanParseError`, `AnthropicClient`, `OpenAIClient`,
  `MockLLMClient`.
- Functions: `planTrip`, `parsePlanResponse`, `buildUserMessage`.
- Constants: `SYSTEM_PROMPT`, `CORE_VERSION = "0.3.0"`. `package.json:3`
  also bumped to `"0.3.0"`. `tests/smoke.test.ts:5-7` asserts new version.

Out-of-scope confirmed untouched: `server/app/planner.py`, all of `server/`,
`server/frontend/index.html`, `packages/ios/`, `packages/web/`.

Decision audit — all six "Key Decisions" in REVIEW-REQUEST.md are
defensible:

1. Raw `fetch` + `fetchImpl` — matches brief mandate "no SDK deps".
2. `SYSTEM_PROMPT` byte-for-byte — verified above.
3. `buildUserMessage` byte-for-byte — verified above.
4. Mock client parses the user message — lossless given format is under test.
5. UTC date math — brief said "produce ISO date strings, use `new Date()` for
   today, compute end via ms math". UTC is the right call for a portable core
   (web/iOS/CI all behave identically). Pinned by test computing the same way.
6. Setdefault semantics — pinned by `plan.test.ts:59-78`.

Step 10 is clear.
