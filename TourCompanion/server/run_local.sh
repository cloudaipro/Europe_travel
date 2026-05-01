#!/usr/bin/env bash
# Run Tour Companion API locally with SQLite (no Docker).
# Idempotent: creates venv + installs deps on first run.

set -euo pipefail

cd "$(dirname "$0")"

VENV=".venv"
PORT="${PORT:-8000}"
HOST="${HOST:-127.0.0.1}"

if [ ! -d "$VENV" ]; then
  echo "→ creating venv"
  python3 -m venv "$VENV"
fi

# shellcheck disable=SC1091
source "$VENV/bin/activate"

# Install/update deps if requirements.txt is newer than the marker
MARKER="$VENV/.deps_installed"
if [ ! -f "$MARKER" ] || [ requirements.txt -nt "$MARKER" ]; then
  echo "→ installing requirements"
  pip install --quiet --upgrade pip
  pip install --quiet -r requirements.txt
  pip install --quiet 'bcrypt==4.0.1'
  touch "$MARKER"
fi

mkdir -p uploads

export DATABASE_URL="${DATABASE_URL:-sqlite:///./tour.db}"
export UPLOAD_DIR="${UPLOAD_DIR:-./uploads}"
export JWT_SECRET="${JWT_SECRET:-dev-secret-change-me}"
export SEED_ON_BOOT="${SEED_ON_BOOT:-true}"
export CORS_ORIGINS="${CORS_ORIGINS:-*}"

echo "→ http://$HOST:$PORT/      (login: demo@tourcompanion.app / demo1234)"
echo "→ http://$HOST:$PORT/docs  (API docs)"
exec uvicorn app.main:app --host "$HOST" --port "$PORT" --reload
