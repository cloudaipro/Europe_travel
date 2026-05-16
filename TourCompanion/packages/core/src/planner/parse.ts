// parsePlanResponse — strip code fence + JSON.parse → TripPlan.
// Mirrors the try/except in server/app/planner.py :: _call_anthropic.

import { stripCodeFence } from "./fence.js";
import { PlanParseError } from "../llm/types.js";
import { TripPlan } from "./types.js";

export function parsePlanResponse(rawText: string): TripPlan {
  const text = stripCodeFence(rawText);
  try {
    return JSON.parse(text) as TripPlan;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new PlanParseError(`planner output not valid JSON: ${msg}`, text.slice(0, 500));
  }
}
