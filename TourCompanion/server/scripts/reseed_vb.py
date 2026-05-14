"""Delete the existing Vienna+Budapest demo trip so the next server boot
re-seeds it from the updated `seed_data/vienna_budapest.py` module.

Usage (from server/ dir):  .venv/bin/python -m scripts.reseed_vb
"""
import sys

from sqlalchemy import select

from app.db import SessionLocal
from app.models import Trip, User
from app.seed_data import vienna_budapest as vb


def main() -> int:
    with SessionLocal() as db:
        target_name = vb.TRIP["name"]
        trips = db.scalars(select(Trip).where(Trip.name == target_name)).all()
        if not trips:
            print(f"No trip named {target_name!r} found — nothing to do.")
            return 0
        for t in trips:
            user = db.get(User, t.owner_id)
            print(f"Deleting trip id={t.id} for user={user.email if user else '?'}")
            db.delete(t)
        db.commit()
        print(f"Deleted {len(trips)} trip(s). Restart server to re-seed from updated module.")
        return 0


if __name__ == "__main__":
    sys.exit(main())
