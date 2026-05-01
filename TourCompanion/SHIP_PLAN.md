# Ship Plan — closing the gaps

Plan to take Tour Companion from working-demo to production-ready. Sized + sequenced.

**Ship-ready bar:** real users can sign up, create a trip from a YouTube link, photos survive a server restart, no schema drift breaks them.

---

## Sequence (do in this order)

### 1. Alembic migrations — **0.5 day** ⚠ blocks everything else

**Why first:** every other gap adds tables/columns. Without Alembic, schema changes either lose data or require manual SQL.

**Scope:**
- `alembic init alembic`, point env.py at `app.db.Base` + `DATABASE_URL`
- Generate initial migration from current models (`alembic revision --autogenerate -m "init"`)
- Replace `Base.metadata.create_all(engine)` in lifespan with `alembic.command.upgrade(cfg, "head")`
- Doc workflow: `alembic revision --autogenerate -m msg` → review → commit
- Add `alembic upgrade head` to Dockerfile entrypoint + run_local.sh

**Risk:** low. Standard. SQLite quirks for ALTER but already working tables stay fine.

---

### 2. Rate limit + auth hardening — **1.5 days**

**Why second:** if anyone gets the URL before ingest works, brute-force on /signup or /login is open. Cheap to add now.

**Scope:**
- `slowapi` middleware: 5/min on `/auth/login`, 3/hr on `/auth/signup`, 100/min default per-IP
- Email verification: `email_verified_at` column, signup sends a magic-link token (24h), `/auth/verify` flips flag, login allows un-verified for 7-day grace
- Password reset: `/auth/forgot` issues short-lived token, `/auth/reset` consumes
- Email transport: Resend or Postmark (one API key, one template). Dev = console-print.
- Frontend: verify-pending banner + reset form

**Risk:** medium. Email deliverability is the hassle. Use Resend free tier (3k/mo).

**Migration impact:** needs Alembic (#1) — adds `email_verified_at`, `password_reset_tokens` table.

---

### 3. Multi-trip UI — **1 day**

**Why third:** ingest (#5) creates new trips. Without a picker, user can't see them.

**Scope:**
- Header dropdown: lists `/api/trips`, switches active by setting `localStorage.tc_trip_id`, reloads
- "+ New trip" button → modal with `name, destination, start_date, end_date` form → POST `/api/trips`
- "Delete trip" in trip menu (already in API)
- `loadTrip()` honours `tc_trip_id`; falls back to first trip

**Risk:** low. All API endpoints already exist.

**Migration impact:** none.

---

### 4. S3/R2 image upload — **1 day**

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

---

### 5. Tour-planner ingest (real) — **5–8 days** 🏔 biggest

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
