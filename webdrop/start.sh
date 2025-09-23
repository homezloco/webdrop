#!/usr/bin/env bash
set -euo pipefail

# WebDrop start script
# - Kills any processes bound to the chosen frontend/backend ports
# - Starts Next.js (frontend) on FRONTEND_PORT (default 3010)
# - Starts signaling server (backend) on BACKEND_PORT (default 8020)
# - Exports NEXT_PUBLIC_SIGNALING_URL to point the frontend at the backend
#
# Usage:
#   bash start.sh
#   FRONTEND_PORT=4000 BACKEND_PORT=9000 bash start.sh

FRONTEND_PORT=${FRONTEND_PORT:-3010}
BACKEND_PORT=${BACKEND_PORT:-8020}

kill_port() {
  local port="$1"
  echo "[start.sh] Ensuring port ${port} is free..."
  # Try fuser (common on Linux/WSL)
  if command -v fuser >/dev/null 2>&1; then
    fuser -k -n tcp "$port" >/dev/null 2>&1 || true
  fi
  # Try lsof (common on macOS/Linux)
  if command -v lsof >/dev/null 2>&1; then
    local pids
    pids=$(lsof -ti tcp:"$port" || true)
    if [ -n "$pids" ]; then
      echo "$pids" | xargs -r kill -9 || true
    fi
  fi
  # Try ss (modern alternative to netstat)
  if command -v ss >/dev/null 2>&1; then
    local pids
    pids=$(ss -lptn "sport = :$port" 2>/dev/null | awk 'NR>1{print $NF}' | sed 's/,//g;s/pid=//g' | tr -d '"' || true)
    if [ -n "$pids" ]; then
      echo "$pids" | xargs -r kill -9 || true
    fi
  fi
}

kill_port "$FRONTEND_PORT"
kill_port "$BACKEND_PORT"

# Point frontend to backend signaling URL
export PORT="$BACKEND_PORT"
export NEXT_PUBLIC_SIGNALING_URL="ws://localhost:${BACKEND_PORT}/ws"

# Optional: load additional envs from .env.local if present
if [ -f ".env.local" ]; then
  # shellcheck disable=SC2046
  export $(grep -v '^#' .env.local | xargs -I {} echo {}) || true
fi

# Start both services using local dev dependencies
# - Next.js on FRONTEND_PORT
# - Signaling server on BACKEND_PORT (PORT env used inside server/signaling.ts)
echo "[start.sh] Starting frontend on :${FRONTEND_PORT} and backend on :${BACKEND_PORT}..."

npx concurrently -k \
  "npx next dev -p ${FRONTEND_PORT}" \
  "npx ts-node server/signaling.ts"
