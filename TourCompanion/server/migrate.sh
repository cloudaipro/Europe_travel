#!/usr/bin/env bash
# Wrapper around alembic that injects the same dev defaults as run_local.sh.
# Forwards all args.
#
# Examples:
#   ./migrate.sh revision --autogenerate -m "add email_verified_at"
#   ./migrate.sh upgrade head
#   ./migrate.sh downgrade -1
#   ./migrate.sh current
#   ./migrate.sh history

set -euo pipefail

cd "$(dirname "$0")"

if [ ! -d ".venv" ]; then
  echo "→ no .venv yet — run ./run_local.sh once first to bootstrap deps"
  exit 1
fi

export DATABASE_URL="${DATABASE_URL:-sqlite:///./tour.db}"

exec .venv/bin/alembic "$@"
