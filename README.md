# Europe Travel

Working repo for a multi-day Vienna + Budapest trip. Contains the **TourCompanion** app (the main deliverable) plus the source research, itineraries, and reference material the app was built from.

## Layout

```
Europe_travel/
├── TourCompanion/              # The app (FastAPI + SPA + iOS wrapper). See its own README.
├── Budapest_3_Day_Itinerary.md # Source itinerary draft
├── Vienna-budapest-train.md    # RegioJet notes
├── food.md                     # Food/street-food research
├── vienna.html                 # Standalone Vienna page (legacy demo)
├── new-setup.md                # Local setup notes
├── checklist.md                # Pre-trip checklist
├── ARCHITECT.md / BUILDER.md / REVIEWER.md  # Three-Man-Team role briefs
├── VERSION                     # Current app version (v1.2.3)
├── RegioJet_STANDARD_OnboardService.pdf
├── Budapest/  vienna/          # Raw destination research (not part of the app)
├── imgs/  images/              # Reference imagery
├── handoff/                    # Hand-off notes between work sessions
└── misc_temp/                  # Scratch
```

`Budapest/`, `vienna/`, `imgs/`, `handoff/` are research / source data used only during development and are **not** shipped by the app.

## TourCompanion (the app)

Multi-stage travel app: **Plan · Tour · Memory**.

- **Backend** — FastAPI + Postgres (SQLite for local dev), Alembic migrations, JWT auth, Anthropic-backed itinerary generator, Nominatim geocoding with drift + destination-anchor safety, check-ins / photos / voice notes.
- **Frontend** — vanilla-JS SPA, Leaflet map, three tabs (Plan / Tour / Memory).
- **iOS** — Capacitor 6 wrapper around the web bundle (`TourCompanion/packages/ios`). TestFlight runbook in `packages/ios/TESTFLIGHT.md`.
- **Monorepo** — `TourCompanion/packages/{core,web,ios}` with npm workspaces.

### Quick start

```bash
# Option A — local, no Docker (SQLite)
./TourCompanion/server/run_local.sh

# Option B — Docker (Postgres, prod-like)
cd TourCompanion
cp .env.example .env        # edit JWT_SECRET
docker compose up --build
```

App: http://localhost:8000 · API docs: http://localhost:8000/docs · Health: http://localhost:8000/api/health

Demo creds (auto-seeded):

- **Email:** `demo@tourcompanion.app`
- **Password:** `demo1234`

Two trips are seeded: a 5-day Budapest trip with progress (check-ins, photos, voice notes) and a 10-day Vienna+Budapest trip in pre-departure state.

See [`TourCompanion/README.md`](TourCompanion/README.md) for the full app docs — API surface, geocoder design, Alembic workflow, production TODOs.

## Team roles

`ARCHITECT.md`, `BUILDER.md`, `REVIEWER.md` define the Three-Man-Team workflow (Arch / Bob / Richard) used during build sessions. See `CLAUDE.md` for the router rules.

## Version

Current: see [`VERSION`](VERSION).
