#!/usr/bin/env bash
# Restore PostgreSQL dump + optional blobs (destructive). Requires SEMA_RESTORE_CONFIRM=yes.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DATA_DIR="${SEMA_DATA_DIR:-$ROOT/data}"

if [[ $# -lt 1 ]]; then
  echo "Usage: SEMA_RESTORE_CONFIRM=yes $0 <sema-pg.dump> [sema-blobs.tar.gz]" >&2
  exit 1
fi

DUMP="$1"
BLOBS_TAR="${2:-}"

if [[ "${SEMA_RESTORE_CONFIRM:-}" != "yes" ]]; then
  echo "Refusing to restore without SEMA_RESTORE_CONFIRM=yes" >&2
  exit 1
fi

if [[ ! -f "$DUMP" ]]; then
  echo "Dump not found: $DUMP" >&2
  exit 1
fi

if [[ -z "${SEMA_DATABASE_URL:-}" && -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

if [[ -z "${SEMA_DATABASE_URL:-}" ]] || [[ "${SEMA_DATABASE_URL}" != postgres* ]]; then
  echo "Set SEMA_DATABASE_URL to a postgresql:// connection string." >&2
  exit 1
fi

if ! command -v pg_restore >/dev/null 2>&1; then
  echo "pg_restore not found; install PostgreSQL client tools." >&2
  exit 1
fi

echo "Restoring database from $DUMP into $SEMA_DATABASE_URL"
pg_restore --clean --if-exists --no-owner --no-acl -d "$SEMA_DATABASE_URL" "$DUMP"

if [[ -n "$BLOBS_TAR" ]]; then
  if [[ ! -f "$BLOBS_TAR" ]]; then
    echo "Blobs archive not found: $BLOBS_TAR" >&2
    exit 1
  fi
  mkdir -p "$DATA_DIR"
  tar -xzf "$BLOBS_TAR" -C "$DATA_DIR"
  echo "Extracted blobs into $DATA_DIR"
fi

echo "Done. Start the API and POST /api/kbs/{kb_id}/graph/rebuild per KB if graphs were not restored."
