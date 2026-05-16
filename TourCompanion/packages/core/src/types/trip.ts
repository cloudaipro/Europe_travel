// Wire-format domain types. Field names mirror Pydantic schemas exactly
// (snake_case). Optional[X] → X | null to match JSON nullability.

export interface Stop {
  id: number;
  order_idx: number;
  time_label: string;
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
  hours: string;
  tickets: string;
  intro: string;
  highlights: unknown[];
  transit: string;
  washroom: string;
  food: unknown[];
  note: string;
  promo: Record<string, unknown> | null;
  check_in_count: number;
  photo_paths: string[];
  voice_transcript: string;
}

export interface Day {
  id: number;
  n: number;
  date_label: string;
  theme: string;
  mode: string;
  stops: Stop[];
}

export interface Booking {
  id: number;
  label: string;
  url: string;
  done: boolean;
}

export interface CompanionDoc {
  id: number;
  name: string;
  file_path: string;
}

export interface RouteAsset {
  id: number;
  day_n: number;
  label: string;
  pdf_path: string;
  map_url: string;
}

export interface StreetFood {
  id: number;
  slug: string;
  name: string;
  category: string;
  lat: number | null;
  lng: number | null;
  address: string;
  price_band: string;
  price_huf: string;
  locality_score: number;
  why: string;
  hours: string;
  photo_url: string | null;
}

export interface TripSummary {
  id: number;
  name: string;
  destination: string;
  start_date: string; // ISO date
  end_date: string;
  status: string;
}

export interface TripDetail {
  id: number;
  name: string;
  destination: string;
  start_date: string;
  end_date: string;
  status: string;
  season: string;
  style: string;
  pace: string;
  source_url: string;
  hotel_name: string;
  hotel_lat: number | null;
  hotel_lng: number | null;
  hotel_address: string;
  journal: string;
  published_slug: string | null;
  days: Day[];
  bookings: Booking[];
  companion_docs: CompanionDoc[];
  routes: RouteAsset[];
  street_food: StreetFood[];
}
