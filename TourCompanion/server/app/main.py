from contextlib import asynccontextmanager
from pathlib import Path

from alembic import command as alembic_command
from alembic.config import Config as AlembicConfig
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .config import settings
from .db import SessionLocal
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
app.include_router(tour.router)
app.include_router(journal.router)
app.include_router(streetfood.router)
app.include_router(plan.router)

Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")

frontend_dir = Path(__file__).resolve().parent.parent / "frontend"
if frontend_dir.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dir), html=True), name="frontend")
