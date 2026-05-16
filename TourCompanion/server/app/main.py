import logging
from contextlib import asynccontextmanager
from pathlib import Path

# Surface app loggers (geocoder etc.) at INFO so background-task progress
# is visible in dev. Uvicorn's own logger config still applies on top.
logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s %(levelname)s %(name)s: %(message)s")

from alembic import command as alembic_command
from alembic.config import Config as AlembicConfig
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException
from sqlalchemy.orm import Session
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi import _rate_limit_exceeded_handler

from .config import settings
from .db import SessionLocal, get_db
from .models import Trip
from .limiter import limiter
from .routes import auth as auth_routes
from .routes import trips, tour, journal, streetfood, plan
from .seed import seed_demo_user_and_trip


def _run_migrations() -> None:
    """Apply Alembic migrations up to head. Idempotent."""
    server_root = Path(__file__).resolve().parent.parent
    cfg = AlembicConfig(str(server_root / "alembic.ini"))
    cfg.set_main_option("script_location", str(server_root / "alembic"))
    cfg.set_main_option("sqlalchemy.url", settings.database_url)
    alembic_command.upgrade(cfg, "head")


@asynccontextmanager
async def lifespan(app: FastAPI):
    _run_migrations()
    if settings.seed_on_boot:
        with SessionLocal() as db:
            seed_demo_user_and_trip(db)
    yield


app = FastAPI(title="Tour Companion API", lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",")] or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
def health():
    return {"ok": True}


app.include_router(auth_routes.router)
app.include_router(trips.router)
app.include_router(trips.public_router)
app.include_router(tour.router)
app.include_router(journal.router)
app.include_router(streetfood.router)
app.include_router(plan.router)

Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")

frontend_dir = (
    Path(__file__).resolve().parent.parent.parent / "packages" / "web" / "public"
)


# KG-3b: public share-link viewer. Serve the same SPA shell as "/"; the
# frontend detects `/p/` in location.pathname and switches to public mode.
# Registered BEFORE the catch-all StaticFiles mount so it wins.
# KG-9: return real 404 when slug is unknown instead of serving SPA shell.
@app.get("/p/{slug}")
def serve_public_spa(slug: str, db: Annotated[Session, Depends(get_db)]):
    if not db.query(Trip).filter_by(published_slug=slug).first():
        raise HTTPException(404, "trip not found")
    index_html = frontend_dir / "index.html"
    if not index_html.exists():
        raise HTTPException(404, "frontend not built")
    return FileResponse(str(index_html))


if frontend_dir.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dir), html=True), name="frontend")
