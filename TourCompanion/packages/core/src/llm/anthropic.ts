// Anthropic Messages API adapter — raw fetch, no SDK.
// Endpoint: https://api.anthropic.com/v1/messages

import { LLMClient, LLMOptions, LLMError } from "./types.js";

const DEFAULT_MODEL = "claude-sonnet-4-6";
const ENDPOINT = "https://api.anthropic.com/v1/messages";

interface AnthropicOpts {
  apiKey: string;
  model?: string;
  fetchImpl?: typeof fetch;
}

interface AnthropicContentBlock {
  type?: string;
  text?: string;
}

interface AnthropicResponse {
  content?: AnthropicContentBlock[];
}

export class AnthropicClient implements LLMClient {
  readonly provider = "anthropic" as const;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: AnthropicOpts) {
    if (!opts.apiKey) throw new Error("AnthropicClient: apiKey required");
    this.apiKey = opts.apiKey;
    this.model = opts.model ?? DEFAULT_MODEL;
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  async complete(options: LLMOptions): Promise<string> {
    const body: Record<string, unknown> = {
      model: options.model ?? this.model,
      max_tokens: options.maxTokens,
      system: options.system,
      messages: options.messages.map((m) => ({ role: m.role, content: m.content })),
    };
    if (options.temperature !== undefined) body.temperature = options.temperature;

    const res = await this.fetchImpl(ENDPOINT, {
      method: "POST",
      headers: {
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await safeText(res);
      throw new LLMError("anthropic", res.status, `Anthropic API error ${res.status}: ${text}`);
    }

    const json = (await res.json()) as AnthropicResponse;
    const blocks = json.content ?? [];
    return blocks
      .filter((b) => typeof b.text === "string")
      .map((b) => b.text as string)
      .join("");
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}
