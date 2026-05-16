import { describe, it, expect } from "vitest";
import { viewboxAround } from "../../src/geo/viewbox.js";

describe("viewboxAround", () => {
  it("returns (lon_min, lat_min, lon_max, lat_max)", () => {
    const [lonMin, latMin, lonMax, latMax] = viewboxAround(48.2, 16.4, 0.1);
    expect(lonMin).toBeCloseTo(16.3, 9);
    expect(latMin).toBeCloseTo(48.1, 9);
    expect(lonMax).toBeCloseTo(16.5, 9);
    expect(latMax).toBeCloseTo(48.3, 9);
  });

  it("zero delta collapses to a point", () => {
    expect(viewboxAround(10, 20, 0)).toEqual([20, 10, 20, 10]);
  });

  it("preserves ordering: min < max on both axes for positive delta", () => {
    const [lonMin, latMin, lonMax, latMax] = viewboxAround(0, 0, 1);
    expect(lonMin).toBeLessThan(lonMax);
    expect(latMin).toBeLessThan(latMax);
  });
});
