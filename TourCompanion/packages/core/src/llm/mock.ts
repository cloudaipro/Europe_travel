// MockLLMClient — deterministic stub itinerary for tests + no-key dev mode.
// Ports server/app/planner.py :: _mock_plan.

import { LLMClient, LLMOptions } from "./types.js";
import { TripPlan, PlanInput } from "../planner/types.js";

export function buildMockPlan(input: PlanInput): TripPlan {
  const style = input.style || "mixed";
  const days = [];
  for (let i = 0; i < input.days; i++) {
    const stops = [];
    for (let j = 0; j < 4; j++) {
      const hour = 9 + 2 * j;
      stops.push({
        time_label: `${hour.toString().padStart(2, "0")}:00`,
        name: `Mock stop ${j + 1} (day ${i + 1})`,
        lat: 0.0,
        lng: 0.0,
        address: input.destination,
        hours: "9:00–18:00",
        tickets: "Free",
        intro: `Stub stop — replace with real planner output by setting ANTHROPIC_API_KEY.`,
        highlights: ["mock highlight"],
        transit: "Walk",
        washroom: "Nearby café",
        food: ["Nearby spot"],
      });
    }
    days.push({
      n: i + 1,
      date_label: `Day ${i + 1}`,
      theme: `Mock day ${i + 1}`,
      mode: "Walking",
      stops,
    });
  }
  return {
    name: `${input.destination} ${input.days}-day ${style} (mock)`,
    destination: input.destination,
    season: "any",
    style,
    pace: "Moderate",
    hotel_name: "Centrally located hotel",
    hotel_lat: 0.0,
    hotel_lng: 0.0,
    hotel_address: input.destination,
    bookings: [
      { label: `Top museum tickets in ${input.destination}`, url: "", done: false },
      { label: "Restaurant reservation for arrival night", url: "", done: false },
    ],
    days,
  };
}

// Tiny user-message parser so the mock client can read the input
// embedded in the user message produced by buildUserMessage().
function parseInputFromUserMessage(content: string): PlanInput {
  const lines = content.split("\n");
  let destination = "Unknown";
  let days = 1;
  let style: string | undefined;
  let sourceUrl: string | undefined;
  for (const line of lines) {
    if (line.startsWith("Destination: ")) destination = line.slice("Destination: ".length).trim();
    else if (line.startsWith("Number of days: ")) {
      const n = parseInt(line.slice("Number of days: ".length).trim(), 10);
      if (!Number.isNaN(n)) days = n;
    } else if (line.startsWith("Style: ")) style = line.slice("Style: ".length).trim();
    else if (line.startsWith("Source URL: ")) sourceUrl = line.slice("Source URL: ".length).trim();
  }
  return { destination, days, style, sourceUrl };
}

export class MockLLMClient implements LLMClient {
  readonly provider = "mock" as const;

  async complete(options: LLMOptions): Promise<string> {
    const user = options.messages.find((m) => m.role === "user");
    const input = user ? parseInputFromUserMessage(user.content) : { destination: "Unknown", days: 1 };
    const plan = buildMockPlan(input);
    return JSON.stringify(plan);
  }
}
