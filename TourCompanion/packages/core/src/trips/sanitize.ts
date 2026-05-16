// Public-trip sanitization. Ports server/app/routes/trips.py
// :: _public_trip_to_detail. Takes a fully-formed TripDetail and returns a
// new sanitized copy: zeros IDs, drops journal, bookings, published_slug,
// and per-stop note / check_in_count / photo_paths / voice_transcript.

import type { TripDetail } from "../types/trip.js";

export function sanitizeTripForPublic(detail: TripDetail): TripDetail {
  return {
    ...detail,
    id: 0,
    journal: "",
    bookings: [],
    published_slug: null,
    days: detail.days.map((d) => ({
      ...d,
      id: 0,
      stops: d.stops.map((s) => ({
        ...s,
        id: 0,
        note: "",
        check_in_count: 0,
        photo_paths: [],
        voice_transcript: "",
      })),
    })),
  };
}
