# Athena Frontend Prototype

React + TypeScript frontend for the case management prototype.

## Features Implemented

- Role-based navigation (`coordinator`, `agent`, `supervisor`)
- Offline outbox storage using IndexedDB (`idb`)
- Pull/push sync helpers with retry-safe status handling
- PWA manifest + service worker registration for installable/offline shell behavior
- Quality hint and warning banners in agent workflow
- Supervisor metrics and timeline views with API fallbacks

## Run

1. `npm install`
2. `npm run dev`

The app uses fallback demo payloads when the backend is unavailable, so screens remain usable during early integration.
