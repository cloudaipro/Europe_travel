import { describe, it, expect } from "vitest";
import { parseStopTime, stopTimeSortKey } from "../../src/time/parse.js";

describe("parseStopTime", () => {
  it("parses HH:MM same-day", () => {
    expect(parseStopTime("09:30")).toEqual({ minutes: 570, dayOffset: 0 });
    expect(parseStopTime("00:00")).toEqual({ minutes: 0, dayOffset: 0 });
    expect(parseStopTime("23:59")).toEqual({ minutes: 1439, dayOffset: 0 });
  });

  it("parses +N next-day notation", () => {
    expect(parseStopTime("01:15 +1")).toEqual({ minutes: 75, dayOffset: 1 });
    expect(parseStopTime("23:00 +2")).toEqual({ minutes: 1380, dayOffset: 2 });
    expect(parseStopTime("00:24 +1")).toEqual({ minutes: 24, dayOffset: 1 });
  });

  it("throws on malformed input", () => {
    expect(() => parseStopTime("")).toThrow();
    expect(() => parseStopTime("noon")).toThrow();
    expect(() => parseStopTime("9:5")).toThrow();
  });
});

describe("stopTimeSortKey", () => {
  it("orders same-day stamps correctly", () => {
    expect(stopTimeSortKey("09:30")).toBe(570);
    expect(stopTimeSortKey("23:42")).toBe(1422);
  });

  it("next-day stamps sort after same-day ones", () => {
    // KG-7 invariant: 00:24 +1 (1464) > 23:42 (1422)
    expect(stopTimeSortKey("00:24 +1")).toBe(1464);
    expect(stopTimeSortKey("00:24 +1")).toBeGreaterThan(
      stopTimeSortKey("23:42"),
    );
  });

  it("multi-day offsets stack", () => {
    expect(stopTimeSortKey("00:00 +2")).toBe(2880);
    expect(stopTimeSortKey("23:00 +2")).toBeGreaterThan(
      stopTimeSortKey("00:24 +1"),
    );
  });
});
