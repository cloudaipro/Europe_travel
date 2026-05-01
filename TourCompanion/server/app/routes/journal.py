from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import schemas
from ..auth import CurrentUser
from ..db import get_db
from .trips import _owned


router = APIRouter(prefix="/api/trips", tags=["journal"])


@router.put("/{trip_id}/journal")
def update_journal(
    trip_id: int, payload: schemas.JournalIn, user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
):
    t = _owned(db, user, trip_id)
    t.journal = payload.journal
    db.commit()
    return {"trip_id": t.id, "journal": t.journal}
