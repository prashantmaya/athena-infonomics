#!/usr/bin/env bash

set -euo pipefail

BASE_URL="${1:-http://localhost:8000/api}"

echo "Running API smoke checks against: ${BASE_URL}"

echo ""
echo "[1] Health"
curl -sf "${BASE_URL}/health/" >/dev/null
echo "OK"

echo ""
echo "[2] Programs"
curl -sf "${BASE_URL}/programs/" >/dev/null
echo "OK"

echo ""
echo "[3] Case list"
curl -sf "${BASE_URL}/cases/" >/dev/null
echo "OK"

echo ""
echo "[4] Dashboard metrics"
curl -sf "${BASE_URL}/dashboard/metrics/?program_id=1" >/dev/null
echo "OK"

echo ""
echo "[5] External event ingest idempotency"
curl -sf -X POST "${BASE_URL}/external-events/ingest/" \
  -H "Content-Type: application/json" \
  -d '{"program_id":1,"case_id":1,"source":"smoke","external_event_id":"smoke-evt-1","event_type":"lab_result","payload":{"result":"NEG"}}' >/dev/null
curl -sf -X POST "${BASE_URL}/external-events/ingest/" \
  -H "Content-Type: application/json" \
  -d '{"program_id":1,"case_id":1,"source":"smoke","external_event_id":"smoke-evt-1","event_type":"lab_result","payload":{"result":"NEG"}}' >/dev/null
echo "OK"

echo ""
echo "Smoke checks passed."
