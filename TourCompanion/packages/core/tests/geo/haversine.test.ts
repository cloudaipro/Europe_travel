import { describe, it, expect } from "vitest";
import { haversineKm } from "../../src/geo/haversine.js";

describe("haversineKm", () => {
  it("identical points = 0", () => {
    expect(haversineKm(0, 0, 0, 0)).toBe(0);
    expect(haversineKm(48.2, 16.4, 48.2, 16.4)).toBe(0);
  });

  it("Berlin → Paris ≈ 878 km (±5)", () => {
    const d = haversineKm(52.52, 13.4, 48.85, 2.35);
    expect(d).toBeGreaterThan(873);
    expect(d).toBeLessThan(883);
  });

  it("antipodal points ≈ half Earth circumference", () => {
    // (0,0) ↔ (0,180) → π·R = π·6371 ≈ 20015
    const d = haversineKm(0, 0, 0, 180);
    expect(d).toBeGreaterThan(20010);
    expect(d).toBeLessThan(20020);
  });

  it("symmetric (a→b == b→a)", () => {
    const a = haversineKm(52.52, 13.4, 48.85, 2.35);
    const b = haversineKm(48.85, 2.35, 52.52, 13.4);
    expect(a).toBeCloseTo(b, 9);
  });
});
