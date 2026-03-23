# Athena Backend

Django + DRF service for case management, offline sync, and idempotent external ingest.

## Setup

1. Create and activate a virtual environment.
2. Install dependencies:
   - `pip install -r requirements.txt`
3. Copy `.env.example` to `.env` (optional for SQLite dev mode).
4. Run migrations:
   - `python manage.py migrate`
5. Load demo seed data:
   - `python manage.py seed_demo_data`
6. Start API server:
   - `python manage.py runserver`

## Docker

From repository root:

- `docker compose up --build`

This backend container runs migrations and seeds demo data on startup.

## Project Layout

- `config/` - Django project configuration
- `core/` - single Django app containing models, serializers, views, services, URLs, tests, and seed command

## API Surface

The API is available under both `/api/` and `/api/v1/`.

- `GET/POST /api/v1/cases/` - list/create cases
- `GET/PUT /api/v1/cases/{case_id}/` - case detail/update with conflict flagging
- `POST /api/v1/cases/{case_id}/assign/` - assign case to an agent
- `GET /api/v1/cases/{case_id}/timeline/` - merged activities + external events
- `POST /api/v1/sync/push/` - offline activity batch upload (idempotent)
- `GET /api/v1/sync/pull/` - pull assigned case updates with updates token/cursor
- `POST /api/v1/external-events/ingest/` - idempotent external event ingest
- `GET /api/v1/dashboard/metrics/?program_id=<id>` - supervisor dashboard metrics

## Validation

- Run tests: `python manage.py test`

