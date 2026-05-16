import { describe, it, expect } from "vitest";
import { generateSlug } from "../../src/trips/slug.js";

const URLSAFE_RE = /^[A-Za-z0-9_-]{10}$/;

describe("generateSlug", () => {
  it("returns a non-empty 10-char urlsafe string", () => {
    const s = generateSlug();
    expect(s).toHaveLength(10);
    expect(URLSAFE_RE.test(s)).toBe(true);
  });

  it("1000 calls produce no collisions and all match the urlsafe alphabet", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      const s = generateSlug();
      expect(URLSAFE_RE.test(s)).toBe(true);
      seen.add(s);
    }
    expect(seen.size).toBe(1000);
  });
});
