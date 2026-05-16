// Request payloads sent by clients to the API.

export interface IngestIn {
  destination: string;
  days: number;
  source_url: string;
  style: string;
}

export interface IngestOut {
  job_id: string;
  status: string;
  message: string;
}

export interface CheckInIn {
  lat: number | null;
  lng: number | null;
}

export interface JournalIn {
  journal: string;
}

export interface VoiceNoteIn {
  transcript: string;
}
