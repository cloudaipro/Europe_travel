import { describe, it, expect } from "vitest";
import { sanitizeTripForPublic } from "../../src/trips/sanitize.js";
import type { TripDetail } from "../../src/types/trip.js";

function makeTrip(): TripDetail {
  return {
    id: 42,
    name: "Vienna",
    destination: "Vienna",
    start_date: "2026-05-20",
    end_date: "2026-05-23",
    status: "draft",
    season: "spring",
    style: "mixed",
    pace: "moderate",
    source_url: "https://example.test/playlist",
    hotel_name: "Hotel Sacher",
    hotel_lat: 48.204,
    hotel_lng: 16.369,
    hotel_address: "Philharmoniker Str 4",
    journal: "private notes here",
    published_slug: "abc1234567",
    days: [
      {
        id: 7,
        n: 1,
        date_label: "Day 1",
        theme: "Arrival",
        mode: "walk",
        stops: [
          {
            id: 100,
            order_idx: 0,
            time_label: "09:00",
            name: "Stephansdom",
            address: "Stephansplatz",
            lat: 48.208,
            lng: 16.373,
            hours: "9-17",
            tickets: "",
            intro: "Cathedral",
            highlights: ["tower"],
            transit: "U1 to Stephansplatz",
            washroom: "near south tower",
            food: [],
            note: "PRIVATE remember umbrella",
            promo: null,
            check_in_count: 3,
            photo_paths: ["/p/100/a.jpg", "/p/100/b.jpg"],
            voice_transcript: "secret voice memo",
          },
        ],
      },
    ],
    bookings: [
      { id: 1, label: "Hotel", url: "https://example.test/b1", done: true },
    ],
    companion_docs: [{ id: 1, name: "Guide", file_path: "/d/1.pdf" }],
    routes: [
      { id: 1, day_n: 1, label: "Day 1", pdf_path: "/r/1.pdf", map_url: "" },
    ],
    street_food: [],
  };
}

describe("sanitizeTripForPublic", () => {
  it("strips private fields and zeros IDs", () => {
    const sanitized = sanitizeTripForPublic(makeTrip());
    expect(sanitized.id).toBe(0);
    expect(sanitized.journal).toBe("");
    expect(sanitized.bookings).toEqual([]);
    expect(sanitized.published_slug).toBeNull();
    expect(sanitized.days[0].id).toBe(0);
    const s = sanitized.days[0].stops[0];
    expect(s.id).toBe(0);
    expect(s.note).toBe("");
    expect(s.check_in_count).toBe(0);
    expect(s.photo_paths).toEqual([]);
    expect(s.voice_transcript).toBe("");
  });

  it("leaves required public fields intact", () => {
    const sanitized = sanitizeTripForPublic(makeTrip());
    expect(sanitized.name).toBe("Vienna");
    expect(sanitized.destination).toBe("Vienna");
    expect(sanitized.hotel_name).toBe("Hotel Sacher");
    expect(sanitized.companion_docs).toHaveLength(1);
    expect(sanitized.routes).toHaveLength(1);
    const s = sanitized.days[0].stops[0];
    expect(s.name).toBe("Stephansdom");
    expect(s.lat).toBe(48.208);
    expect(s.lng).toBe(16.373);
    expect(s.intro).toBe("Cathedral");
    expect(s.transit).toBe("U1 to Stephansplatz");
  });

  it("does not mutate the input", () => {
    const trip = makeTrip();
    sanitizeTripForPublic(trip);
    expect(trip.id).toBe(42);
    expect(trip.journal).toBe("private notes here");
    expect(trip.bookings).toHaveLength(1);
    expect(trip.days[0].stops[0].note).toBe("PRIVATE remember umbrella");
    expect(trip.days[0].stops[0].photo_paths).toHaveLength(2);
  });
});
