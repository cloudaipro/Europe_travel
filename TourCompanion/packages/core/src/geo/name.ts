// POI name + address utilities. Ports server/app/geocoder.py.

// Matches "(...)" / "（...）" with surrounding spaces.
const PAREN_RE = /\s*[\(（][^)）]*[\)）]\s*/g;

// Leading verb phrases like "lunch at " / "tour of " — case-insensitive.
const LEADING_VERB_RE =
  /^(?:lunch at|dinner at|breakfast at|coffee at|drinks at|stop at|visit to|check[-\s]?in at|tour of|walk through|walk to|walk along|walk on|walk down|day trip to|cruise from|train to)\s+/i;

const TRAILING_SUFFIXES = [
  " tour",
  " visit",
  " (lunch)",
  " (dinner)",
  " entry",
  " check-in",
];

export function cleanName(name: string): string {
  let result = (name || "").replace(PAREN_RE, " ").trim();
  result = result.replace(LEADING_VERB_RE, "").trim();
  for (const suffix of TRAILING_SUFFIXES) {
    if (result.toLowerCase().endsWith(suffix)) {
      result = result.slice(0, result.length - suffix.length).trimEnd();
    }
  }
  return result;
}

export function extractCity(address: string): string {
  if (!address) return "";
  const parts = address.split(",");
  const last = parts[parts.length - 1].trim();
  const m = /^\d{3,5}\s+(.+)$/.exec(last);
  return (m ? m[1] : last).trim();
}

export function buildQueries(name: string, address: string): string[] {
  const cleaned = cleanName(name);
  const addr = (address || "").trim();
  const city = extractCity(addr);
  const cands: string[] = [];
  if (cleaned && city) cands.push(`${cleaned}, ${city}`);
  if (cleaned) cands.push(cleaned);
  if (cleaned && addr) cands.push(`${cleaned}, ${addr}`);
  if (addr) cands.push(addr);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const q of cands) {
    if (!seen.has(q)) {
      seen.add(q);
      out.push(q);
    }
  }
  return out;
}
