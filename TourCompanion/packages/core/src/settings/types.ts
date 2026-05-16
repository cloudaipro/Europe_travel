// Settings module — platform-agnostic facade over a SecureStore.
// Implementations of SecureStore live in platform packages (iOS Keychain
// today; future Android may add EncryptedSharedPreferences). The web build
// never instantiates these — the web SPA talks to the FastAPI server which
// holds its own secrets server-side.

import { SETTINGS_KEYS, DEFAULT_OPENAI_MODEL } from "./keys.js";

export interface SecureStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
}

export interface TCSettings {
  getOpenAIKey(): Promise<string | null>;
  setOpenAIKey(key: string): Promise<void>;
  clearOpenAIKey(): Promise<void>;
  getOpenAIModel(): Promise<string>;
  setOpenAIModel(model: string): Promise<void>;
}

export function createSettings(store: SecureStore): TCSettings {
  return {
    async getOpenAIKey() {
      const raw = await store.get(SETTINGS_KEYS.openaiApiKey);
      if (raw == null) return null;
      const trimmed = raw.trim();
      return trimmed.length ? trimmed : null;
    },

    async setOpenAIKey(key) {
      const trimmed = (key ?? "").trim();
      if (!trimmed) {
        await store.remove(SETTINGS_KEYS.openaiApiKey);
        return;
      }
      await store.set(SETTINGS_KEYS.openaiApiKey, trimmed);
    },

    async clearOpenAIKey() {
      await store.remove(SETTINGS_KEYS.openaiApiKey);
    },

    async getOpenAIModel() {
      const raw = await store.get(SETTINGS_KEYS.openaiModel);
      const trimmed = (raw ?? "").trim();
      return trimmed.length ? trimmed : DEFAULT_OPENAI_MODEL;
    },

    async setOpenAIModel(model) {
      const trimmed = (model ?? "").trim();
      if (!trimmed) {
        await store.remove(SETTINGS_KEYS.openaiModel);
        return;
      }
      await store.set(SETTINGS_KEYS.openaiModel, trimmed);
    },
  };
}
