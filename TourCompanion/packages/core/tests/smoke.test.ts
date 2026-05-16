import { describe, it, expect } from "vitest";
import { CORE_VERSION } from "../src/index.js";

describe("core smoke", () => {
  it("exports CORE_VERSION 0.2.0", () => {
    expect(CORE_VERSION).toBe("0.2.0");
  });
});
