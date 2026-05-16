export * from "./types/index.js";
export { haversineKm } from "./geo/haversine.js";
export { cleanName, extractCity, buildQueries } from "./geo/name.js";
export { viewboxAround } from "./geo/viewbox.js";
export type { Viewbox } from "./geo/viewbox.js";
export { stripCodeFence } from "./planner/fence.js";
export { generateSlug } from "./trips/slug.js";
export { sanitizeTripForPublic } from "./trips/sanitize.js";
export { parseStopTime, stopTimeSortKey } from "./time/parse.js";
export type { StopTime } from "./time/parse.js";

// LLM provider abstraction
export type { LLMClient, LLMMessage, LLMOptions } from "./llm/types.js";
export { LLMError, PlanParseError } from "./llm/types.js";
export { AnthropicClient } from "./llm/anthropic.js";
export { OpenAIClient } from "./llm/openai.js";
export { MockLLMClient } from "./llm/mock.js";

// Planner module
export { planTrip, parsePlanResponse, buildUserMessage, SYSTEM_PROMPT } from "./planner/plan.js";
export type {
  PlanInput,
  TripPlan,
  BookingPlan,
  DayPlan,
  StopPlan,
} from "./planner/types.js";

// Store interface (TripStore) — implementations live in platform packages.
export type {
  TripStore,
  TripCreateInput,
  StopCreateInput,
  CheckInInput,
  JournalUpdate,
  VoiceNoteInput,
} from "./store/types.js";

// Settings module — SecureStore-backed user preferences (iOS only today).
export type { SecureStore, TCSettings } from "./settings/types.js";
export { createSettings } from "./settings/types.js";
export { SETTINGS_KEYS, DEFAULT_OPENAI_MODEL } from "./settings/keys.js";

export const CORE_VERSION = "0.5.0";
