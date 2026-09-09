#!/usr/bin/env bash

set -Eeuo pipefail

PROJECT_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$PROJECT_ROOT/tella_backend"
FRONTEND_DIR="$PROJECT_ROOT/admin-platform"

if [[ -n "${PYTHON_BIN:-}" ]]; then
  PYTHON="$PYTHON_BIN"
elif [[ -x "$PROJECT_ROOT/.native-venv/bin/python" ]]; then
  PYTHON="$PROJECT_ROOT/.native-venv/bin/python"
elif [[ -x "$PROJECT_ROOT/.venv/bin/python" ]]; then
  PYTHON="$PROJECT_ROOT/.venv/bin/python"
elif [[ -x "$PROJECT_ROOT/venv/bin/python" ]]; then
  PYTHON="$PROJECT_ROOT/venv/bin/python"
else
  echo "Error: no project Python environment was found." >&2
  echo "Set PYTHON_BIN to the Python executable that has the backend dependencies installed." >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "Error: npm is not installed or is not on PATH." >&2
  exit 1
fi

if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
  echo "Error: frontend dependencies are missing. Run 'npm install' in $FRONTEND_DIR first." >&2
  exit 1
fi

export DJANGO_API_URL="${DJANGO_API_URL:-http://127.0.0.1:8000/api/v1}"
export ADMIN_SECURE_COOKIES="${ADMIN_SECURE_COOKIES:-false}"

BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
  trap - EXIT INT TERM

  echo
  echo "Stopping backend and frontend..."

  if [[ -n "$BACKEND_PID" ]]; then
    kill -TERM -- "-$BACKEND_PID" 2>/dev/null || true
  fi

  if [[ -n "$FRONTEND_PID" ]]; then
    kill -TERM -- "-$FRONTEND_PID" 2>/dev/null || true
  fi

  wait "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
}

trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

echo "Starting Django backend at http://127.0.0.1:8000/api/v1/"
(
  cd "$BACKEND_DIR"
  exec setsid "$PYTHON" manage.py runserver 0.0.0.0:8000
) &
BACKEND_PID=$!

echo "Starting Next.js frontend at http://localhost:3000/"
(
  cd "$FRONTEND_DIR"
  exec setsid npm run dev
) &
FRONTEND_PID=$!

echo "Both services are starting. Press Ctrl+C to stop them."

set +e
wait -n "$BACKEND_PID" "$FRONTEND_PID"
STATUS=$?
set -e

echo "One service exited; shutting down the other."
exit "$STATUS"
