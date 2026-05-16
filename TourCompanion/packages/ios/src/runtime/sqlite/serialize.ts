// Row → wire-type mappers. Field-for-field parity with the Python
// `_trip_to_detail` / `_stop_to_out` helpers in TourCompanion/server/app/routes/trips.py
// (lines ~31-66) so the existing frontend can't tell which backend it talks to.
//
// Notable differences vs. Python:
// - `published_slug` is omitted (column dropped on iOS).
// - `companion_docs`, `routes`, `street_food` are always [] (v1 iOS scope).

import type {
  Stop,
  Day,
  Booking,
  TripDetail,
  TripSummary,
} from "@tourcompanion/core";

// ---------- Raw row shapes returned by @capacitor-community/sqlite ----------

export interface TripRow {
  id: number;
  name: string;
  destination: string;
  start_date: string;
  end_date: string;
  status: string;
  season: string | null;
  style: string | null;
  pace: string | null;
  source_url: string | null;
  hotel_name: string | null;
  hotel_lat: number | null;
  hotel_lng: number | null;
  hotel_address: string | null;
  journal: string | null;
  created_at: string;
}

export interface DayRow {
  id: number;
  trip_id: number;
  n: number;
  date_label: string | null;
  theme: string | null;
  mode: string | null;
}

export interface StopRow {
  id: number;
  day_id: number;
  order_idx: number | null;
  time_label: string | null;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  hours: string | null;
  tickets: string | null;
  intro: string | null;
  highlights: string | null;
  transit: string | null;
  washroom: string | null;
  food: string | null;
  note: string | null;
  promo: string | null;
}

export interface BookingRow {
  id: number;
  trip_id: number;
  label: string;
  url: string | null;
  done: number | null;
}

// ---------- Helpers ----------

function s(v: string | null | undefined): string {
  return v ?? "";
}

function parseJsonArray(raw: string | null | undefined): unknown[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseJsonObject(raw: string | null | undefined): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export function serializeJsonArray(arr: unknown[] | undefined): string {
  return JSON.stringify(arr ?? []);
}

export function serializeJsonObject(obj: Record<string, unknown> | null | undefined): string | null {
  if (obj == null) return null;
  return JSON.stringify(obj);
}

// ---------- Row mappers ----------

export function rowToStop(
  row: StopRow,
  check_in_count: number,
  photo_paths: string[],
  voice_transcript: string,
): Stop {
  return {
    id: row.id,
    order_idx: row.order_idx ?? 0,
    time_label: s(row.time_label),
    name: row.name,
    address: s(row.address),
    lat: row.lat,
    lng: row.lng,
    hours: s(row.hours),
    tickets: s(row.tickets),
    intro: s(row.intro),
    highlights: parseJsonArray(row.highlights),
    transit: s(row.transit),
    washroom: s(row.washroom),
    food: parseJsonArray(row.food),
    note: s(row.note),
    promo: parseJsonObject(row.promo),
    check_in_count,
    photo_paths,
    voice_transcript,
  };
}

export function rowToDay(row: DayRow, stops: Stop[]): Day {
  return {
    id: row.id,
    n: row.n,
    date_label: s(row.date_label),
    theme: s(row.theme),
    mode: s(row.mode),
    stops,
  };
}

export function rowToBooking(row: BookingRow): Booking {
  return {
    id: row.id,
    label: row.label,
    url: s(row.url),
    done: !!row.done,
  };
}

export function rowToTripSummary(row: TripRow): TripSummary {
  return {
    id: row.id,
    name: row.name,
    destination: row.destination,
    start_date: row.start_date,
    end_date: row.end_date,
    status: row.status,
  };
}

export function rowToTripDetail(row: TripRow, days: Day[], bookings: Booking[]): TripDetail {
  return {
    id: row.id,
    name: row.name,
    destination: row.destination,
    start_date: row.start_date,
    end_date: row.end_date,
    status: row.status,
    season: s(row.season),
    style: s(row.style),
    pace: s(row.pace),
    source_url: s(row.source_url),
    hotel_name: s(row.hotel_name),
    hotel_lat: row.hotel_lat,
    hotel_lng: row.hotel_lng,
    hotel_address: s(row.hotel_address),
    journal: s(row.journal),
    // iOS dropped the publish flow; surface `null` so the existing frontend
    // (which treats it as "unpublished") still works.
    published_slug: null,
    days,
    bookings,
    companion_docs: [],
    routes: [],
    street_food: [],
  };
}
