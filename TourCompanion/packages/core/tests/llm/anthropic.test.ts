import { describe, it, expect, vi } from "vitest";
import { AnthropicClient } from "../../src/llm/anthropic.js";
import { LLMError } from "../../src/llm/types.js";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("AnthropicClient", () => {
  it("extracts concatenated text from content[] blocks", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, {
        content: [
          { type: "text", text: "hello " },
          { type: "text", text: "world" },
        ],
      }),
    ) as unknown as typeof fetch;

    const client = new AnthropicClient({ apiKey: "k", fetchImpl });
    const text = await client.complete({
      system: "sys",
      messages: [{ role: "user", content: "u" }],
      maxTokens: 100,
    });

    expect(text).toBe("hello world");

    const fm = fetchImpl as unknown as ReturnType<typeof vi.fn>;
    const [url, init] = fm.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    const headers = init.headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe("k");
    expect(headers["anthropic-version"]).toBe("2023-06-01");
    expect(headers["content-type"]).toBe("application/json");
    const body = JSON.parse(init.body as string);
    expect(body.system).toBe("sys");
    expect(body.max_tokens).toBe(100);
    expect(body.model).toBe("claude-sonnet-4-6");
    expect(body.messages).toEqual([{ role: "user", content: "u" }]);
  });

  it("throws LLMError on non-200 response", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response("rate limited", { status: 429 }),
    ) as unknown as typeof fetch;

    const client = new AnthropicClient({ apiKey: "k", fetchImpl });
    await expect(
      client.complete({ system: "s", messages: [{ role: "user", content: "u" }], maxTokens: 10 }),
    ).rejects.toMatchObject({
      name: "LLMError",
      provider: "anthropic",
      status: 429,
    });
  });

  it("honors custom fetchImpl override", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, { content: [{ type: "text", text: "ok" }] }),
    ) as unknown as typeof fetch;

    const client = new AnthropicClient({ apiKey: "k", fetchImpl });
    await client.complete({ system: "s", messages: [{ role: "user", content: "u" }], maxTokens: 10 });
    expect((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
  });

  it("passes temperature when provided", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, { content: [{ type: "text", text: "x" }] }),
    ) as unknown as typeof fetch;
    const client = new AnthropicClient({ apiKey: "k", fetchImpl });
    await client.complete({
      system: "s",
      messages: [{ role: "user", content: "u" }],
      maxTokens: 10,
      temperature: 0.5,
    });
    const body = JSON.parse(
      ((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit])[1].body as string,
    );
    expect(body.temperature).toBe(0.5);
  });

  it("requires apiKey", () => {
    expect(() => new AnthropicClient({ apiKey: "" })).toThrow();
  });

  it("LLMError instance is correct", async () => {
    const fetchImpl = vi.fn(async () => new Response("nope", { status: 500 })) as unknown as typeof fetch;
    const client = new AnthropicClient({ apiKey: "k", fetchImpl });
    let err: unknown = null;
    try {
      await client.complete({ system: "s", messages: [{ role: "user", content: "u" }], maxTokens: 10 });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(LLMError);
  });
});
