// IOSTripStore — SQLite-backed implementation of TripStore.
// API parity with the FastAPI routes is the priority; field-for-field the
// same TripDetail shape so the existing frontend works unchanged when we
// flip the fetch interceptor in Step 14.

import type { SQLiteDBConnection } from "@capacitor-community/sqlite";
import type {
  TripStore,
  TripCreateInput,
  StopCreateInput,
  CheckInInput,
  JournalUpdate,
  VoiceNoteInput,
  TripDetail,
  TripSummary,
  Stop,
  Day,
  Booking,
} from "@tourcompanion/core";

import {
  type TripRow,
  type DayRow,
  type StopRow,
  type BookingRow,
  rowToTripSummary,
  rowToTripDetail,
  rowToDay,
  rowToStop,
  rowToBooking,
  serializeJsonArray,
} from "./serialize.js";

function nowIso(): string {
  return new Date().toISOString();
}

function rowsOf<T>(result: { values?: unknown[] }): T[] {
  // @capacitor-community/sqlite returns rows directly in `values` (no leading
  // column-name row on JS side when accessed via SQLiteDBConnection.query).
  return (result.values ?? []) as T[];
}

function firstRow<T>(result: { values?: unknown[] }): T | null {
  const rows = rowsOf<T>(result);
  return rows.length ? rows[0] : null;
}

function lastInsertId(result: { changes?: { lastId?: number } }): number {
  const id = result.changes?.lastId;
  if (id == null) throw new Error("[IOSTripStore] insert returned no lastId");
  return id;
}

export class IOSTripStore implements TripStore {
  constructor(private readonly db: SQLiteDBConnection) {}

  // ---------- Read paths ----------

  async listTrips(): Promise<TripSummary[]> {
    const res = await this.db.query(
      `SELECT id, name, destination, start_date, end_date, status
         FROM trips
        ORDER BY id DESC`,
    );
    return rowsOf<TripRow>(res).map(rowToTripSummary);
  }

  async getTrip(id: number): Promise<TripDetail | null> {
    const tripRes = await this.db.query(
      `SELECT * FROM trips WHERE id = ?`,
      [id],
    );
    const trip = firstRow<TripRow>(tripRes);
    if (!trip) return null;

    const daysRes = await this.db.query(
      `SELECT * FROM days WHERE trip_id = ? ORDER BY n ASC`,
      [id],
    );
    const dayRows = rowsOf<DayRow>(daysRes);

    const days: Day[] = [];
    for (const d of dayRows) {
      const stopsRes = await this.db.query(
        `SELECT * FROM stops WHERE day_id = ? ORDER BY order_idx ASC, id ASC`,
        [d.id],
      );
      const stopRows = rowsOf<StopRow>(stopsRes);
      const stops: Stop[] = [];
      for (const s of stopRows) {
        const stop = await this.hydrateStop(s);
        stops.push(stop);
      }
      days.push(rowToDay(d, stops));
    }

    const bookingsRes = await this.db.query(
      `SELECT * FROM bookings WHERE trip_id = ? ORDER BY id ASC`,
      [id],
    );
    const bookings: Booking[] = rowsOf<BookingRow>(bookingsRes).map(rowToBooking);

    return rowToTripDetail(trip, days, bookings);
  }

  private async hydrateStop(row: StopRow): Promise<Stop> {
    const [checkIns, photos, voice] = await Promise.all([
      this.db.query(`SELECT COUNT(*) AS c FROM check_ins WHERE stop_id = ?`, [row.id]),
      this.db.query(`SELECT path FROM photos WHERE stop_id = ? ORDER BY id ASC`, [row.id]),
      this.db.query(
        `SELECT transcript FROM voice_notes WHERE stop_id = ? ORDER BY id DESC LIMIT 1`,
        [row.id],
      ),
    ]);

    const checkInRow = firstRow<{ c: number }>(checkIns);
    const photoRows = rowsOf<{ path: string }>(photos);
    const voiceRow = firstRow<{ transcript: string }>(voice);

    return rowToStop(
      row,
      checkInRow?.c ?? 0,
      photoRows.map((p) => p.path),
      voiceRow?.transcript ?? "",
    );
  }

  // ---------- Trip CRUD ----------

  async createTrip(input: TripCreateInput): Promise<TripDetail> {
    const created_at = nowIso();
    const tripRes = await this.db.run(
      `INSERT INTO trips
         (name, destination, start_date, end_date, status,
          season, style, pace, source_url,
          hotel_name, hotel_lat, hotel_lng, hotel_address,
          journal, created_at)
       VALUES (?, ?, ?, ?, 'planning', ?, ?, ?, ?, ?, ?, ?, ?, '', ?)`,
      [
        input.name,
        input.destination,
        input.start_date,
        input.end_date,
        input.season ?? "",
        input.style ?? "",
        input.pace ?? "",
        input.source_url ?? "",
        input.hotel_name ?? "",
        input.hotel_lat ?? null,
        input.hotel_lng ?? null,
        input.hotel_address ?? "",
        created_at,
      ],
    );
    const tripId = lastInsertId(tripRes);

    for (const d of input.days ?? []) {
      const dayRes = await this.db.run(
        `INSERT INTO days (trip_id, n, date_label, theme, mode)
         VALUES (?, ?, ?, ?, ?)`,
        [tripId, d.n, d.date_label ?? "", d.theme ?? "", d.mode ?? ""],
      );
      const dayId = lastInsertId(dayRes);

      const dayStops = d.stops ?? [];
      for (let i = 0; i < dayStops.length; i++) {
        const s = dayStops[i];
        await this.db.run(
          `INSERT INTO stops
             (day_id, order_idx, time_label, name, address, lat, lng,
              hours, tickets, intro, highlights, transit, washroom, food, note, promo)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            dayId,
            s.order_idx ?? i,
            s.time_label ?? "",
            s.name,
            s.address ?? "",
            s.lat ?? null,
            s.lng ?? null,
            s.hours ?? "",
            s.tickets ?? "",
            s.intro ?? "",
            serializeJsonArray(s.highlights as unknown[]),
            s.transit ?? "",
            s.washroom ?? "",
            serializeJsonArray(s.food as unknown[]),
            s.note ?? "",
            s.promo ? JSON.stringify(s.promo) : null,
          ],
        );
      }
    }

    for (const b of input.bookings ?? []) {
      await this.db.run(
        `INSERT INTO bookings (trip_id, label, url, done) VALUES (?, ?, ?, ?)`,
        [tripId, b.label, b.url ?? "", b.done ? 1 : 0],
      );
    }

    const detail = await this.getTrip(tripId);
    if (!detail) throw new Error("[IOSTripStore] createTrip: trip vanished post-insert");
    return detail;
  }

  async deleteTrip(id: number): Promise<void> {
    // ON DELETE CASCADE on days/bookings → stops → check_ins/photos/voice_notes
    // does the rest. PRAGMA foreign_keys = ON enforces it.
    await this.db.run(`DELETE FROM trips WHERE id = ?`, [id]);
  }

  // ---------- Day operations ----------

  async addDay(tripId: number): Promise<TripDetail> {
    const res = await this.db.query(
      `SELECT COALESCE(MAX(n), 0) AS max_n FROM days WHERE trip_id = ?`,
      [tripId],
    );
    const row = firstRow<{ max_n: number }>(res);
    const nextN = (row?.max_n ?? 0) + 1;
    await this.db.run(
      `INSERT INTO days (trip_id, n, date_label, theme, mode) VALUES (?, ?, '', '', '')`,
      [tripId, nextN],
    );
    const detail = await this.getTrip(tripId);
    if (!detail) throw new Error("[IOSTripStore] addDay: trip not found");
    return detail;
  }

  async removeDay(tripId: number, dayN: number): Promise<TripDetail> {
    await this.db.run(
      `DELETE FROM days WHERE trip_id = ? AND n = ?`,
      [tripId, dayN],
    );
    // Resequence remaining day numbers so n stays contiguous (matches Python behaviour).
    const res = await this.db.query(
      `SELECT id FROM days WHERE trip_id = ? ORDER BY n ASC`,
      [tripId],
    );
    const ids = rowsOf<{ id: number }>(res).map((r) => r.id);
    for (let i = 0; i < ids.length; i++) {
      await this.db.run(`UPDATE days SET n = ? WHERE id = ?`, [i + 1, ids[i]]);
    }
    const detail = await this.getTrip(tripId);
    if (!detail) throw new Error("[IOSTripStore] removeDay: trip not found");
    return detail;
  }

  // ---------- Stop operations ----------

  async addStop(input: StopCreateInput): Promise<TripDetail> {
    const maxRes = await this.db.query(
      `SELECT COALESCE(MAX(order_idx), -1) AS max_idx FROM stops WHERE day_id = ?`,
      [input.day_id],
    );
    const nextIdx = (firstRow<{ max_idx: number }>(maxRes)?.max_idx ?? -1) + 1;

    await this.db.run(
      `INSERT INTO stops
         (day_id, order_idx, time_label, name, address, lat, lng,
          hours, tickets, intro, highlights, transit, washroom, food, note, promo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', NULL)`,
      [
        input.day_id,
        nextIdx,
        input.time_label ?? "",
        input.name,
        input.address ?? "",
        input.lat ?? null,
        input.lng ?? null,
        input.hours ?? "",
        input.tickets ?? "",
        input.intro ?? "",
        serializeJsonArray(input.highlights),
        input.transit ?? "",
        input.washroom ?? "",
        serializeJsonArray(input.food),
      ],
    );
    return this.requireTripForDay(input.day_id);
  }

  async reorderStops(dayId: number, stopIds: number[]): Promise<TripDetail> {
    const tasks = stopIds.map((id, idx) => ({
      statement: `UPDATE stops SET order_idx = ? WHERE id = ? AND day_id = ?`,
      values: [idx, id, dayId],
    }));
    if (tasks.length) {
      await this.db.executeTransaction(tasks);
    }
    return this.requireTripForDay(dayId);
  }

  async deleteStop(stopId: number): Promise<TripDetail> {
    const dayRes = await this.db.query(
      `SELECT day_id FROM stops WHERE id = ?`,
      [stopId],
    );
    const dayRow = firstRow<{ day_id: number }>(dayRes);
    if (!dayRow) throw new Error("[IOSTripStore] deleteStop: stop not found");
    await this.db.run(`DELETE FROM stops WHERE id = ?`, [stopId]);
    return this.requireTripForDay(dayRow.day_id);
  }

  // ---------- Live-tour writes (no detail return) ----------

  async checkIn(input: CheckInInput): Promise<void> {
    await this.db.run(
      `INSERT INTO check_ins (stop_id, visited_at, lat, lng) VALUES (?, ?, ?, ?)`,
      [input.stop_id, nowIso(), input.lat ?? null, input.lng ?? null],
    );
  }

  async updateJournal(input: JournalUpdate): Promise<void> {
    await this.db.run(
      `UPDATE trips SET journal = ? WHERE id = ?`,
      [input.journal, input.trip_id],
    );
  }

  async addVoiceNote(input: VoiceNoteInput): Promise<void> {
    await this.db.run(
      `INSERT INTO voice_notes (stop_id, transcript, audio_path, recorded_at)
       VALUES (?, ?, ?, ?)`,
      [input.stop_id, input.transcript, input.audio_path ?? "", nowIso()],
    );
  }

  async addPhoto(stopId: number, path: string, caption?: string): Promise<void> {
    await this.db.run(
      `INSERT INTO photos (stop_id, path, caption, taken_at) VALUES (?, ?, ?, ?)`,
      [stopId, path, caption ?? "", nowIso()],
    );
  }

  // ---------- Internal ----------

  private async requireTripForDay(dayId: number): Promise<TripDetail> {
    const res = await this.db.query(
      `SELECT trip_id FROM days WHERE id = ?`,
      [dayId],
    );
    const row = firstRow<{ trip_id: number }>(res);
    if (!row) throw new Error("[IOSTripStore] day not found");
    const detail = await this.getTrip(row.trip_id);
    if (!detail) throw new Error("[IOSTripStore] trip not found after day lookup");
    return detail;
  }
}
