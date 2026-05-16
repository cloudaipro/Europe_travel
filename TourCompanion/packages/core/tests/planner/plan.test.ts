import { describe, it, expect } from "vitest";
import { planTrip } from "../../src/planner/plan.js";
import { MockLLMClient } from "../../src/llm/mock.js";
import { LLMClient, LLMOptions } from "../../src/llm/types.js";

class FixedClient implements LLMClient {
  readonly provider = "mock" as const;
  constructor(private readonly text: string) {}
  async complete(_opts: LLMOptions): Promise<string> {
    return this.text;
  }
}

function isoDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

describe("planTrip", () => {
  it("rejects days < 1", async () => {
    const client = new MockLLMClient();
    await expect(planTrip(client, { destination: "Vienna", days: 0 })).rejects.toBeInstanceOf(RangeError);
  });

  it("rejects days > 14", async () => {
    const client = new MockLLMClient();
    await expect(planTrip(client, { destination: "Vienna", days: 15 })).rejects.toBeInstanceOf(RangeError);
  });

  it("annotates start_date, end_date, source_url", async () => {
    const client = new MockLLMClient();
    const plan = await planTrip(client, {
      destination: "Vienna",
      days: 3,
      sourceUrl: "https://example.com",
      style: "mixed",
    });

    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const expectedStart = isoDate(start);
    const expectedEnd = isoDate(new Date(start.getTime() + 2 * 86400000));

    expect(plan.start_date).toBe(expectedStart);
    expect(plan.end_date).toBe(expectedEnd);
    expect(plan.source_url).toBe("https://example.com");
    expect(plan.destination).toBe("Vienna");
    expect(plan.days).toHaveLength(3);
  });

  it("end_date = start + days - 1 for days=1", async () => {
    const client = new MockLLMClient();
    const plan = await planTrip(client, { destination: "Paris", days: 1 });
    expect(plan.start_date).toBe(plan.end_date);
  });

  it("uses model's start_date/end_date if present (does not overwrite)", async () => {
    const json = JSON.stringify({
      name: "x",
      destination: "Vienna",
      season: "s",
      style: "mixed",
      pace: "Moderate",
      hotel_name: "h",
      hotel_lat: 0,
      hotel_lng: 0,
      hotel_address: "a",
      bookings: [],
      days: [],
      start_date: "2025-01-01",
      end_date: "2025-01-03",
    });
    const plan = await planTrip(new FixedClient(json), { destination: "Vienna", days: 3 });
    expect(plan.start_date).toBe("2025-01-01");
    expect(plan.end_date).toBe("2025-01-03");
  });

  it("source_url defaults to empty string when not provided", async () => {
    const plan = await planTrip(new MockLLMClient(), { destination: "Paris", days: 2 });
    expect(plan.source_url).toBe("");
  });
});
