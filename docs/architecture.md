# Architecture Notes

## Goals

- Support reliable field-agent data capture in low-connectivity environments
- Preserve auditability and timeline correctness under retries and duplicate submissions
- Expose fast supervisor dashboards without heavy read-time joins

## Logical Components

- **Coordinator UI (React):** creates and assigns cases by `program_id`
- **Agent PWA (React + IndexedDB planned):** stores assignments locally, records activities, syncs via outbox
- **Supervisor UI (React):** reviews timeline, quality issues, and KPI cards
- **DRF Backend:** enforces program scoping, idempotency, conflict handling, and aggregation APIs
- **Database layer:** SQLite by default for local out-of-box runs, PostgreSQL for Docker and higher-fidelity environments

## Core Data Model (Target)

- `Program`
- `UserProfile` with role (`coordinator`, `agent`, `supervisor`)
- `Agent`, `Supervisor` (light role extension)
- `CaseTypeDefinition` (dynamic schema and validation rules)
- `Case`, `CaseAssignment`
- `Activity` (unique `program + agent + client_activity_id`)
- `ExternalEvent` (unique `source + external_event_id`)
- `TimelineEvent` (materialized option) or merged query strategy
- `QualityIssue`
- `SyncSession` / `SyncState`

## Offline and Sync Strategy

- Activity creation is local-first with durable outbox entries
- Push API accepts batch payloads and idempotency keys
- Server applies append-only inserts for activities/events
- Pull API returns assigned cases + incremental updates token
- UI states: `pending`, `syncing`, `synced`, `failed`

## Conflict and Ordering Rules

- Case metadata updates are server-authoritative using `version`
- Conflicting offline metadata edits become non-destructive review flags
- Device clock values are stored but not trusted for final ordering
- Timeline ordering uses server receive sequence + deterministic tie-break

## Security and Multi-tenancy

- Every business query filtered by `program_id`
- Endpoint permission checks by role + program membership
- Webhook ingestion scoped by source credentials and program mapping

## Performance Notes

- Write-time or periodic lightweight KPI aggregates for dashboard cards
- Indexes required for:
  - `Activity(program_id, agent_id, client_activity_id)`
  - `ExternalEvent(source, external_event_id)`
  - `Case(program_id, status, updated_at)`
  - `QualityIssue(program_id, status, created_at)`

## Test Priorities

- Retry-safe sync push (same batch posted multiple times)
- Duplicate external webhook ingestion
- Timeline merge deterministic ordering
- Data quality flags that warn but do not block submission

