# Demo Walkthrough Script

## Goal

Show a complete coordinator -> agent -> supervisor flow with offline-safe sync and idempotent external ingestion.

## Setup

Option A (Docker, full stack):

1. `docker compose up --build`
2. Open [http://localhost:5173](http://localhost:5173)

Option B (local dev):

1. Run bootstrap: `./scripts/bootstrap.sh`
2. Start backend: `cd backend && . .venv/bin/activate && python manage.py runserver`
3. Start frontend: `cd frontend && npm run dev`
4. Open [http://localhost:5173](http://localhost:5173)

## Step-by-Step Flow

1. **Coordinator creates a case**
  - Go to Coordinator/Cases tab
  - Click "Create case"
  - Fill in title, select program (1), case type (e.g. health_followup), priority
  - Case appears in the list
2. **Coordinator assigns the case**
  - Click "Assign" next to the case
  - Select the agent from the available list of agents
  - Assigned column updates
3. **Agent pulls assigned cases**
  - Go to Agent tab
  - Set Program ID and Agent ID to match from the available dropdown.
  - Cases appear in "Assigned cases"
4. **Agent records activity offline**
  - Click "Register Form Entry" and fill the form and required fields
  - Click "Save form"
  - Entry appears in Sync center with status "Pending"
  - (Optional: use DevTools Network "Offline" to simulate offline)
5. **Agent sync push**
  - Click "Sync Forms"
  - Pending items sync to server and disappear from outbox
  - Retry same sync: duplicates are deduplicated (idempotent)
6. **External system sends event** (curl)
  - Simulate WebHook calls, Navigate to Dashboard tab and click "Simulate webhook" and fill the details in the modal or run the following curl command.
  - Repeat with same `external_event_id`: duplicate accepted, no new record
7. **Supervisor timeline**
  - Go to Supervisor/Dashboard tab
  - Select a Program and case from the available dropdowns.
  - See merged timeline (activities + external events, ordered by server time)
8. **Supervisor dashboard**
  - View metric cards: total cases, active cases, pending sync items, quality score
  - Quality issues listed below

## Expected Messages to Call Out

- Offline entries are not lost during connectivity loss
- Sync is safe under retries and flaky networks
- Duplicate webhooks do not create duplicate timeline entries
- Data anomalies produce warnings without blocking submissions

