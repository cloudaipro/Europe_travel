"""Geocoding helper. Used to fix up stop lat/lng using OpenStreetMap Nominatim.

Public entry points:
- `geocode_query(query)`: lookup a single free-form string
- `geocode_trip_async(trip_id)`: schedule for a trip in a fresh DB session;
  safe to call from FastAPI BackgroundTasks (logs errors instead of raising).
- `geocode_stops(db, stops, force, max_drift_km)`: in-process refresh.

Respects Nominatim's 1 req/sec usage policy via a 1.1s sleep between requests
and identifies the client via a User-Agent header.
"""

from __future__ import annotations

import json
import logging
import re
import time
import urllib.parse
import urllib.request
from math import asin, cos, radians, sin, sqrt
from typing import Iterable

from sqlalchemy.orm import Session

from .db import SessionLocal
from .models import Stop, Trip

log = logging.getLogger("geocoder")

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
USER_AGENT = "TourCompanion/1.0 (travel-planner; contact: demo@tourcompanion.app)"
SLEEP_SEC = 1.1
DEFAULT_MAX_DRIFT_KM = 50.0

_PAREN_RE = re.compile(r"\s*[\(（][^)）]*[\)）]\s*")
_LEADING_VERB_RE = re.compile(
    r"^(?:lunch at|dinner at|breakfast at|coffee at|drinks at|stop at|visit to|"
    r"check[-\s]?in at|tour of|walk through|walk to|walk along|walk on|walk down|"
    r"day trip to|cruise from|train to)\s+",
    re.IGNORECASE,
)


def haversine_km(a_lat: float, a_lng: float, b_lat: float, b_lng: float) -> float:
    r_lat1, r_lat2 = radians(a_lat), radians(b_lat)
    dlat = radians(b_lat - a_lat)
    dlng = radians(b_lng - a_lng)
    h = sin(dlat / 2) ** 2 + cos(r_lat1) * cos(r_lat2) * sin(dlng / 2) ** 2
    return 2 * 6371 * asin(sqrt(h))


def clean_name(name: str) -> str:
    name = _PAREN_RE.sub(" ", name or "").strip()
    name = _LEADING_VERB_RE.sub("", name).strip()
    for suffix in (" tour", " visit", " (lunch)", " (dinner)", " entry", " check-in"):
        if name.lower().endswith(suffix):
            name = name[: -len(suffix)].rstrip()
    return name


def extract_city(address: str) -> str:
    if not address:
        return ""
    last = address.split(",")[-1].strip()
    m = re.match(r"^\d{3,5}\s+(.+)$", last)
    return (m.group(1) if m else last).strip()


def build_queries(name: str, address: str) -> list[str]:
    cleaned = clean_name(name)
    address = (address or "").strip()
    city = extract_city(address)
    cands: list[str] = []
    if cleaned and city:
        cands.append(f"{cleaned}, {city}")
    if cleaned:
        cands.append(cleaned)
    if cleaned and address:
        cands.append(f"{cleaned}, {address}")
    if address:
        cands.append(address)
    seen: set[str] = set()
    return [q for q in cands if not (q in seen or seen.add(q))]


def geocode_query(query: str) -> tuple[float, float] | None:
    """Return (lat, lng) for a free-form query, or None on miss/error."""
    params = urllib.parse.urlencode({
        "q": query, "format": "json", "limit": 1, "addressdetails": 0,
    })
    req = urllib.request.Request(
        f"{NOMINATIM_URL}?{params}",
        headers={"User-Agent": USER_AGENT, "Accept-Language": "en"},
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except Exception as e:  # noqa: BLE001 — log and skip; caller handles miss
        log.warning("nominatim error for %r: %s", query, e)
        return None
    if not data:
        return None
    return float(data[0]["lat"]), float(data[0]["lon"])


def _has_real_seed(s: Stop) -> bool:
    """True if the stop has plausible existing coords. Treats (0, 0) as no seed
    — the planner mock and many third-party APIs use Null Island as a placeholder."""
    if s.lat is None or s.lng is None:
        return False
    return not (abs(s.lat) < 1e-6 and abs(s.lng) < 1e-6)


# Stops without real seed coords are validated against the trip's destination.
# 250km covers typical multi-stop trips (e.g., Vienna day-trip to Wachau Valley
# is ~80km) while still rejecting "Mock stop 3" → Idaho-class hits.
DESTINATION_ANCHOR_RADIUS_KM = 250.0


def geocode_stops(
    db: Session,
    stops: Iterable[Stop],
    force: bool = True,
    max_drift_km: float = DEFAULT_MAX_DRIFT_KM,
    destination_anchor: tuple[float, float] | None = None,
) -> dict:
    """Re-geocode each stop in `stops`. Commits when finished.

    Returns a summary dict with counts (fixed/unchanged/missed/skipped/rejected).
    Default `force=True` rewrites lat/lng even if already populated. Pass
    `force=False` to only fill in stops that are missing coords.

    Two safety nets reject implausible results:
      1. If the stop has a real seed coord, the geocoded result must be within
         `max_drift_km` of the seed.
      2. If the stop has no real seed but a `destination_anchor` is provided,
         the result must be within `DESTINATION_ANCHOR_RADIUS_KM` of the anchor.
    Both prevent generic names ("Mock stop 3", "Astoria") from landing in the
    wrong country.
    """
    fixed = unchanged = missed = skipped = rejected = errored = 0
    for s in stops:
        if not force and _has_real_seed(s):
            continue
        queries = build_queries(s.name, s.address)
        if not queries:
            skipped += 1
            continue
        result: tuple[float, float] | None = None
        for q in queries:
            result = geocode_query(q)
            if result:
                break
            time.sleep(SLEEP_SEC)
        time.sleep(SLEEP_SEC)
        if not result:
            missed += 1
            continue
        new_lat, new_lng = result
        has_seed = _has_real_seed(s)
        if has_seed and haversine_km(s.lat, s.lng, new_lat, new_lng) > max_drift_km:
            rejected += 1
            log.info("rejected geocode for %r — drift > %.0f km", s.name, max_drift_km)
            continue
        if (not has_seed
                and destination_anchor is not None
                and haversine_km(*destination_anchor, new_lat, new_lng) > DESTINATION_ANCHOR_RADIUS_KM):
            rejected += 1
            log.info("rejected geocode for %r — > %.0f km from destination anchor",
                     s.name, DESTINATION_ANCHOR_RADIUS_KM)
            continue
        if (has_seed
                and abs(s.lat - new_lat) < 1e-4
                and abs(s.lng - new_lng) < 1e-4):
            unchanged += 1
            continue
        s.lat, s.lng = new_lat, new_lng
        fixed += 1
    db.commit()
    summary = {
        "fixed": fixed, "unchanged": unchanged, "missed": missed,
        "skipped": skipped, "rejected": rejected, "errored": errored,
    }
    log.info("geocode_stops summary: %s", summary)
    return summary


def geocode_trip_async(trip_id: int) -> None:
    """Re-geocode every stop on a trip. Designed for FastAPI BackgroundTasks
    or any out-of-request worker — opens its own session, never raises.

    Uses the trip's `destination` field as a geographic anchor: stops without
    real seed coords are sanity-checked against it so generic names can't drift
    to the wrong country.
    """
    db = SessionLocal()
    try:
        trip = db.get(Trip, trip_id)
        if not trip:
            log.warning("geocode_trip_async: trip %s not found", trip_id)
            return
        stops = [s for d in trip.days for s in d.stops]
        if not stops:
            return

        anchor: tuple[float, float] | None = None
        if trip.destination:
            anchor = geocode_query(trip.destination)
            time.sleep(SLEEP_SEC)
            if anchor:
                log.info("destination anchor for %r: %.4f,%.4f",
                         trip.destination, *anchor)

        log.info("geocoding %d stops for trip %s (%r)", len(stops), trip.id, trip.name)
        geocode_stops(db, stops, force=True, destination_anchor=anchor)
    except Exception as e:  # noqa: BLE001 — must not bubble out of bg task
        log.exception("geocode_trip_async failed for trip %s: %s", trip_id, e)
    finally:
        db.close()
