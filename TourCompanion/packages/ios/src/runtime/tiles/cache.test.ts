// Step 18 — unit tests for the pure URL-hashing helper. Filesystem read /
// write paths are not exercised here: they require the Capacitor native
// bridge to be present, which vitest can't supply. The behavioural cost
// of mocking Filesystem outweighs the value — those code paths are
// already gated by xcodebuild + manual smoke during step verification.

import { describe, it, expect } from "vitest";
import { urlToKey } from "./cache.js";

describe("urlToKey", () => {
  it("is deterministic for a given URL", () => {
    const url = "https://a.tile.openstreetmap.org/12/2048/1364.png";
    expect(urlToKey(url)).toBe(urlToKey(url));
  });

  it("returns a non-empty base-36 string", () => {
    const key = urlToKey("https://b.tile.openstreetmap.org/10/512/341.png");
    expect(key).toMatch(/^[0-9a-z]+$/);
    expect(key.length).toBeGreaterThan(0);
  });

  it("produces distinct keys for distinct URLs", () => {
    const a = urlToKey("https://a.tile.openstreetmap.org/12/2048/1364.png");
    const b = urlToKey("https://a.tile.openstreetmap.org/12/2048/1365.png");
    expect(a).not.toBe(b);
  });

  it("handles the empty string without throwing", () => {
    expect(typeof urlToKey("")).toBe("string");
  });
});
