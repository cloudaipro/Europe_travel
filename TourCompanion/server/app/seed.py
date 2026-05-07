from datetime import datetime

from sqlalchemy.orm import Session

from .auth import hash_password
from .models import (
    Booking, CheckIn, CompanionDoc, Day, Photo, RouteAsset,
    Stop, StreetFood, Trip, User, VoiceNote,
)
from .seed_data import budapest as bp
from .seed_data import vienna_budapest as vb


def _create_trip_from_seed(db: Session, user: User, mod) -> Trip:
    """Create a Trip + all child rows from a seed_data module. Idempotent by trip name."""
    existing = db.query(Trip).filter_by(owner_id=user.id, name=mod.TRIP["name"]).first()
    if existing:
        return existing

    trip = Trip(owner_id=user.id, **mod.TRIP)
    db.add(trip)
    db.flush()

    for b in mod.BOOKINGS:
        db.add(Booking(trip_id=trip.id, **b))
    for c in mod.COMPANION_DOCS:
        db.add(CompanionDoc(trip_id=trip.id, **c))
    for r in mod.ROUTES:
        db.add(RouteAsset(trip_id=trip.id, **r))
    for f in mod.STREET_FOOD:
        db.add(StreetFood(trip_id=trip.id, **f))

    stop_objs: dict[tuple[int, int], Stop] = {}
    for d in mod.DAYS:
        stops = d["stops"]
        day_kwargs = {k: v for k, v in d.items() if k != "stops"}
        day = Day(trip_id=trip.id, **day_kwargs)
        db.add(day)
        db.flush()
        for idx, s in enumerate(stops):
            stop = Stop(
                day_id=day.id, order_idx=idx,
                time_label=s.get("time_label", ""),
                name=s["name"],
                address=s.get("address", ""),
                lat=s.get("lat"), lng=s.get("lng"),
                hours=s.get("hours", ""), tickets=s.get("tickets", ""),
                intro=s.get("intro", ""),
                highlights=s.get("highlights", []),
                transit=s.get("transit", ""),
                washroom=s.get("washroom", ""),
                food=s.get("food", []),
                note=s.get("note", ""),
            )
            db.add(stop)
            db.flush()
            stop_objs[(d["n"], idx)] = stop

    for day_n, idxs in mod.CHECK_INS.items():
        for idx in idxs:
            stop = stop_objs.get((day_n, idx))
            if stop:
                db.add(CheckIn(stop_id=stop.id, lat=stop.lat, lng=stop.lng))

    for (day_n, idx), paths in mod.PHOTOS.items():
        stop = stop_objs.get((day_n, idx))
        if not stop:
            continue
        for p in paths:
            db.add(Photo(stop_id=stop.id, path=p))

    for (day_n, idx), transcript in mod.VOICE_NOTES.items():
        stop = stop_objs.get((day_n, idx))
        if stop:
            db.add(VoiceNote(stop_id=stop.id, transcript=transcript))

    db.commit()
    db.refresh(trip)
    return trip


def seed_demo_user_and_trip(db: Session) -> User:
    user = db.query(User).filter_by(email=bp.DEMO_USER["email"]).first()
    if not user:
        user = User(
            email=bp.DEMO_USER["email"],
            password_hash=hash_password(bp.DEMO_USER["password"]),
            display_name=bp.DEMO_USER["display_name"],
            email_verified_at=datetime.utcnow(),  # demo seed: pre-verified
        )
        db.add(user)
        db.flush()

    _create_trip_from_seed(db, user, bp)
    _create_trip_from_seed(db, user, vb)
    db.commit()
    return user
