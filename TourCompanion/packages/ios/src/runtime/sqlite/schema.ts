// SQLite schema for the offline-first iOS TripStore.
// Mirrors the v1 Python models we keep on-device (users / email_tokens /
// companion_docs / route_assets / ingest_jobs / street_food are skipped).
// `published_slug` is intentionally absent — no publish flow on iOS.

export const SCHEMA_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS trips (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     name TEXT NOT NULL,
     destination TEXT NOT NULL,
     start_date TEXT NOT NULL,
     end_date TEXT NOT NULL,
     status TEXT NOT NULL DEFAULT 'planning',
     season TEXT DEFAULT '',
     style TEXT DEFAULT '',
     pace TEXT DEFAULT '',
     source_url TEXT DEFAULT '',
     hotel_name TEXT DEFAULT '',
     hotel_lat REAL,
     hotel_lng REAL,
     hotel_address TEXT DEFAULT '',
     journal TEXT DEFAULT '',
     created_at TEXT NOT NULL
   );`,
  `CREATE TABLE IF NOT EXISTS days (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
     n INTEGER NOT NULL,
     date_label TEXT DEFAULT '',
     theme TEXT DEFAULT '',
     mode TEXT DEFAULT ''
   );`,
  `CREATE INDEX IF NOT EXISTS idx_days_trip ON days(trip_id);`,
  `CREATE TABLE IF NOT EXISTS stops (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     day_id INTEGER NOT NULL REFERENCES days(id) ON DELETE CASCADE,
     order_idx INTEGER DEFAULT 0,
     time_label TEXT DEFAULT '',
     name TEXT NOT NULL,
     address TEXT DEFAULT '',
     lat REAL,
     lng REAL,
     hours TEXT DEFAULT '',
     tickets TEXT DEFAULT '',
     intro TEXT DEFAULT '',
     highlights TEXT DEFAULT '[]',
     transit TEXT DEFAULT '',
     washroom TEXT DEFAULT '',
     food TEXT DEFAULT '[]',
     note TEXT DEFAULT '',
     promo TEXT
   );`,
  `CREATE INDEX IF NOT EXISTS idx_stops_day ON stops(day_id);`,
  `CREATE TABLE IF NOT EXISTS bookings (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
     label TEXT NOT NULL,
     url TEXT DEFAULT '',
     done INTEGER DEFAULT 0
   );`,
  `CREATE TABLE IF NOT EXISTS check_ins (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     stop_id INTEGER NOT NULL REFERENCES stops(id) ON DELETE CASCADE,
     visited_at TEXT NOT NULL,
     lat REAL,
     lng REAL
   );`,
  `CREATE TABLE IF NOT EXISTS photos (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     stop_id INTEGER NOT NULL REFERENCES stops(id) ON DELETE CASCADE,
     path TEXT NOT NULL,
     caption TEXT DEFAULT '',
     taken_at TEXT NOT NULL
   );`,
  `CREATE TABLE IF NOT EXISTS voice_notes (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     stop_id INTEGER NOT NULL REFERENCES stops(id) ON DELETE CASCADE,
     transcript TEXT DEFAULT '',
     audio_path TEXT DEFAULT '',
     recorded_at TEXT NOT NULL
   );`,
  `CREATE TABLE IF NOT EXISTS schema_meta (
     key TEXT PRIMARY KEY,
     value TEXT NOT NULL
   );`,
  `INSERT OR IGNORE INTO schema_meta(key, value) VALUES('version', '1');`,
];

// Single string for db.execute() — newlines kept for readability if it surfaces in errors.
export const SCHEMA_SQL: string = SCHEMA_STATEMENTS.join("\n");
