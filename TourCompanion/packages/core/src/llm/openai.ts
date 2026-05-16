// OpenAI Chat Completions adapter — raw fetch, no SDK.
// Endpoint: https://api.openai.com/v1/chat/completions
// Note: system message is merged into the messages array (OpenAI shape).

import { LLMClient, LLMOptions, LLMError } from "./types.js";

const DEFAULT_MODEL = "gpt-4o";
const ENDPOINT = "https://api.openai.com/v1/chat/completions";

interface OpenAIOpts {
  apiKey: string;
  model?: string;
  fetchImpl?: typeof fetch;
}

interface OpenAIChoice {
  message?: { content?: string };
}

interface OpenAIResponse {
  choices?: OpenAIChoice[];
}

export class OpenAIClient implements LLMClient {
  readonly provider = "openai" as const;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: OpenAIOpts) {
    if (!opts.apiKey) throw new Error("OpenAIClient: apiKey required");
    this.apiKey = opts.apiKey;
    this.model = opts.model ?? DEFAULT_MODEL;
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  async complete(options: LLMOptions): Promise<string> {
    const body: Record<string, unknown> = {
      model: options.model ?? this.model,
      max_tokens: options.maxTokens,
      messages: [
        { role: "system", content: options.system },
        ...options.messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    };
    if (options.temperature !== undefined) body.temperature = options.temperature;

    const res = await this.fetchImpl(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await safeText(res);
      throw new LLMError("openai", res.status, `OpenAI API error ${res.status}: ${text}`);
    }

    const json = (await res.json()) as OpenAIResponse;
    return json.choices?.[0]?.message?.content ?? "";
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}
