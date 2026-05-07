"""Ad-hoc backfill: re-geocode every Stop's lat/lng via OpenStreetMap.

Newly-created trips are auto-geocoded after `/api/plan/ingest`. Use this
script to (a) refresh existing demo seed data, or (b) repair stops that
were created before auto-geocoding was wired in.

    cd server
    .venv/bin/python -m scripts.backfill_geocodes [--dry-run] [--force] [--limit N]

Defaults: only stops without lat/lng. `--force` rewrites every row.
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

# Allow running as `python -m scripts.backfill_geocodes` from the server dir.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.db import SessionLocal  # noqa: E402
from app.geocoder import (  # noqa: E402
    DEFAULT_MAX_DRIFT_KM, SLEEP_SEC, _has_real_seed, build_queries, geocode_query,
    haversine_km,
)
from app.models import Stop  # noqa: E402


def run(force: bool, dry_run: bool, limit: int | None) -> None:
    db = SessionLocal()
    try:
        q = db.query(Stop)
        if not force:
            q = q.filter((Stop.lat.is_(None)) | (Stop.lng.is_(None)))
        stops = q.all()
        if limit:
            stops = stops[:limit]
        if not stops:
            print("No stops to process. Use --force to re-geocode existing rows.")
            return

        print(f"Processing {len(stops)} stops "
              f"({'dry-run' if dry_run else 'writes enabled'})…\n")

        fixed = unchanged = missed = skipped = rejected = errored = 0

        for i, s in enumerate(stops, 1):
            queries = build_queries(s.name, s.address)
            if not queries:
                print(f"[{i}/{len(stops)}] · skip (id={s.id} empty name+address)")
                skipped += 1
                continue
            result: tuple[float, float] | None = None
            tried_query: str = ""
            for q in queries:
                result = geocode_query(q)
                tried_query = q
                if result:
                    break
                time.sleep(SLEEP_SEC)
            time.sleep(SLEEP_SEC)

            if not result:
                print(f"[{i}/{len(stops)}] · no hit, tried: {queries}")
                missed += 1
                continue

            new_lat, new_lng = result
            old = (s.lat, s.lng)
            if _has_real_seed(s):
                drift = haversine_km(old[0], old[1], new_lat, new_lng)
                if drift > DEFAULT_MAX_DRIFT_KM:
                    print(f"[{i}/{len(stops)}] ✗ rejected {s.name!r}: "
                          f"{new_lat:.4f},{new_lng:.4f} is {drift:.0f} km from seed "
                          f"{old[0]:.4f},{old[1]:.4f}  (q={tried_query!r})")
                    rejected += 1
                    continue
                if abs(old[0] - new_lat) < 1e-4 and abs(old[1] - new_lng) < 1e-4:
                    print(f"[{i}/{len(stops)}] = {s.name!r} unchanged "
                          f"({new_lat:.4f},{new_lng:.4f})")
                    unchanged += 1
                    continue

            print(f"[{i}/{len(stops)}] ✓ {s.name!r} "
                  f"{old[0] if old[0] is None else f'{old[0]:.4f}'},"
                  f"{old[1] if old[1] is None else f'{old[1]:.4f}'}"
                  f" → {new_lat:.4f},{new_lng:.4f}  (q={tried_query!r})")
            if not dry_run:
                s.lat, s.lng = new_lat, new_lng
            fixed += 1

        if not dry_run:
            db.commit()

        print(f"\nSummary: {fixed} fixed · {unchanged} unchanged · "
              f"{missed} missed · {rejected} rejected · {skipped} skipped · "
              f"{errored} errored "
              f"({'no writes — dry run' if dry_run else 'committed'})")
    finally:
        db.close()


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--force", action="store_true",
                   help="Re-geocode every stop, even ones that already have lat/lng.")
    p.add_argument("--dry-run", action="store_true",
                   help="Print proposed changes without writing.")
    p.add_argument("--limit", type=int, default=None,
                   help="Process at most N stops.")
    args = p.parse_args()
    run(force=args.force, dry_run=args.dry_run, limit=args.limit)
