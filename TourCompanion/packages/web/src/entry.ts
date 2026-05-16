// Re-export the slice of @tourcompanion/core that the web frontend needs.
// Exposed on globalThis.TC by the IIFE bundle.
export {
  stopTimeSortKey,
  parseStopTime,
  cleanName,
  extractCity,
  buildQueries,
  haversineKm,
  viewboxAround,
  generateSlug,
  sanitizeTripForPublic,
  CORE_VERSION,
} from "@tourcompanion/core";
