import secrets
from datetime import timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from pydantic import BaseModel

from .. import schemas
from ..auth import CurrentUser
from ..config import settings
from ..db import get_db
from ..limiter import limiter
from ..models import Trip, Day, Stop


class StopReorderIn(BaseModel):
    stop_ids: list[int]


class StopCreateIn(BaseModel):
    name: str
    time_label: str = ""
    address: str = ""


router = APIRouter(prefix="/api/trips", tags=["trips"])


def _stop_to_out(s: Stop) -> schemas.StopOut:
    return schemas.StopOut(
        id=s.id, order_idx=s.order_idx, time_label=s.time_label, name=s.name,
        address=s.address, lat=s.lat, lng=s.lng, hours=s.hours, tickets=s.tickets,
        intro=s.intro, highlights=s.highlights or [], transit=s.transit,
        washroom=s.washroom, food=s.food or [], note=s.note,
        promo=s.promo,
        check_in_count=len(s.check_ins),
        photo_paths=[p.path for p in s.photos],
        voice_transcript=(s.voice_notes[-1].transcript if s.voice_notes else ""),
    )


def _trip_to_detail(t: Trip) -> schemas.TripDetail:
    return schemas.TripDetail(
        id=t.id, name=t.name, destination=t.destination,
        start_date=t.start_date, end_date=t.end_date, status=t.status,
        season=t.season, style=t.style, pace=t.pace, source_url=t.source_url,
        hotel_name=t.hotel_name, hotel_lat=t.hotel_lat, hotel_lng=t.hotel_lng,
        hotel_address=t.hotel_address, journal=t.journal,
        published_slug=t.published_slug,
        days=[
            schemas.DayOut(
                id=d.id, n=d.n, date_label=d.date_label, theme=d.theme, mode=d.mode,
                stops=[_stop_to_out(s) for s in d.stops],
            )
            for d in t.days
        ],
        bookings=[schemas.BookingOut.model_validate(b) for b in t.bookings],
        companion_docs=[schemas.CompanionDocOut.model_validate(c) for c in t.companion_docs],
        routes=[schemas.RouteAssetOut.model_validate(r) for r in t.routes],
        street_food=[schemas.StreetFoodOut.model_validate(f) for f in t.street_food],
    )


def _owned(db: Session, user, trip_id: int) -> Trip:
    t = db.get(Trip, trip_id)
    if not t or t.owner_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "trip not found")
    return t


@router.get("", response_model=list[schemas.TripSummary])
def list_trips(user: CurrentUser, db: Annotated[Session, Depends(get_db)]):
    return db.query(Trip).filter_by(owner_id=user.id).order_by(Trip.start_date.desc()).all()


@router.post("", response_model=schemas.TripDetail, status_code=201)
def create_trip(
    payload: schemas.TripCreate, user: CurrentUser, db: Annotated[Session, Depends(get_db)]
):
    t = Trip(
        owner_id=user.id, name=payload.name, destination=payload.destination,
        start_date=payload.start_date, end_date=payload.end_date,
        season=payload.season, style=payload.style, pace=payload.pace,
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    return _trip_to_detail(t)


@router.get("/{trip_id}", response_model=schemas.TripDetail)
def get_trip(trip_id: int, user: CurrentUser, db: Annotated[Session, Depends(get_db)]):
    return _trip_to_detail(_owned(db, user, trip_id))


@router.delete("/{trip_id}", status_code=204)
def delete_trip(trip_id: int, user: CurrentUser, db: Annotated[Session, Depends(get_db)]):
    t = _owned(db, user, trip_id)
    db.delete(t)
    db.commit()


@router.post("/{trip_id}/days", response_model=schemas.TripDetail, status_code=201)
def add_day(trip_id: int, user: CurrentUser, db: Annotated[Session, Depends(get_db)]):
    t = _owned(db, user, trip_id)
    next_n = (max((d.n for d in t.days), default=0)) + 1
    new_date = t.start_date + timedelta(days=next_n - 1)
    # Match seed_data format: "Fri 22 May"
    label = new_date.strftime("%a %d %b")
    d = Day(trip_id=t.id, n=next_n, date_label=label, theme="", mode="")
    db.add(d)
    # Extend trip end_date if needed
    if t.end_date < new_date:
        t.end_date = new_date
    db.commit()
    db.refresh(t)
    return _trip_to_detail(t)


@router.delete("/{trip_id}/days/{day_n}", response_model=schemas.TripDetail)
def remove_day(trip_id: int, day_n: int, user: CurrentUser, db: Annotated[Session, Depends(get_db)]):
    t = _owned(db, user, trip_id)
    if len(t.days) <= 1:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "cannot remove the only day")
    max_n = max(d.n for d in t.days)
    if day_n != max_n:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "only the last day can be removed")
    target = next((d for d in t.days if d.n == day_n), None)
    if not target:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "day not found")
    db.delete(target)
    # Pull back end_date by 1 day
    if t.end_date > t.start_date:
        t.end_date = t.end_date - timedelta(days=1)
    db.commit()
    db.refresh(t)
    return _trip_to_detail(t)


@router.post("/{trip_id}/days/{day_n}/stops", response_model=schemas.TripDetail, status_code=201)
def add_stop(
    trip_id: int, day_n: int, payload: StopCreateIn,
    user: CurrentUser, db: Annotated[Session, Depends(get_db)],
):
    t = _owned(db, user, trip_id)
    name = payload.name.strip()
    if not name:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "name is required")
    day = next((d for d in t.days if d.n == day_n), None)
    if not day:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "day not found")
    next_idx = max((s.order_idx for s in day.stops), default=-1) + 1
    lat: float = 0.0
    lng: float = 0.0
    addr = payload.address.strip()
    if addr:
        # Best-effort geocode. Leaves (0, 0) on miss/error; the existing
        # background geocoder treats (0, 0) as "no seed" and can fill later.
        try:
            from ..geocoder import geocode_query
            res = geocode_query(addr)
            if res:
                lat, lng = res
        except Exception:
            pass
    s = Stop(
        day_id=day.id, order_idx=next_idx, name=name,
        time_label=payload.time_label.strip(), address=addr,
        lat=lat, lng=lng,
    )
    db.add(s)
    db.commit()
    db.refresh(t)
    return _trip_to_detail(t)


@router.put("/days/{day_id}/stops/order")
def reorder_stops(
    day_id: int, payload: StopReorderIn, user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
):
    day = db.get(Day, day_id)
    if not day:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "day not found")
    trip = db.get(Trip, day.trip_id)
    if not trip or trip.owner_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "day not found")

    existing = {s.id: s for s in day.stops}
    if set(payload.stop_ids) != set(existing.keys()):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "stop_ids must be a permutation of this day's stops",
        )
    for idx, sid in enumerate(payload.stop_ids):
        existing[sid].order_idx = idx
    db.commit()
    return {"day_id": day.id, "stop_ids": payload.stop_ids}


# ── KG-3b: Publish flow ─────────────────────────────────────────────────────

def _public_trip_to_detail(t: Trip) -> schemas.TripDetail:
    """Sanitized TripDetail for public viewers — strips journal, bookings,
    per-stop note/check_in_count/photo_paths/voice_transcript, and the
    internal trip id (slug is the only public handle)."""
    detail = _trip_to_detail(t)
    detail.id = 0
    detail.journal = ""
    detail.bookings = []
    detail.published_slug = None
    for d in detail.days:
        d.id = 0
        for s in d.stops:
            s.id = 0
            s.note = ""
            s.check_in_count = 0
            s.photo_paths = []
            s.voice_transcript = ""
    return detail


@router.post("/{trip_id}/publish")
def publish_trip(
    trip_id: int, user: CurrentUser, db: Annotated[Session, Depends(get_db)]
):
    t = _owned(db, user, trip_id)
    if not t.published_slug:
        # secrets.token_urlsafe(8) returns ~11 chars of base64url (≥48 bits
        # of entropy from 8 random bytes); take first 10 chars. Retry on the
        # exceedingly rare collision.
        for _ in range(5):
            slug = secrets.token_urlsafe(8)[:10]
            existing = db.query(Trip).filter_by(published_slug=slug).first()
            if not existing:
                t.published_slug = slug
                db.commit()
                break
        else:
            raise HTTPException(500, "could not generate unique slug")
    return {"slug": t.published_slug, "url": f"/p/{t.published_slug}"}


@router.delete("/{trip_id}/publish", status_code=204)
def unpublish_trip(
    trip_id: int, user: CurrentUser, db: Annotated[Session, Depends(get_db)]
):
    t = _owned(db, user, trip_id)
    t.published_slug = None
    db.commit()


# Separate router for the no-auth public viewer endpoint (different prefix).
public_router = APIRouter(prefix="/api/public/trips", tags=["public"])


@public_router.get("/{slug}", response_model=schemas.TripDetail)
@limiter.limit(settings.rate_public)
def get_public_trip(request: Request, slug: str, db: Annotated[Session, Depends(get_db)]):
    t = db.query(Trip).filter_by(published_slug=slug).first()
    if not t:
        raise HTTPException(404, "not found")
    return _public_trip_to_detail(t)
