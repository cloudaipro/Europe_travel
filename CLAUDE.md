@.claude/skills/token-optimization.md

## Project

**TourCompanion** — multi-stage travel app (Plan · Tour · Memory).

- **Stack:** FastAPI + Postgres (or SQLite for local) backend, vanilla-JS single-page frontend, Leaflet map, Alembic migrations, Docker Compose packaging.
- **Layout:** main app lives in `TourCompanion/`. Backend in `TourCompanion/server/app/`, frontend SPA at `TourCompanion/server/frontend/index.html`, original demo at `TourCompanion/tour_companion.html`.
- **Users:** travelers planning + executing multi-day Europe trips (Vienna, Budapest as seeded demos).
- **Key features:** trip planner (Anthropic-backed `/api/plan/ingest` with mock fallback), Nominatim geocoding with drift + destination-anchor safety, JWT auth with email verification, check-ins/photos/voice notes, color-coded journey memory map.
- **Run:** `./TourCompanion/server/run_local.sh` (SQLite, no Docker) or `docker compose up --build` from `TourCompanion/`.

**Ignore at root:** `Budapest/`, `vienna/`, `imgs/`, `handoff/` — reference/source data used only during development. Not part of the app.

## Three Man Team

Available agents: Arch (Architect), Bob (Builder), Richard (Reviewer)
