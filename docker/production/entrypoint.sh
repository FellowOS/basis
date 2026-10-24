#!/bin/sh
set -e

export BASIS_API_URL="${BASIS_API_URL:-http://127.0.0.1:${BASIS_PORT:-8090}}"

cd /app
uv run basis &
api_pid=$!

cleanup() {
  kill -TERM "$api_pid" 2>/dev/null || true
  wait "$api_pid" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

attempt=0
until curl -sf "http://127.0.0.1:${BASIS_PORT:-8090}/health" >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 120 ]; then
    echo "Basis API did not become ready in time" >&2
    exit 1
  fi
  sleep 1
done

cd /app/web
exec node --experimental-strip-types server/prod.ts
