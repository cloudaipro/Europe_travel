import { describe, it, expect, vi } from "vitest";
import { OpenAIClient } from "../../src/llm/openai.js";
import { LLMError } from "../../src/llm/types.js";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("OpenAIClient", () => {
  it("extracts choices[0].message.content", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, {
        choices: [{ message: { content: "hello world" } }],
      }),
    ) as unknown as typeof fetch;

    const client = new OpenAIClient({ apiKey: "k", fetchImpl });
    const text = await client.complete({
      system: "sys",
      messages: [{ role: "user", content: "u" }],
      maxTokens: 100,
    });

    expect(text).toBe("hello world");

    const fm = fetchImpl as unknown as ReturnType<typeof vi.fn>;
    const [url, init] = fm.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    const headers = init.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer k");
    expect(headers["content-type"]).toBe("application/json");
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe("gpt-4o");
    expect(body.max_tokens).toBe(100);
    // system merged into messages
    expect(body.messages).toEqual([
      { role: "system", content: "sys" },
      { role: "user", content: "u" },
    ]);
  });

  it("throws LLMError on non-200 response", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response("forbidden", { status: 403 }),
    ) as unknown as typeof fetch;

    const client = new OpenAIClient({ apiKey: "k", fetchImpl });
    await expect(
      client.complete({ system: "s", messages: [{ role: "user", content: "u" }], maxTokens: 10 }),
    ).rejects.toBeInstanceOf(LLMError);
  });

  it("returns empty string when choices missing", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, {})) as unknown as typeof fetch;
    const client = new OpenAIClient({ apiKey: "k", fetchImpl });
    const text = await client.complete({
      system: "s",
      messages: [{ role: "user", content: "u" }],
      maxTokens: 10,
    });
    expect(text).toBe("");
  });

  it("custom model override is honored", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, { choices: [{ message: { content: "x" } }] }),
    ) as unknown as typeof fetch;
    const client = new OpenAIClient({ apiKey: "k", model: "gpt-5", fetchImpl });
    await client.complete({ system: "s", messages: [{ role: "user", content: "u" }], maxTokens: 10 });
    const body = JSON.parse(
      ((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit])[1].body as string,
    );
    expect(body.model).toBe("gpt-5");
  });

  it("requires apiKey", () => {
    expect(() => new OpenAIClient({ apiKey: "" })).toThrow();
  });
});
