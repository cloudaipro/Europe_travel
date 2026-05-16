import { describe, it, expect, beforeEach } from "vitest";
import {
  createSettings,
  SETTINGS_KEYS,
  DEFAULT_OPENAI_MODEL,
  type SecureStore,
} from "../../src/index.js";

function makeMemoryStore(): SecureStore & { _data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    _data: data,
    async get(key) {
      return data.has(key) ? data.get(key)! : null;
    },
    async set(key, value) {
      data.set(key, value);
    },
    async remove(key) {
      data.delete(key);
    },
    async clear() {
      data.clear();
    },
  };
}

describe("createSettings", () => {
  let store: ReturnType<typeof makeMemoryStore>;

  beforeEach(() => {
    store = makeMemoryStore();
  });

  it("returns null for OpenAI key when unset", async () => {
    const s = createSettings(store);
    expect(await s.getOpenAIKey()).toBeNull();
  });

  it("round-trips OpenAI key via SecureStore", async () => {
    const s = createSettings(store);
    await s.setOpenAIKey("sk-test-123");
    expect(store._data.get(SETTINGS_KEYS.openaiApiKey)).toBe("sk-test-123");
    expect(await s.getOpenAIKey()).toBe("sk-test-123");
  });

  it("trims whitespace and treats empty as remove", async () => {
    const s = createSettings(store);
    await s.setOpenAIKey("  sk-trim  ");
    expect(await s.getOpenAIKey()).toBe("sk-trim");
    await s.setOpenAIKey("   ");
    expect(await s.getOpenAIKey()).toBeNull();
    expect(store._data.has(SETTINGS_KEYS.openaiApiKey)).toBe(false);
  });

  it("clearOpenAIKey removes the entry", async () => {
    const s = createSettings(store);
    await s.setOpenAIKey("sk-x");
    await s.clearOpenAIKey();
    expect(await s.getOpenAIKey()).toBeNull();
  });

  it("defaults model to gpt-4o", async () => {
    const s = createSettings(store);
    expect(await s.getOpenAIModel()).toBe(DEFAULT_OPENAI_MODEL);
  });

  it("round-trips model and falls back to default on empty", async () => {
    const s = createSettings(store);
    await s.setOpenAIModel("gpt-4o-mini");
    expect(await s.getOpenAIModel()).toBe("gpt-4o-mini");
    await s.setOpenAIModel("");
    expect(await s.getOpenAIModel()).toBe(DEFAULT_OPENAI_MODEL);
  });
});
