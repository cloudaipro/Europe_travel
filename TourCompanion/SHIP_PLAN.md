# Ship Plan — closing the gaps

Plan to take Tour Companion from working-demo to production-ready. Sized + sequenced.

**Ship-ready bar:** real users can sign up, create a trip from a YouTube link, photos survive a server restart, no schema drift breaks them.

## Status

| # | Task | Status |
|---|---|---|
| 1 | Alembic migrations | ✅ done |
| 2 | Rate limit + auth hardening | ✅ done |
| 3 | Multi-trip UI | ✅ done |
| 4 | S3/R2 image upload | ✅ done |
| 5 | Tour-planner ingest (real, sync MVP) | ✅ done — Phase 5B (async) deferred |

**Critical-path MVP complete.** Remaining work is the "beyond the 5" launch checklist below.

---

## Sequence (do in this order)

### 1. Alembic migrations — **0.5 day** ✅ DONE

**Why first:** every other gap adds tables/columns. Without Alembic, schema changes either lose data or require manual SQL.

**Scope:**
- `alembic init alembic`, point env.py at `app.db.Base` + `DATABASE_URL`
- Generate initial migration from current models (`alembic revision --autogenerate -m "init"`)
- Replace `Base.metadata.create_all(engine)` in lifespan with `alembic.command.upgrade(cfg, "head")`
- Doc workflow: `alembic revision --autogenerate -m msg` → review → commit
- Add `alembic upgrade head` to Dockerfile entrypoint + run_local.sh

**Risk:** low. Standard. SQLite quirks for ALTER but already working tables stay fine.

**Shipped:**
- `server/alembic/` initialized; `env.py` reads `Base` + `DATABASE_URL` from app settings; SQLite uses `render_as_batch`
- Initial migration `ad110b1e6a9a_init_schema.py` covers all 11 tables
- `_run_migrations()` in `app/main.py` lifespan calls `alembic upgrade head` on boot (idempotent)
- `server/migrate.sh` wrapper injects dev defaults (`DATABASE_URL=sqlite:///./tour.db`) so `./migrate.sh revision --autogenerate -m …` just works
- Dockerfile copies `alembic/` + `alembic.ini`
- Migration chain verified: 3 stacked migrations apply cleanly on fresh boot

---

### 2. Rate limit + auth hardening — **1.5 days** ✅ DONE

**Why second:** if anyone gets the URL before ingest works, brute-force on /signup or /login is open. Cheap to add now.

**Scope:**
- `slowapi` middleware: 5/min on `/auth/login`, 3/hr on `/auth/signup`, 100/min default per-IP
- Email verification: `email_verified_at` column, signup sends a magic-link token (24h), `/auth/verify` flips flag, login allows un-verified for 7-day grace
- Password reset: `/auth/forgot` issues short-lived token, `/auth/reset` consumes
- Email transport: Resend or Postmark (one API key, one template). Dev = console-print.
- Frontend: verify-pending banner + reset form

**Risk:** medium. Email deliverability is the hassle. Use Resend free tier (3k/mo).

**Migration impact:** needs Alembic (#1) — adds `email_verified_at`, `password_reset_tokens` table.

**Shipped:**
- `User.email_verified_at` + unified `EmailToken(kind in {verify,reset})` table — Alembic `b1e9938e8b98`
- `app/mailer.py` — console backend default; Resend HTTP backend if `RESEND_API_KEY` set; `send_verify_email` + `send_reset_email` templates with `APP_URL` link
- `app/limiter.py` — slowapi limiter; configured 5/min login, 3/hr signup, 3/hr forgot, 100/min default per-IP
- New routes: `POST /auth/verify`, `/auth/resend-verification`, `/auth/forgot`, `/auth/reset`
- Signup auto-issues verify token + sends email; login enforces `VERIFY_GRACE_DAYS=7`; forgot returns 200 even for unknown email
- Frontend: amber verify-pending banner with resend button; forgot-password link; `?verify=…` and `?reset=…` URL handlers; reset-mode form
- E2E verified: signup → verify URL → reset URL → new-password login; rate-limit fires 429 after 5 logins/min
- New env: `APP_URL`, `EMAIL_FROM`, `RESEND_API_KEY`, `VERIFY_TOKEN_TTL_HOURS`, `RESET_TOKEN_TTL_MINUTES`, `VERIFY_GRACE_DAYS`, `RATE_LOGIN/SIGNUP/FORGOT/DEFAULT`

---

### 3. Multi-trip UI — **1 day** ✅ DONE

**Why third:** ingest (#5) creates new trips. Without a picker, user can't see them.

**Scope:**
- Header dropdown: lists `/api/trips`, switches active by setting `localStorage.tc_trip_id`, reloads
- "+ New trip" button → modal with `name, destination, start_date, end_date` form → POST `/api/trips`
- "Delete trip" in trip menu (already in API)
- `loadTrip()` honours `tc_trip_id`; falls back to first trip

**Risk:** low. All API endpoints already exist.

**Migration impact:** none.

**Shipped:**
- Header trip-picker dropdown lists all trips, marks current with ✓
- "+ New trip" modal (name/destination/start/end-date) → POST `/api/trips`
- "🤖 Generate from URL" entry point to ingest flow
- "🗑 Delete current trip" with confirm dialog
- `localStorage.tc_trip_id` honoured by `loadTrip`; falls back to first trip
- Trip overview card refactored to render dynamically from TRIP (was hardcoded Budapest text)
- No-trip empty-state with "+ New" + "🤖 Generate" buttons
- E2E verified: switching between two trips updates overview, bookings, days, street-food in one render pass

---

### 4. S3/R2 image upload — **1 day** ✅ DONE

**Why fourth:** local volume works for solo demos but breaks on multi-instance deploy. Cheap swap.

**Scope:**
- `boto3` client (S3-compatible — works for AWS/R2/Backblaze)
- New `app/storage.py`: `upload_bytes(key, content_type) -> public_url` (or presigned GET)
- `/api/stops/:id/photos` writes to bucket instead of local dir
- Frontend uses returned URL directly (already does)
- Env: `S3_BUCKET, S3_ENDPOINT_URL, S3_ACCESS_KEY, S3_SECRET_KEY, S3_PUBLIC_URL_BASE`
- Fallback: if env vars missing → keep local volume (dev mode)

**Risk:** low. `Photo.path` stays a URL; consumers don't care where it lives.

**Migration impact:** none.

**Shipped:**
- `app/storage.py` — single `upload(stream, filename, content_type) → URL` interface
- Local backend (default) writes to `UPLOAD_DIR`, returns `/uploads/{uuid}.ext`
- S3 backend when `S3_BUCKET` env set: `boto3.upload_fileobj` with `ContentType`; returns `S3_PUBLIC_URL_BASE/{key}` if set, else 1h presigned GET
- Compatible with AWS S3 / Cloudflare R2 / Backblaze B2 / any S3 API via `S3_ENDPOINT_URL`
- `routes/tour.py` photo upload now routes through `storage.upload()`; response includes `backend: "local"|"s3"` for debugging
- E2E verified: multipart upload returns persisted URL with `backend: "local"`; S3 path inert without env (no behavior change for current users)
- New env: `S3_BUCKET, S3_ENDPOINT_URL, S3_REGION, S3_ACCESS_KEY, S3_SECRET_KEY, S3_PUBLIC_URL_BASE`

---

### 5. Tour-planner ingest (real) — **5–8 days** 🏔 biggest — Phase 5A (sync) ✅ DONE

**Why last:** depends on #1 (job table migration), #3 (UI to see new trip).

**Scope:**

Phase A — sync MVP (~2 days):
- `/api/plan/ingest` runs the tour-planner skill **synchronously** in-process via subprocess to Claude Code SDK (or direct Anthropic API call)
- Returns Trip ID once parsing done (~30-90s blocking)
- Acceptable for first 100 users

Phase B — async (~3-5 days, only if volume needs):
- Job table: `id, status, payload_json, result_trip_id, error, started_at, finished_at, owner_id`
- Worker process (`arq` for FastAPI ergonomics, or RQ + Redis)
- `/api/plan/ingest` enqueues, returns job_id; `/api/plan/jobs/:id` polls status
- Frontend: progress UI ("⏳ ingesting playlist… 4/50 videos processed")
- Webhook on done → in-app notification

Output parsing (both phases):
- Tour-planner skill returns Markdown itinerary + companion docs + route URLs
- Parser: split by `## Day N` headers, extract stops via the per-stop block schema (address, hours, etc.)
- Map → `Trip/Day/Stop/Booking/RouteAsset` rows

LLM cost guardrails:
- Per-user monthly cap (e.g., 10 trips/mo on free tier)
- Cache by `(source_url_hash)` → reuse output across users for same playlist (~5min Anthropic prompt cache hit anyway)

**Risk:** highest. Tour-planner skill is non-deterministic; output format may drift; LLM API costs.

**Mitigation:** integration tests with frozen playlist URL; fallback to "manual create" if parser fails.

**Migration impact:** new `ingest_jobs` table.

**Shipped (Phase 5A — sync MVP):**
- `IngestJob(id, owner_id, status, payload_json, result_trip_id, error, started_at, finished_at, created_at)` + Alembic `38cc69732ee9_add_ingest_jobs`
- `app/planner.py` — calls Anthropic with focused JSON-schema system prompt; deterministic mock when `ANTHROPIC_API_KEY` unset (so dev/CI works without keys)
- `routes/plan.py` rewrote `/api/plan/ingest`: records job → runs planner sync → persists `Trip + Bookings + Day + Stop` rows → returns `{job_id, trip_id, status, message, backend}`
- `GET /api/plan/jobs/{id}` for audit
- Rate-limited: `10/hour` per IP via slowapi
- Frontend ingest modal: destination/days/style/source-URL inputs with loading state; on success closes modal, switches to new trip, snackbar
- E2E verified: 2-day Lisbon mock generation completes <10ms, persists with bookings + 4 stops/day; auto-switch works
- New env: `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` (default `claude-haiku-4-5-20251001`), `INGEST_MAX_SECONDS`, `RATE_INGEST`

**Phase 5B (async) deferred** until sync timeouts become a real problem:
- Job table already supports the workflow; add `arq` worker + `/api/plan/jobs/{id}` polling (already exists) once 30s+ ingests start hitting Cloudflare/Fly request timeouts
- Frontend would change from blocking submit → enqueue + poll loop with progress messages

---

## Beyond the 5 — also needed before public launch

| Item | Time | Notes |
|---|---|---|
| Sentry / error tracking | 0.5d | One env var, FastAPI integration |
| Structured logging + request IDs | 0.5d | structlog or stdlib json formatter |
| Health/readiness endpoints split | 0.25d | `/livez` for k8s, `/readyz` checks DB |
| HTTPS deploy (Fly.io / Render) | 1d | Dockerfile already prod-ready |
| ToS + Privacy Policy stubs | 0.5d | Required for OAuth, app stores, GDPR |
| Backup strategy for Postgres | 0.5d | Fly volumes auto-snapshot; verify restore |
| GitHub Actions CI (test + build) | 0.5d | Lint + type-check + run uvicorn smoke |

## Total estimate

- **Critical-path MVP** (1+2+3+4+5A): ~6 days solo
- **Public-launch ready** (+ async + observability + deploy): ~12 days

## Recommended order

`1 → 2 → 3 → 5A → 4 → 5B`

Reason: sync ingest gets a working ingest demo to users before you invest in queue infra; auth hardening before ingest because LLM calls cost money so you need rate-limited accounts first.
