from datetime import datetime

from sqlalchemy.orm import Session

from .auth import hash_password
from .models import (
    Booking, CheckIn, CompanionDoc, Day, Photo, RouteAsset,
    Stop, StreetFood, Trip, User, VoiceNote,
)
from .seed_data import budapest as bp


def seed_demo_user_and_trip(db: Session) -> User:
    user = db.query(User).filter_by(email=bp.DEMO_USER["email"]).first()
    if user:
        return user

    user = User(
        email=bp.DEMO_USER["email"],
        password_hash=hash_password(bp.DEMO_USER["password"]),
        display_name=bp.DEMO_USER["display_name"],
        email_verified_at=datetime.utcnow(),  # demo seed: pre-verified
    )
    db.add(user)
    db.flush()

    trip = Trip(owner_id=user.id, **bp.TRIP)
    db.add(trip)
    db.flush()

    for b in bp.BOOKINGS:
        db.add(Booking(trip_id=trip.id, **b))
    for c in bp.COMPANION_DOCS:
        db.add(CompanionDoc(trip_id=trip.id, **c))
    for r in bp.ROUTES:
        db.add(RouteAsset(trip_id=trip.id, **r))
    for f in bp.STREET_FOOD:
        db.add(StreetFood(trip_id=trip.id, **f))

    day_objs: dict[int, Day] = {}
    stop_objs: dict[tuple[int, int], Stop] = {}
    for d in bp.DAYS:
        stops = d["stops"]
        day_kwargs = {k: v for k, v in d.items() if k != "stops"}
        day = Day(trip_id=trip.id, **day_kwargs)
        db.add(day)
        db.flush()
        day_objs[d["n"]] = day
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

    for day_n, idxs in bp.CHECK_INS.items():
        for idx in idxs:
            stop = stop_objs.get((day_n, idx))
            if stop:
                db.add(CheckIn(stop_id=stop.id, lat=stop.lat, lng=stop.lng))

    for (day_n, idx), paths in bp.PHOTOS.items():
        stop = stop_objs.get((day_n, idx))
        if not stop:
            continue
        for p in paths:
            db.add(Photo(stop_id=stop.id, path=p))

    for (day_n, idx), transcript in bp.VOICE_NOTES.items():
        stop = stop_objs.get((day_n, idx))
        if stop:
            db.add(VoiceNote(stop_id=stop.id, transcript=transcript))

    db.commit()
    return user
