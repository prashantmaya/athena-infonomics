# Assumptions

## Database
- The app runs out-of-the-box with SQLite (`backend/db.sqlite3`) as the default backend database.
- No manual database provisioning is required for basic local runs (`python manage.py migrate` is enough).
- PostgreSQL support is optional for higher-fidelity environments and can be enabled via `POSTGRES_*` environment variables in backend settings.

## Product and Roles

- A user belongs to one primary `program_id` during the prototype
- Role model is intentionally lightweight: `coordinator`, `agent`, `supervisor`
- Coordinators create and assign cases; agents log field activities; supervisors review quality and KPIs
- For UI simplicity, only one active agent assignment is allowed per case.

## Data and Domain

- `CaseTypeDefinition` validation rules are configurable JSON with a bounded schema
- Activities are append-only; edits are represented as subsequent corrective activities
- External events are immutable records once accepted

## Sync and Offline

- Agents may stay offline for multiple days and then sync in bulk
- Client submits stable UUID-like `client_activity_id` for idempotency
- Backend returns per-item sync result to support partial success UX
- Last-write-wins is avoided for activities; append-only plus review flags is preferred

## Time and Ordering

- Device time can be skewed; server receive time is trusted for canonical ordering
- API stores both `client_reported_at` and `server_received_at`

## Non-functional Constraints

- SQLite is used as the default source of truth for local prototype/demo runs; PostgreSQL is an optional deployment target.
- Background workers are optional; synchronous writes are acceptable for small demo loads
- Dashboard freshness target is near-real-time for demo scenarios (sub-minute acceptable)

## Scope Boundaries

- No full IAM/SSO integration in prototype
- No geospatial routing optimization in this iteration
- No real PHI handling assumptions; use synthetic data only

## Webhook Simulations
- The app includes a webhook simulation helper that performs online POST calls to emulate external partner events.

## Delivery Process
- Commit hygiene may vary across iterations; final submission should group commits by feature/documentation/test area when possible.