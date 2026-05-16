import { describe, it, expect } from "vitest";
import { MockLLMClient } from "../../src/llm/mock.js";
import { buildUserMessage, SYSTEM_PROMPT } from "../../src/planner/plan.js";
import { TripPlan } from "../../src/planner/types.js";

describe("MockLLMClient", () => {
  it("returns valid TripPlan JSON for (Vienna, 3, mixed)", async () => {
    const client = new MockLLMClient();
    const userMsg = buildUserMessage({ destination: "Vienna", days: 3, style: "mixed" });
    const raw = await client.complete({
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMsg }],
      maxTokens: 8000,
    });

    const plan = JSON.parse(raw) as TripPlan;

    expect(plan.destination).toBe("Vienna");
    expect(plan.style).toBe("mixed");
    expect(plan.pace).toBe("Moderate");
    expect(plan.days).toHaveLength(3);
    expect(plan.days[0].n).toBe(1);
    expect(plan.days[0].stops).toHaveLength(4);
    expect(plan.days[0].stops[0].time_label).toBe("09:00");
    expect(plan.days[2].stops[3].time_label).toBe("15:00");
    expect(plan.bookings).toHaveLength(2);
  });

  it("provider name is 'mock'", () => {
    expect(new MockLLMClient().provider).toBe("mock");
  });

  it("defaults style to mixed when style omitted from user message", async () => {
    const client = new MockLLMClient();
    const userMsg = buildUserMessage({ destination: "Budapest", days: 2 });
    const raw = await client.complete({
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMsg }],
      maxTokens: 8000,
    });
    const plan = JSON.parse(raw) as TripPlan;
    expect(plan.style).toBe("mixed");
    expect(plan.days).toHaveLength(2);
  });
});
