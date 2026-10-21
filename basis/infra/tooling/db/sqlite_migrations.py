"""SQLite schema bootstrap from packaged SQL (greenfield; no version table)."""

from __future__ import annotations

import re
import sqlite3
from pathlib import Path

_MIGRATION_NAME = re.compile(r"^(\d+)_.+\.sql$")

_LEDGER_SENTINEL_TABLE = "documents"


class MigrationError(Exception):
    """Schema bootstrap failed."""

    def __init__(self, message: str) -> None:
        self.message = message
        super().__init__(message)


def package_migrations_dir() -> Path:
    return Path(__file__).resolve().parent / "migrations"


def _bootstrap_sql_files() -> list[Path]:
    root = package_migrations_dir()
    if not root.is_dir():
        return []
    files: list[Path] = []
    for path in root.glob("*.sql"):
        if _MIGRATION_NAME.match(path.name):
            files.append(path)
    files.sort(key=lambda p: int(p.name[:4]))
    return files


def sqlite_schema_is_initialized(conn: sqlite3.Connection) -> bool:
    row = conn.execute(
        """
        SELECT 1 FROM sqlite_master
        WHERE type = 'table' AND name = ?
        LIMIT 1
        """,
        (_LEDGER_SENTINEL_TABLE,),
    ).fetchone()
    return row is not None


def ensure_sqlite_schema(conn: sqlite3.Connection) -> None:
    """Run packaged ``*.sql`` once when the ledger tables are absent."""
    conn.execute("PRAGMA foreign_keys = ON")
    if sqlite_schema_is_initialized(conn):
        from basis.infra.tooling.db.org_backfill import ensure_organization_backfill

        ensure_organization_backfill(conn)
        return

    files = _bootstrap_sql_files()
    if not files:
        raise MigrationError("No schema SQL files found")

    try:
        for path in files:
            conn.executescript(path.read_text(encoding="utf-8"))
        conn.commit()
    except sqlite3.Error as exc:
        conn.rollback()
        raise MigrationError(f"Failed applying schema ({path.name}): {exc}") from exc

    from basis.infra.tooling.db.org_backfill import ensure_organization_backfill

    ensure_organization_backfill(conn)


def run_migrations(conn: sqlite3.Connection) -> list[int]:
    """Compatibility shim: bootstrap schema if needed; returns ``[]``."""
    ensure_sqlite_schema(conn)
    return []


def load_migrations() -> list[Path]:
    """Return ordered bootstrap SQL paths (for tests and tooling)."""
    return _bootstrap_sql_files()
