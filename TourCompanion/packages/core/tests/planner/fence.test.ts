import { describe, it, expect } from "vitest";
import { stripCodeFence } from "../../src/planner/fence.js";

describe("stripCodeFence", () => {
  it("unwraps ```json ... ``` blocks", () => {
    const input = '```json\n{"a":1}\n```';
    expect(stripCodeFence(input)).toBe('{"a":1}');
  });

  it("unwraps bare ``` ... ``` blocks", () => {
    expect(stripCodeFence('```\n{"x":2}\n```')).toBe('{"x":2}');
  });

  it("passes plain text through", () => {
    expect(stripCodeFence('{"plain":true}')).toBe('{"plain":true}');
  });

  it("handles leading/trailing whitespace", () => {
    expect(stripCodeFence('   \n```json\n{"a":1}\n```  \n')).toBe('{"a":1}');
  });

  it("unfenced text is trimmed", () => {
    expect(stripCodeFence("  hello  ")).toBe("hello");
  });

  it("handles inline ```json{...}``` without newline", () => {
    // No newline after ```json — drop the first 3 chars.
    expect(stripCodeFence('```{"a":1}```')).toBe('{"a":1}');
  });
});
