// Factory: open the SQLite connection, run schema bootstrap, return an
// IOSTripStore ready for the entry shim to expose on `window.TCStore`.

import { CapacitorSQLite, SQLiteConnection } from "@capacitor-community/sqlite";
import { SCHEMA_STATEMENTS } from "./schema.js";
import { IOSTripStore } from "./store.js";
import type { TripStore } from "@tourcompanion/core";

const DB_NAME = "tourcompanion";

export async function initSqliteStore(): Promise<TripStore> {
  const sqlite = new SQLiteConnection(CapacitorSQLite);

  // If a prior reload left a stale connection in the dict, reuse it.
  const exists = await sqlite.isConnection(DB_NAME, false);
  const db = exists.result
    ? await sqlite.retrieveConnection(DB_NAME, false)
    : await sqlite.createConnection(DB_NAME, false, "no-encryption", 1, false);

  await db.open();

  // SQLite requires FK enforcement to be enabled per-connection — our schema
  // relies on ON DELETE CASCADE for trip teardown.
  await db.execute(`PRAGMA foreign_keys = ON;`);

  // Run CREATE TABLE IF NOT EXISTS + index + schema_meta seed.
  for (const stmt of SCHEMA_STATEMENTS) {
    await db.execute(stmt);
  }

  return new IOSTripStore(db);
}
