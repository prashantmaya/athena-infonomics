# Athena Case Management Prototype

Athena is an offline-first case management system for field operations with:

- **Django + DRF backend**: Idempotent sync, external event ingestion, data quality checks, dashboard metrics
- **React frontend**: Coordinator, field agent, and supervisor workflows
- **Offline-first**: IndexedDB outbox, local activity recording, sync when online

## Quick Start

### Option 0: Docker Compose (full stack)

```bash
docker compose up --build
```

This starts:

- PostgreSQL on `localhost:5432`
- Django backend on `http://localhost:8000`
- React frontend on `http://localhost:5173`

Backend migrations and demo seed load run automatically on container startup.

Useful commands:

```bash
# Stop containers
docker compose down

# Stop and remove Postgres volume (clean DB reset)
docker compose down -v
```

### Option 1: Bootstrap Script (recommended)

```bash
chmod +x scripts/bootstrap.sh
./scripts/bootstrap.sh
```

This installs frontend deps, creates backend venv, runs migrations, and loads seed data.

### Option 2: Manual Setup

**Backend:**

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_demo_data --file fixtures/seed_demo_data.json
python manage.py runserver
```

**Frontend:**

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 (frontend) and http://localhost:8000 (API).

### Environment

- Backend uses SQLite by default. Set `POSTGRES_DB`, `POSTGRES_USER`, etc. for PostgreSQL.
- Frontend `VITE_API_BASE_URL` defaults to `http://localhost:8000`.
- Docker Compose uses PostgreSQL by default via service `db`.

## Project Structure

- `backend/` - Django project, DRF APIs, models, sync logic, tests
- `frontend/` - React + Vite app, IndexedDB offline storage, PWA-capable
- `docs/` - Architecture, assumptions, API docs, demo walkthrough
- `scripts/` - Setup/bootstrap helpers
- `PHASE_HISTORY.md` - Phase-by-phase implementation log

### Clean Root Layout

The root is intentionally minimal:

- `backend/`
- `frontend/`
- `docs/`
- `scripts/`
- `PHASE_HISTORY.md`
- `README.md`

## Deliverables

- `docs/architecture.md` - System design, sync strategy, conflict handling
- `docs/assumptions.md` - Scoping and simplifications
- `docs/openapi.yaml` - OpenAPI contract
- `docs/ai-usage.md` - AI assistance notes
- `docs/demo-walkthrough.md` - Demo flow for evaluation
- `docs/athena.postman_collection.json` - Postman collection for all api

