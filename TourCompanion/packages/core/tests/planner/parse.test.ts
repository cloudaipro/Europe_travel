import { describe, it, expect } from "vitest";
import { parsePlanResponse } from "../../src/planner/plan.js";
import { PlanParseError } from "../../src/llm/types.js";

const validJson = JSON.stringify({
  name: "Test",
  destination: "Vienna",
  season: "spring",
  style: "mixed",
  pace: "Moderate",
  hotel_name: "Center",
  hotel_lat: 0,
  hotel_lng: 0,
  hotel_address: "Vienna",
  bookings: [],
  days: [],
});

describe("parsePlanResponse", () => {
  it("parses plain JSON", () => {
    const plan = parsePlanResponse(validJson);
    expect(plan.destination).toBe("Vienna");
  });

  it("strips ```json fence", () => {
    const plan = parsePlanResponse("```json\n" + validJson + "\n```");
    expect(plan.destination).toBe("Vienna");
  });

  it("strips bare ``` fence", () => {
    const plan = parsePlanResponse("```\n" + validJson + "\n```");
    expect(plan.destination).toBe("Vienna");
  });

  it("throws PlanParseError on bad JSON", () => {
    expect(() => parsePlanResponse("not json {{{")).toThrow(PlanParseError);
  });

  it("PlanParseError includes truncated excerpt (≤500 chars)", () => {
    const big = "x".repeat(1000);
    try {
      parsePlanResponse(big);
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(PlanParseError);
      const err = e as PlanParseError;
      expect(err.excerpt.length).toBeLessThanOrEqual(500);
      expect(err.excerpt.length).toBe(500);
    }
  });
});
