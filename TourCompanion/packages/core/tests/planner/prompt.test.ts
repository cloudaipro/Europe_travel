import { describe, it, expect } from "vitest";
import { buildUserMessage, SYSTEM_PROMPT } from "../../src/planner/plan.js";

describe("buildUserMessage", () => {
  it("matches Python format for full input", () => {
    // Python output for (destination=Vienna, days=3, source_url=https://x, style=foodie):
    // "Destination: Vienna\n"
    // "Number of days: 3\n"
    // "Style: foodie\n"
    // "Source URL: https://x\n"
    // "\nReturn the JSON object."
    const expected =
      "Destination: Vienna\n" +
      "Number of days: 3\n" +
      "Style: foodie\n" +
      "Source URL: https://x\n" +
      "\nReturn the JSON object.";
    expect(
      buildUserMessage({ destination: "Vienna", days: 3, style: "foodie", sourceUrl: "https://x" }),
    ).toBe(expected);
  });

  it("omits Source URL line when sourceUrl missing", () => {
    const expected =
      "Destination: Budapest\n" +
      "Number of days: 5\n" +
      "Style: mixed\n" +
      "\nReturn the JSON object.";
    expect(buildUserMessage({ destination: "Budapest", days: 5 })).toBe(expected);
  });

  it("defaults style to mixed when style is empty", () => {
    expect(buildUserMessage({ destination: "Paris", days: 1, style: "" })).toContain("Style: mixed\n");
  });

  it("SYSTEM_PROMPT contains schema landmarks", () => {
    expect(SYSTEM_PROMPT).toContain("research-grounded travel itinerary builder");
    expect(SYSTEM_PROMPT).toContain('"hotel_name"');
    expect(SYSTEM_PROMPT).toContain("4-6 stops per day");
    expect(SYSTEM_PROMPT).toContain("Output ONLY the JSON object");
  });
});
