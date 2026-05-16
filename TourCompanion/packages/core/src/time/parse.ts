// Parse "HH:MM" / "HH:MM +N" stop time labels.
// Ports the KG-7 `toMinutes` parser from server/frontend/index.html ~line 1557.
//
// parseStopTime returns the structured fields; stopTimeSortKey returns a
// stable numeric ordering key so next-day stamps sort after same-day ones
// (e.g. "00:24 +1" = 1464 sorts after "23:42" = 1422).

export interface StopTime {
  minutes: number;
  dayOffset: number;
}

const TIME_RE = /^(\d{1,2}):(\d{2})(?:\s*\+(\d+))?/;

export function parseStopTime(time: string): StopTime {
  if (!time) {
    throw new Error("parseStopTime: empty time string");
  }
  const m = TIME_RE.exec(time);
  if (!m) {
    throw new Error(`parseStopTime: malformed time "${time}"`);
  }
  const hours = parseInt(m[1], 10);
  const mins = parseInt(m[2], 10);
  const dayOffset = m[3] ? parseInt(m[3], 10) : 0;
  return { minutes: hours * 60 + mins, dayOffset };
}

export function stopTimeSortKey(time: string): number {
  const { minutes, dayOffset } = parseStopTime(time);
  return dayOffset * 1440 + minutes;
}
