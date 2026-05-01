import math
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from .. import schemas
from ..auth import CurrentUser
from ..db import get_db
from .trips import _owned


router = APIRouter(prefix="/api/trips", tags=["streetfood"])


def _haversine_km(a_lat, a_lng, b_lat, b_lng):
    if None in (a_lat, a_lng, b_lat, b_lng):
        return 999.0
    R = 6371.0
    rad = math.radians
    dlat = rad(b_lat - a_lat)
    dlng = rad(b_lng - a_lng)
    x = math.sin(dlat / 2) ** 2 + math.cos(rad(a_lat)) * math.cos(rad(b_lat)) * math.sin(dlng / 2) ** 2
    return 2 * R * math.asin(math.sqrt(x))


@router.get("/{trip_id}/streetfood")
def list_street_food(
    trip_id: int, user: CurrentUser, db: Annotated[Session, Depends(get_db)],
    band: str | None = Query(None, description="local|mid|tourist"),
    near_lat: float | None = None, near_lng: float | None = None, limit: int = 50,
):
    t = _owned(db, user, trip_id)
    anchor_lat = near_lat if near_lat is not None else t.hotel_lat
    anchor_lng = near_lng if near_lng is not None else t.hotel_lng
    out = []
    for f in t.street_food:
        if band and f.price_band != band:
            continue
        km = _haversine_km(anchor_lat, anchor_lng, f.lat, f.lng)
        proximity = max(0.0, 1.0 - km / 8.0)
        score = 0.65 * f.locality_score + 0.35 * proximity
        out.append({
            **schemas.StreetFoodOut.model_validate(f).model_dump(),
            "km": round(km, 2),
            "walk_min": round(km * 12.5),
            "rank_score": round(score, 3),
        })
    out.sort(key=lambda x: x["rank_score"], reverse=True)
    return out[:limit]
