// TripPlan types — produced by planTrip().
// Shape mirrors server/app/planner.py SYSTEM_PROMPT schema.

export interface BookingPlan {
  label: string;
  url: string;
  done: boolean;
}

export interface StopPlan {
  time_label: string;
  name: string;
  lat: number;
  lng: number;
  address: string;
  hours: string;
  tickets: string;
  intro: string;
  highlights: string[];
  transit: string;
  washroom: string;
  food: string[];
}

export interface DayPlan {
  n: number;
  date_label: string;
  theme: string;
  mode: string;
  stops: StopPlan[];
}

export interface TripPlan {
  name: string;
  destination: string;
  season: string;
  style: string;
  pace: string;
  hotel_name: string;
  hotel_lat: number;
  hotel_lng: number;
  hotel_address: string;
  bookings: BookingPlan[];
  days: DayPlan[];
  start_date?: string;
  end_date?: string;
  source_url?: string;
}

export interface PlanInput {
  destination: string;
  days: number;
  sourceUrl?: string;
  style?: string;
}
