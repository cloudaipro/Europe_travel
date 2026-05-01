"""Tour-planner ingest. Synchronous MVP — runs the planner inline, persists
a Trip on success, returns the trip_id."""
from datetime import date, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from .. import schemas
from ..auth import CurrentUser
from ..config import settings
from ..db import get_db
from ..limiter import limiter
from ..models import Booking, Day, IngestJob, Stop, Trip
from ..planner import plan_trip

router = APIRouter(prefix="/api/plan", tags=["plan"])


def _parse_date(s, default: date) -> date:
    if isinstance(s, date):
        return s
    if isinstance(s, str):
        try:
            return date.fromisoformat(s)
        except ValueError:
            return default
    return default


def _persist_trip(db: Session, owner_id: int, plan: dict, source_url: str) -> Trip:
    start = _parse_date(plan.get("start_date"), date.today())
    days_count = len(plan.get("days") or []) or 1
    end = _parse_date(plan.get("end_date"), start)

    trip = Trip(
        owner_id=owner_id,
        name=plan.get("name") or "New trip",
        destination=plan.get("destination") or "",
        start_date=start,
        end_date=end,
        season=plan.get("season") or "",
        style=plan.get("style") or "",
        pace=plan.get("pace") or "",
        source_url=source_url or plan.get("source_url") or "",
        hotel_name=plan.get("hotel_name") or "",
        hotel_lat=plan.get("hotel_lat"),
        hotel_lng=plan.get("hotel_lng"),
        hotel_address=plan.get("hotel_address") or "",
    )
    db.add(trip)
    db.flush()

    for b in plan.get("bookings") or []:
        db.add(Booking(
            trip_id=trip.id,
            label=b.get("label", "")[:300],
            url=b.get("url", "")[:500],
            done=bool(b.get("done")),
        ))

    for d in plan.get("days") or []:
        day = Day(
            trip_id=trip.id,
            n=int(d.get("n") or 1),
            date_label=d.get("date_label", "")[:40],
            theme=d.get("theme", "")[:255],
            mode=d.get("mode", "")[:60],
        )
        db.add(day)
        db.flush()
        for idx, s in enumerate(d.get("stops") or []):
            db.add(Stop(
                day_id=day.id,
                order_idx=idx,
                time_label=str(s.get("time_label", ""))[:20],
                name=str(s.get("name", "Stop"))[:255],
                address=str(s.get("address", ""))[:300],
                lat=s.get("lat"),
                lng=s.get("lng"),
                hours=str(s.get("hours", ""))[:255],
                tickets=str(s.get("tickets", ""))[:255],
                intro=str(s.get("intro", "")),
                highlights=list(s.get("highlights") or []),
                transit=str(s.get("transit", "")),
                washroom=str(s.get("washroom", "")),
                food=list(s.get("food") or []),
                note="",
            ))

    db.commit()
    db.refresh(trip)
    return trip


@router.post("/ingest")
@limiter.limit(settings.rate_ingest)
def ingest(
    request: Request,
    payload: schemas.IngestIn,
    user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
):
    """Synchronous ingest. Records an IngestJob for audit/visibility.
    Returns {job_id, trip_id, status} on success."""
    job = IngestJob(
        owner_id=user.id,
        status="running",
        payload_json=payload.model_dump(),
        started_at=datetime.utcnow(),
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    try:
        plan = plan_trip(
            destination=payload.destination,
            days=payload.days,
            source_url=payload.source_url,
            style=payload.style,
        )
        trip = _persist_trip(db, user.id, plan, payload.source_url)
        job.status = "done"
        job.result_trip_id = trip.id
        job.finished_at = datetime.utcnow()
        db.commit()
        return {
            "job_id": str(job.id),
            "trip_id": trip.id,
            "status": "done",
            "message": f"Created trip '{trip.name}' with {len(plan.get('days') or [])} days.",
            "backend": "anthropic" if settings.anthropic_api_key else "mock",
        }
    except Exception as e:
        job.status = "failed"
        job.error = str(e)[:2000]
        job.finished_at = datetime.utcnow()
        db.commit()
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"ingest failed: {e}") from e


@router.get("/jobs/{job_id}")
def get_job(job_id: int, user: CurrentUser, db: Annotated[Session, Depends(get_db)]):
    job = db.get(IngestJob, job_id)
    if not job or job.owner_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "job not found")
    return {
        "id": job.id, "status": job.status,
        "result_trip_id": job.result_trip_id, "error": job.error,
        "started_at": job.started_at.isoformat() if job.started_at else None,
        "finished_at": job.finished_at.isoformat() if job.finished_at else None,
    }
