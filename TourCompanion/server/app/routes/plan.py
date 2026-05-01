import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import schemas
from ..auth import CurrentUser
from ..db import get_db


router = APIRouter(prefix="/api/plan", tags=["plan"])


@router.post("/ingest", response_model=schemas.IngestOut)
def ingest(
    payload: schemas.IngestIn, user: CurrentUser, db: Annotated[Session, Depends(get_db)],
):
    """
    Stub for tour-planner skill integration.
    Production: enqueue a job that runs the tour-planner skill against the source URL,
    parses output Markdown into Trip/Day/Stop rows, then notifies the user.
    """
    job_id = uuid.uuid4().hex
    return schemas.IngestOut(
        job_id=job_id,
        status="queued",
        message=(
            f"Ingest queued for {payload.destination} ({payload.days} days). "
            "Tour-planner skill integration TODO — currently a no-op."
        ),
    )
