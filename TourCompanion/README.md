# Tour Companion

Multi-stage travel app: **Plan · Tour · Remember**. FastAPI + Postgres backend + vanilla-JS SPA frontend, packaged with Docker Compose.

```
TourCompanion/
├── docker-compose.yml          # Postgres + API
├── .env.example                # JWT secret, CORS origins
├── tour_companion.html         # Original single-file demo (kept for reference)
└── server/
    ├── Dockerfile
    ├── requirements.txt
    ├── run_local.sh            # one-shot: venv + deps + uvicorn (SQLite, no Docker)
    ├── migrate.sh               # alembic wrapper (injects dev DATABASE_URL default)
    ├── alembic.ini
    ├── alembic/                 # migrations
    │   ├── env.py
    │   └── versions/*.py
    ├── app/
    │   ├── main.py             # FastAPI app + lifespan + static mounts
    │   ├── config.py           # pydantic-settings
    │   ├── db.py               # SQLAlchemy engine + session
    │   ├── models.py           # User, Trip, Day, Stop, CheckIn, Photo, VoiceNote, StreetFood, Booking, CompanionDoc, RouteAsset
    │   ├── schemas.py          # Pydantic IO
    │   ├── auth.py             # bcrypt + JWT
    │   ├── seed.py             # demo user + Budapest trip seed
    │   ├── seed_data/budapest.py
    │   └── routes/
    │       ├── auth.py         # /api/auth/{signup,login,login-json,me}
    │       ├── trips.py        # /api/trips CRUD
    │       ├── tour.py         # /api/stops/{id}/{checkin,photos,photos-link,voice}
    │       ├── journal.py      # /api/trips/{id}/journal PUT
    │       ├── streetfood.py   # /api/trips/{id}/streetfood (with proximity rank)
    │       └── plan.py         # /api/plan/ingest (tour-planner skill stub)
    └── frontend/
        └── index.html          # SPA — calls /api, login screen, JWT in localStorage
```

## Run it

### Option A — local (no Docker, SQLite)

```
./server/run_local.sh
```

First run creates a `.venv` and installs deps (~30s). Subsequent runs are instant. Reloads on file changes.

Override env vars: `PORT=9000 JWT_SECRET=$(openssl rand -hex 32) ./server/run_local.sh`

To wipe + reseed: `rm server/tour.db && ./server/run_local.sh`

### Option B — Docker (Postgres, prod-like)

```
cp .env.example .env       # edit JWT_SECRET
docker compose up --build
```

Postgres exposed on host port 5433. Volumes `pgdata` + `uploads` persist across restarts.

### Either way

App at http://localhost:8000 · API docs at http://localhost:8000/docs · Health: http://localhost:8000/api/health

Demo creds (auto-seeded on first boot):

- **Email:** `demo@tourcompanion.app`
- **Password:** `demo1234`

## API surface

| Method | Path | Notes |
|---|---|---|
| POST | `/api/auth/signup` | json `{email, password}` |
| POST | `/api/auth/login` | OAuth2 form (username=email, password) |
| POST | `/api/auth/login-json` | json variant |
| GET  | `/api/auth/me` | current user |
| GET  | `/api/trips` | list user's trips |
| POST | `/api/trips` | create trip |
| GET  | `/api/trips/{id}` | full trip detail (days, stops, bookings, routes, street_food, journal) |
| DELETE | `/api/trips/{id}` | |
| POST | `/api/stops/{id}/checkin` | record check-in (body: optional lat/lng) |
| POST | `/api/stops/{id}/photos` | multipart upload — saved to `/uploads/...` |
| POST | `/api/stops/{id}/photos-link` | json `{path}` for already-hosted images |
| POST | `/api/stops/{id}/voice` | json `{transcript}` |
| PUT  | `/api/trips/{id}/journal` | json `{journal}` |
| GET  | `/api/trips/{id}/streetfood` | query: `band`, `near_lat`, `near_lng`, `limit` — returns ranked picks |
| POST | `/api/plan/ingest` | tour-planner skill integration (stub) |

## Database migrations

Schema changes go through Alembic. Use `./migrate.sh` (wraps alembic + injects dev env defaults so you don't need to remember `DATABASE_URL=…`).

> **Why a wrapper?** Raw `alembic` reads `DATABASE_URL` from app settings, which defaults to Docker's `db:5432` hostname. Run outside compose → DNS error. `migrate.sh` sets `DATABASE_URL=sqlite:///./tour.db` only when unset, so local dev works zero-config. Any exported `DATABASE_URL` wins, so the same script handles dev/staging/prod.

```
cd server
./migrate.sh revision --autogenerate -m "describe change"   # create migration
# review the generated file in alembic/versions/, then:
./migrate.sh upgrade head                                   # apply locally
./migrate.sh current                                        # show current head
./migrate.sh history                                        # log
./migrate.sh downgrade -1                                   # roll back one
```

To run against Postgres (e.g. inside compose), prefix with `DATABASE_URL=…`. The wrapper only sets the SQLite default if you don't already have one.

Migrations apply automatically on server boot (FastAPI lifespan calls `alembic upgrade head` before serving). Idempotent — second boot is a no-op.

For Postgres / multi-replica: add an advisory lock to `_run_migrations` or run migrations in a separate deploy step before scaling out.

## What's still TODO for true production

- Real `tour-planner` skill integration in `/api/plan/ingest` (currently a no-op stub returning a job ID).
- Image upload via multipart is wired; replace local volume with S3/R2 for prod.
- Email/password reset flow.
- Alembic migrations (currently `Base.metadata.create_all` on lifespan — fine for dev, swap for migrations before any schema change in prod).
- Rate limiting + CSRF for the cookie-based variant if we move off bearer tokens.
- HTTPS termination (handled by Fly.io / Render / nginx in front).
- Multi-trip UI in the frontend (API supports it; frontend currently picks the first trip).
