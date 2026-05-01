from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import schemas
from ..auth import CurrentUser
from ..db import get_db
from ..models import Trip, Day, Stop


router = APIRouter(prefix="/api/trips", tags=["trips"])


def _stop_to_out(s: Stop) -> schemas.StopOut:
    return schemas.StopOut(
        id=s.id, order_idx=s.order_idx, time_label=s.time_label, name=s.name,
        address=s.address, lat=s.lat, lng=s.lng, hours=s.hours, tickets=s.tickets,
        intro=s.intro, highlights=s.highlights or [], transit=s.transit,
        washroom=s.washroom, food=s.food or [], note=s.note,
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
