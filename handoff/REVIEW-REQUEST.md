# Review Request — Step 10

**Step:** LLM Provider Abstraction (Anthropic + OpenAI adapters) + plan ingest port
**Ready for Review:** YES
**Date:** 2026-05-16
**Submitted by:** Bob

---

## Summary

Added provider-agnostic LLM interface in `packages/core/src/llm/` with Anthropic, OpenAI, and Mock adapters (raw `fetch`, no SDK deps). Ported `SYSTEM_PROMPT`, user-message builder, parser, and `plan_trip` orchestration from `server/app/planner.py` into `packages/core/src/planner/`. Python and frontend untouched — Step 11 wires web, Step 15 wires iOS.

`CORE_VERSION` bumped to `"0.3.0"`. Test count 38 → 67.

---

## Files (with line ranges)

### New source

| File | Lines | One-liner |
|---|---|---|
| `packages/core/src/llm/types.ts` | 1–41 | `LLMClient`, `LLMMessage`, `LLMOptions`, `LLMError`, `PlanParseError`. |
| `packages/core/src/llm/anthropic.ts` | 1–76 | `AnthropicClient`: raw `fetch` POST to `/v1/messages`, joins `content[].text` blocks; default `claude-sonnet-4-6`; throws `LLMError` on non-200. |
| `packages/core/src/llm/openai.ts` | 1–73 | `OpenAIClient`: raw `fetch` POST to `/v1/chat/completions`, system merged into messages array; default `gpt-4o`; throws `LLMError` on non-200. |
| `packages/core/src/llm/mock.ts` | 1–83 | `MockLLMClient` returns deterministic stub plan JSON (ports `_mock_plan`); `buildMockPlan` exported for direct use. |
| `packages/core/src/planner/types.ts` | 1–55 | `PlanInput`, `TripPlan`, `BookingPlan`, `DayPlan`, `StopPlan`. |
| `packages/core/src/planner/prompt.ts` | 1–53 | `SYSTEM_PROMPT` (byte-for-byte from Python, lines 11–42) + `buildUserMessage(input)` (lines 44–53). |
| `packages/core/src/planner/parse.ts` | 1–16 | `parsePlanResponse`: strip fence + `JSON.parse`, throws `PlanParseError` with 500-char excerpt. |
| `packages/core/src/planner/plan.ts` | 1–44 | `planTrip(client, input)`: 1..14 range guard (lines 21–23) → user msg → `client.complete` → parse → annotate start/end/source_url (lines 31–41). |

### New tests (29 cases total)

| File | Lines | Cases |
|---|---|---|
| `tests/llm/mock.test.ts` | 1–45 | 3 — TripPlan shape for (Vienna, 3, mixed); provider name; default style. |
| `tests/llm/anthropic.test.ts` | 1–103 | 6 — content extraction; URL/headers/body shape; non-200 → LLMError; fetchImpl honored; temperature passed; apiKey required; LLMError instance check. |
| `tests/llm/openai.test.ts` | 1–82 | 5 — choices extraction; URL/headers/body (Bearer + merged system); non-200 → LLMError; empty choices → ""; model override; apiKey required. |
| `tests/planner/prompt.test.ts` | 1–42 | 4 — full input format; URL-absent format; default style; SYSTEM_PROMPT landmarks. |
| `tests/planner/parse.test.ts` | 1–51 | 5 — plain JSON; ```json fence; ``` fence; bad JSON → PlanParseError; excerpt ≤ 500 chars. |
| `tests/planner/plan.test.ts` | 1–84 | 6 — RangeError (0, 15); start/end/source_url annotation; days=1 single-day; setdefault semantics; source_url default "". |

### Modified

| File | Lines | Change |
|---|---|---|
| `packages/core/src/index.ts` | 12–28 | Added LLM + planner exports; bumped `CORE_VERSION` to `"0.3.0"` (line 29). |
| `packages/core/package.json` | 3 | Version `0.2.0` → `0.3.0`. |
| `packages/core/tests/smoke.test.ts` | 5–7 | Assertion bumped to `"0.3.0"`. |

---

## Key Decisions (flag if any wrong)

1. **Raw `fetch`, no SDK.** Both adapters take `fetchImpl?: typeof fetch` so tests inject mocks. Verified by 11 anthropic+openai cases asserting URL, headers, body shape end-to-end against a `vi.fn`.
2. **`SYSTEM_PROMPT` byte-for-byte.** Python uses `"""\` (suppresses leading newline) and ends with `\n` — TS template literal matches. Verified visually + 4 landmark substring checks.
3. **`buildUserMessage` byte-for-byte.** Hand-computed expected strings vs Python for URL-present and URL-absent cases.
4. **Mock client parses the user message** to recover `(destination, days, style, sourceUrl)`. Only way to honor the `LLMClient.complete` contract while still producing `_mock_plan`-equivalent output. Format is fixed by `buildUserMessage`, so lossless.
5. **UTC date math** in `planTrip` (`Date.UTC(...)` + `86400000`-ms steps). Python `date.today()` is timezone-naive local; UTC is the lowest-surprise choice for a portable core that will run on web, iOS, and CI.
6. **Setdefault semantics preserved.** `planTrip` only sets `start_date`/`end_date`/`source_url` if the model didn't already supply them — mirrors Python `plan.setdefault(...)`. Test pins this.
7. **`PlanParseError.excerpt` = `text.slice(0, 500)`** — matches Python `text[:500]`.
8. **`StopPlan.highlights`/`food` typed `string[]`** (vs `unknown[]` on the consumer-side `Stop` from Step 9). This is the producer schema where the prompt commits to bullet strings.

---

## Verification Run

```
npm test       → 67/67 pass across 14 files
npm run typecheck → exit 0
npm run build  → .d.ts emitted for all new symbols under dist/llm/ + dist/planner/
grep "anthropic@|@anthropic-ai|openai@" packages/core/package.json → 0 hits
git diff --stat TourCompanion/server/ TourCompanion/server/frontend/ → empty
FastAPI import smoke → IMPORT_OK
```

---

## Open Questions

None — brief was unambiguous and pre-approved. Step 11 will wire web to `AnthropicClient`; Step 15 wires iOS to `OpenAIClient`.

---

## Out-of-Scope (deferred)

- Web frontend swap to `AnthropicClient` (Step 11).
- iOS Capacitor wiring to `OpenAIClient` (Step 15).
- Python `planner.py` deprecation (Step 11 retires it).
