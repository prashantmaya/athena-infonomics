#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Running infornomics demo setup..."
"${ROOT_DIR}/scripts/bootstrap.sh"

echo ""
echo "Done."
echo "Backend: cd backend && . ../.venv/bin/activate && python manage.py runserver"
echo "Frontend: cd frontend && npm run dev"
