// planTrip — orchestrates LLMClient call → parsed TripPlan with date annotations.
// Mirrors server/app/planner.py :: plan_trip.

import { LLMClient } from "../llm/types.js";
import { SYSTEM_PROMPT, buildUserMessage } from "./prompt.js";
import { parsePlanResponse } from "./parse.js";
import { PlanInput, TripPlan } from "./types.js";

export { SYSTEM_PROMPT, buildUserMessage, parsePlanResponse };

const MAX_TOKENS = 8000;

function isoDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function planTrip(client: LLMClient, input: PlanInput): Promise<TripPlan> {
  if (input.days < 1 || input.days > 14) {
    throw new RangeError("days must be 1..14");
  }

  const userMsg = buildUserMessage(input);
  const raw = await client.complete({
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMsg }],
    maxTokens: MAX_TOKENS,
  });

  const plan = parsePlanResponse(raw);

  // Today (UTC date) → start; +days-1 → end.
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(start.getTime() + (input.days - 1) * 86400000);

  if (plan.start_date === undefined) plan.start_date = isoDate(start);
  if (plan.end_date === undefined) plan.end_date = isoDate(end);
  if (plan.source_url === undefined) plan.source_url = input.sourceUrl ?? "";

  return plan;
}
