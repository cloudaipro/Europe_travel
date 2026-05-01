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

## What's still TODO for true production

- Real `tour-planner` skill integration in `/api/plan/ingest` (currently a no-op stub returning a job ID).
- Image upload via multipart is wired; replace local volume with S3/R2 for prod.
- Email/password reset flow.
- Alembic migrations (currently `Base.metadata.create_all` on lifespan — fine for dev, swap for migrations before any schema change in prod).
- Rate limiting + CSRF for the cookie-based variant if we move off bearer tokens.
- HTTPS termination (handled by Fly.io / Render / nginx in front).
- Multi-trip UI in the frontend (API supports it; frontend currently picks the first trip).
