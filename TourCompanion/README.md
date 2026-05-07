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
    ├── migrate.sh              # alembic wrapper (injects dev DATABASE_URL default)
    ├── alembic.ini
    ├── alembic/                # migrations
    │   ├── env.py
    │   └── versions/*.py
    ├── scripts/
    │   └── backfill_geocodes.py  # ad-hoc Nominatim re-geocode of existing trips
    ├── app/
    │   ├── main.py             # FastAPI app + lifespan + static mounts
    │   ├── config.py           # pydantic-settings
    │   ├── db.py               # SQLAlchemy engine + session
    │   ├── models.py           # User, EmailToken, Trip, Day, Stop, CheckIn, Photo, VoiceNote, StreetFood, Booking, CompanionDoc, RouteAsset, IngestJob
    │   ├── schemas.py          # Pydantic IO
    │   ├── auth.py             # bcrypt + JWT
    │   ├── mailer.py           # email-token sender (verify / reset)
    │   ├── planner.py          # Anthropic-backed itinerary generator (mock fallback)
    │   ├── geocoder.py         # Nominatim wrapper + drift / destination-anchor safety
    │   ├── seed.py             # demo user + auto-loads every seed_data module
    │   ├── seed_data/
    │   │   ├── budapest.py        # 5-day demo with check-ins/photos/voice notes
    │   │   └── vienna_budapest.py # 10-day Vienna+Budapest trip (no progress yet)
    │   └── routes/
    │       ├── auth.py         # /api/auth/{signup,login,login-json,me,verify,resend-verification,forgot,reset}
    │       ├── trips.py        # /api/trips CRUD
    │       ├── tour.py         # /api/stops/{id}/{checkin,photos,photos-link,voice}
    │       ├── journal.py      # /api/trips/{id}/journal PUT
    │       ├── streetfood.py   # /api/trips/{id}/streetfood (with proximity rank)
    │       └── plan.py         # /api/plan/ingest (auto-geocodes new trips in background)
    └── frontend/
        └── index.html          # SPA — Plan/Tour/Memory tabs, Leaflet map, JWT in localStorage
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

Two trips are auto-created for the demo user — a 5-day Budapest trip with progress (check-ins, photos, voice notes for Days 1–3) and a 10-day Vienna+Budapest trip in pre-departure state.

## API surface

| Method | Path | Notes |
|---|---|---|
| POST | `/api/auth/signup` | json `{email, password}` |
| POST | `/api/auth/login` | OAuth2 form (username=email, password) |
| POST | `/api/auth/login-json` | json variant |
| GET  | `/api/auth/me` | current user |
| POST | `/api/auth/verify` | confirm email-verification token |
| POST | `/api/auth/resend-verification` | re-send verification email |
| POST | `/api/auth/forgot` | request password-reset token |
| POST | `/api/auth/reset` | redeem reset token + set new password |
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
| POST | `/api/plan/ingest` | generate a new trip from `{destination, days, source_url, style}`. Persists synchronously, **schedules a background geocode** so stop coordinates resolve to real-world places after the response is sent. |
| GET  | `/api/plan/jobs/{id}` | inspect ingest-job status (queued/running/done/failed) |

## Frontend

Single-page app at `server/frontend/index.html`. Three tabs:

- **Plan** — full-canvas Leaflet map + itinerary panel. Click a stop card → map flies to that stop and a popup opens. Click a marker → list scrolls + opens that card. Auto-closes the previously-open card. Day pills show check-in progress as a `(checked/total)` badge. Keyboard: `↑↓`/`jk` step stops, `←→` step day, `Esc` deselect.
- **Tour** — in-the-field check-in / photo / voice-note interface, day-pill progress strip, sidebar with phrasebook / washroom / currency / weather / cheap-eats modals.
- **Memory** — color-coded journey map (one color per day, separate polylines), daily-wrap cards. Click a marker → fly to that day's bounds + flash card. Click a day card → same.

The trip-picker dropdown in the header switches between trips for the current user; the selection persists in localStorage. The "🤖 Generate from URL…" entry triggers `/api/plan/ingest`.

The `gmapsUrl(stop)` helper builds a Google Maps URL using the **search action API** with precedence `name + address` > `name + destination` > `lat/lng`. This way Google's geocoder lands on the correct Place page even when our stored coordinates are slightly off.

## Geocoding — how stop coordinates stay accurate

Third-party itinerary planners (and our `planner.py` mock) often produce approximate or placeholder lat/lng. The map markers and walk-time connectors depend on accurate coords, so the server geocodes stops via OpenStreetMap **Nominatim** and rewrites their `lat`/`lng` in the DB.

Two paths into it:

1. **Automatic** — `POST /api/plan/ingest` schedules `geocode_trip_async(trip.id)` via FastAPI `BackgroundTasks`. The endpoint returns immediately with a `trip_id`; coordinates resolve over the next 30–60s in the background.
2. **Ad-hoc** — `python -m scripts.backfill_geocodes` for fixing trips that pre-date this feature, or for force-refreshing existing rows.

Two safety nets reject implausible results:

- **Drift check** — when a stop already has a real seed coord, the geocoded result must be within 50 km. (Catches arte Hotel Wien Stadthalle landing 500m off — accepted; rejects Berlin/Singapore-class mishits.)
- **Destination anchor** — when a stop has placeholder `(0,0)` or `None`, the trip's `destination` field is itself geocoded, and stop results must be within 250 km of that anchor. (Catches "Mock stop 3" → Idaho when we're really planning Vienna.)

The cleaning logic strips parentheticals (`(check-in)`, non-Latin annotations like `(莫扎特之家)`), leading verbs (`Lunch at`, `Walk through`, `Tour of`), and trailing qualifiers (`tour`, `visit`, `entry`). Multi-form fallback queries: `name, city` → `name` → `name, address` → `address` only.

Respects Nominatim's 1 req/sec usage policy via a 1.1s sleep between calls and identifies the client via a descriptive User-Agent header.

```bash
cd server
.venv/bin/python -m scripts.backfill_geocodes              # fill missing only
.venv/bin/python -m scripts.backfill_geocodes --force      # rewrite every row
.venv/bin/python -m scripts.backfill_geocodes --dry-run    # preview
.venv/bin/python -m scripts.backfill_geocodes --limit 8    # try a few first
```

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

- Image upload via multipart is wired; replace local volume with S3/R2 for prod.
- Rate limiting + CSRF for the cookie-based variant if we move off bearer tokens.
- HTTPS termination (handled by Fly.io / Render / nginx in front).
- Mobile responsive layout — Plan tab's 38% right panel doesn't gracefully fall back to a one-pane phone view yet.
- Geocoder runs synchronously in a background task on the same uvicorn process. For high ingest volume, push to a queue (Celery/RQ) so a stuck Nominatim request can't tie up a worker.
- Anthropic-driven `/api/plan/ingest` returns 8 stops/day; tune the prompt for quality + diversity once we have real users.
