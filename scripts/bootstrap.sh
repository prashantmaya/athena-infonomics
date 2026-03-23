#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Athena bootstrap starting..."
echo "Workspace: ${ROOT_DIR}"

# Frontend
if [ -d "${ROOT_DIR}/frontend" ]; then
  echo "Installing frontend dependencies..."
  cd "${ROOT_DIR}/frontend"
  npm install
  echo "Frontend ready. Run: cd frontend && npm run dev"
  cd "${ROOT_DIR}"
else
  echo "frontend directory not found; skipping frontend bootstrap."
fi

# Backend
if [ -d "${ROOT_DIR}/backend" ]; then
  echo ""
  echo "Backend setup..."
  cd "${ROOT_DIR}/backend"
  if [ -d ".venv" ]; then
    echo "Activating existing virtualenv..."
    # shellcheck source=/dev/null
    . .venv/bin/activate
  else
    echo "Creating virtualenv..."
    python3 -m venv .venv
    # shellcheck source=/dev/null
    . .venv/bin/activate
  fi
  pip install -q -r requirements.txt
  echo "Running migrations..."
  python manage.py migrate --noinput
  echo "Loading seed data..."
  python manage.py seed_demo_data --file fixtures/seed_demo_data.json 2>/dev/null || true
  cd "${ROOT_DIR}"
  echo "Backend ready. Run: cd backend && . .venv/bin/activate && python manage.py runserver"
else
  echo "backend directory not found; skipping."
fi

echo ""
echo "Bootstrap complete. See README.md for run instructions."
