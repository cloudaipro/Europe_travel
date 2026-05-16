// Keys used by SecureStore-backed settings. Stable across versions —
// changing a value here would orphan existing iOS keychain entries.

export const SETTINGS_KEYS = {
  openaiApiKey: "openai_api_key",
  openaiModel: "openai_model",
} as const;

export const DEFAULT_OPENAI_MODEL = "gpt-4o";
