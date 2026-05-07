"""Ad-hoc backfill: re-geocode every Stop's lat/lng via OpenStreetMap.

Newly-created trips are auto-geocoded after `/api/plan/ingest`. Use this
script to (a) refresh existing demo seed data, or (b) repair stops that
were created before auto-geocoding was wired in.

    cd server
    .venv/bin/python -m scripts.backfill_geocodes [--dry-run] [--force]

Defaults: only stops without lat/lng. `--force` rewrites every row, even
ones that already have real seed coords (with the viewbox + drift safety
nets that limit how far they can move).
"""

from __future__ import annotations

import argparse
import logging
import sys
import time
from pathlib import Path

# Allow running as `python -m scripts.backfill_geocodes` from the server dir.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.db import SessionLocal  # noqa: E402
from app.geocoder import (  # noqa: E402
    SLEEP_SEC, geocode_query, geocode_stops,
)
from app.models import Stop, Trip  # noqa: E402


def run(force: bool, dry_run: bool, limit: int | None) -> None:
    logging.basicConfig(level=logging.INFO,
                        format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    db = SessionLocal()
    try:
        # Group stops by trip so each batch can use that trip's destination
        # as a search anchor (catches generic names without seed coords).
        trips = db.query(Trip).all()
        if not trips:
            print("No trips found.")
            return

        total_processed = 0
        agg = {"fixed": 0, "unchanged": 0, "missed": 0,
               "skipped": 0, "rejected": 0, "errored": 0}

        for trip in trips:
            trip_stops = [s for d in trip.days for s in d.stops]
            if not force:
                trip_stops = [s for s in trip_stops if s.lat is None or s.lng is None]
            if limit is not None:
                remaining = limit - total_processed
                if remaining <= 0:
                    break
                trip_stops = trip_stops[:remaining]
            if not trip_stops:
                continue

            print(f"\n→ Trip {trip.id} {trip.name!r} — {len(trip_stops)} stops "
                  f"(destination: {trip.destination!r})")
            anchor = None
            if trip.destination:
                anchor = geocode_query(trip.destination)
                time.sleep(SLEEP_SEC)
                if anchor:
                    print(f"  destination anchor: {anchor[0]:.4f},{anchor[1]:.4f}")

            if dry_run:
                # Echo what would be processed; geocode_stops doesn't have a
                # dry-run mode (it commits), so just report the candidates.
                for s in trip_stops:
                    print(f"  [dry] {s.name!r} (id={s.id}, "
                          f"seed={s.lat},{s.lng}, addr={s.address!r})")
                continue

            summary = geocode_stops(db, trip_stops, force=force,
                                    destination_anchor=anchor)
            for k, v in summary.items():
                agg[k] = agg.get(k, 0) + v
            total_processed += len(trip_stops)

        print("\n" + "=" * 60)
        if dry_run:
            print("Dry run — no writes performed. Re-run without --dry-run to commit.")
        else:
            print(f"Total: {agg['fixed']} fixed · {agg['unchanged']} unchanged · "
                  f"{agg['missed']} missed · {agg['rejected']} rejected · "
                  f"{agg['skipped']} skipped · {agg['errored']} errored")
    finally:
        db.close()


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--force", action="store_true",
                   help="Re-geocode every stop, even ones that already have lat/lng.")
    p.add_argument("--dry-run", action="store_true",
                   help="List stops that would be processed without writing.")
    p.add_argument("--limit", type=int, default=None,
                   help="Process at most N stops in total.")
    args = p.parse_args()
    run(force=args.force, dry_run=args.dry_run, limit=args.limit)
