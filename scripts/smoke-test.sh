#!/usr/bin/env bash
set -euo pipefail

FRONTEND_URL="${FRONTEND_URL:-http://localhost:5175}"
BACKEND_URL="${BACKEND_URL:-http://localhost:5000}"

echo "Starting smoke tests"

echo "- Checking backend health at ${BACKEND_URL}/api/health"
backend_resp=$(curl -sS "$BACKEND_URL/api/health" || true)
if echo "$backend_resp" | grep -q "Server is running normally"; then
  echo "  ✔ backend healthy"
else
  echo "  ✖ backend health check failed: $backend_resp"
  exit 1
fi

echo "- Checking frontend root at ${FRONTEND_URL}/"
frontend_status=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL/" || true)
if [ "$frontend_status" -eq 200 ]; then
  echo "  ✔ frontend served (200)"
else
  echo "  ✖ frontend check returned HTTP $frontend_status"
  exit 1
fi

echo "- Verifying protected endpoint /api/boards requires auth"
protected_status=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/api/boards" || true)
if [ "$protected_status" -eq 401 ] || [ "$protected_status" -eq 403 ]; then
  echo "  ✔ protected endpoint returned $protected_status as expected"
else
  echo "  ✖ protected endpoint returned $protected_status (expected 401 or 403)"
  exit 1
fi

# Optional E2E (disabled by default). Enable by setting RUN_E2E=1 in env.
if [ "${RUN_E2E:-0}" = "1" ]; then
  echo "- Running optional E2E flow (register -> login -> create -> delete)"
  rand=$(date +%s)
  email="smoketest+$rand@example.com"
  password="P@ssw0rd${rand}"

  echo "  -> registering admin user $email"
  reg=$(curl -sS -X POST "$BACKEND_URL/api/auth/register" -H 'Content-Type: application/json' -d "{\"name\":\"Smoke Tester\",\"email\":\"$email\",\"password\":\"$password\",\"role\":\"admin\"}")
  token=$(echo "$reg" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p') || true
  if [ -z "$token" ]; then
    echo "  ✖ registration/login failed: $reg"
    exit 1
  fi

  echo "  -> creating board"
  create=$(curl -sS -X POST "$BACKEND_URL/api/boards" -H "Authorization: Bearer $token" -H 'Content-Type: application/json' -d '{"title":"Smoke Test Board","description":"Created by smoke test"}')
  board_id=$(echo "$create" | sed -n 's/.*"_id":"\([^"]*\)".*/\1/p') || true
  if [ -z "$board_id" ]; then
    echo "  ✖ board creation failed: $create"
    exit 1
  fi

  echo "  -> deleting board $board_id"
  del_status=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$BACKEND_URL/api/boards/$board_id" -H "Authorization: Bearer $token") || true
  if [ "$del_status" -eq 200 ]; then
    echo "  ✔ E2E create/delete succeeded"
  else
    echo "  ✖ E2E delete returned $del_status"
    exit 1
  fi
fi

echo "All smoke tests passed ✔"
