// LLM provider abstraction — provider-agnostic message + client surface.
// Adapters (anthropic, openai, mock) implement LLMClient.

export interface LLMMessage {
  role: "system" | "user";
  content: string;
}

export interface LLMOptions {
  system: string;
  messages: LLMMessage[];
  maxTokens: number;
  temperature?: number;
  model?: string;
}

export interface LLMClient {
  readonly provider: "anthropic" | "openai" | "mock";
  complete(options: LLMOptions): Promise<string>;
}

export class LLMError extends Error {
  constructor(
    public provider: string,
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "LLMError";
  }
}

export class PlanParseError extends Error {
  constructor(
    message: string,
    public excerpt: string,
  ) {
    super(message);
    this.name = "PlanParseError";
  }
}
