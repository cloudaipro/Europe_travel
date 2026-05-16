// TripStore — abstract data layer used by the iOS app (SQLite) and any
// future offline-first frontend. The web build keeps talking to FastAPI
// directly; this interface is platform-agnostic but currently only the
// iOS package provides an implementation.

import type { TripDetail, TripSummary, Stop } from "../types/index.js";

export interface TripCreateInput {
  name: string;
  destination: string;
  start_date: string;   // ISO
  end_date: string;     // ISO
  season?: string;
  style?: string;
  pace?: string;
  source_url?: string;
  hotel_name?: string;
  hotel_lat?: number | null;
  hotel_lng?: number | null;
  hotel_address?: string;
  days?: Array<{
    n: number;
    date_label?: string;
    theme?: string;
    mode?: string;
    stops?: Array<Omit<Stop, "id" | "check_in_count" | "photo_paths" | "voice_transcript">>;
  }>;
  bookings?: Array<{ label: string; url?: string; done?: boolean }>;
}

export interface StopCreateInput {
  day_id: number;
  time_label?: string;
  name: string;
  address?: string;
  lat?: number | null;
  lng?: number | null;
  hours?: string;
  tickets?: string;
  intro?: string;
  highlights?: string[];
  transit?: string;
  washroom?: string;
  food?: string[];
}

export interface CheckInInput {
  stop_id: number;
  lat?: number | null;
  lng?: number | null;
}

export interface JournalUpdate {
  trip_id: number;
  journal: string;
}

export interface VoiceNoteInput {
  stop_id: number;
  transcript: string;
  audio_path?: string;
}

export interface TripStore {
  listTrips(): Promise<TripSummary[]>;
  getTrip(id: number): Promise<TripDetail | null>;
  createTrip(input: TripCreateInput): Promise<TripDetail>;
  deleteTrip(id: number): Promise<void>;

  addDay(tripId: number): Promise<TripDetail>;
  removeDay(tripId: number, dayN: number): Promise<TripDetail>;

  addStop(input: StopCreateInput): Promise<TripDetail>;
  reorderStops(dayId: number, stopIds: number[]): Promise<TripDetail>;
  deleteStop(stopId: number): Promise<TripDetail>;

  checkIn(input: CheckInInput): Promise<void>;
  updateJournal(input: JournalUpdate): Promise<void>;
  addVoiceNote(input: VoiceNoteInput): Promise<void>;
  addPhoto(stopId: number, path: string, caption?: string): Promise<void>;
}
