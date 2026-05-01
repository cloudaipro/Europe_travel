import shutil
import uuid
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from .. import schemas
from ..auth import CurrentUser
from ..config import settings
from ..db import get_db
from ..models import CheckIn, Photo, Stop, Trip, VoiceNote


router = APIRouter(prefix="/api/stops", tags=["tour"])


def _own_stop(db: Session, user, stop_id: int) -> Stop:
    s = db.get(Stop, stop_id)
    if not s:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "stop not found")
    trip = db.get(Trip, s.day.trip_id)
    if not trip or trip.owner_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "stop not found")
    return s


@router.post("/{stop_id}/checkin")
def check_in(
    stop_id: int, payload: schemas.CheckInIn, user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
):
    s = _own_stop(db, user, stop_id)
    ci = CheckIn(stop_id=s.id, lat=payload.lat, lng=payload.lng)
    db.add(ci)
    db.commit()
    db.refresh(ci)
    return {"id": ci.id, "stop_id": s.id, "visited_at": ci.visited_at.isoformat()}


@router.post("/{stop_id}/photos")
def add_photo(
    stop_id: int, user: CurrentUser, db: Annotated[Session, Depends(get_db)],
    file: UploadFile = File(...),
):
    s = _own_stop(db, user, stop_id)
    ext = Path(file.filename or "img").suffix or ".jpg"
    fname = f"{uuid.uuid4().hex}{ext}"
    dest = Path(settings.upload_dir) / fname
    dest.parent.mkdir(parents=True, exist_ok=True)
    with dest.open("wb") as out:
        shutil.copyfileobj(file.file, out)
    p = Photo(stop_id=s.id, path=f"/uploads/{fname}")
    db.add(p)
    db.commit()
    db.refresh(p)
    return {"id": p.id, "stop_id": s.id, "path": p.path}


@router.post("/{stop_id}/photos-link")
def add_photo_link(
    stop_id: int, payload: dict, user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
):
    s = _own_stop(db, user, stop_id)
    path = payload.get("path", "")
    if not path:
        raise HTTPException(400, "path required")
    p = Photo(stop_id=s.id, path=path)
    db.add(p)
    db.commit()
    db.refresh(p)
    return {"id": p.id, "stop_id": s.id, "path": p.path}


@router.post("/{stop_id}/voice")
def add_voice(
    stop_id: int, payload: schemas.VoiceNoteIn, user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
):
    s = _own_stop(db, user, stop_id)
    vn = VoiceNote(stop_id=s.id, transcript=payload.transcript)
    db.add(vn)
    db.commit()
    db.refresh(vn)
    return {"id": vn.id, "stop_id": s.id, "transcript": vn.transcript}
