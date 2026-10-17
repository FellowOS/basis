"""Ordered SQLite schema migrations for Basis."""

from __future__ import annotations

import hashlib
import re
import sqlite3
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

_MIGRATION_NAME = re.compile(r"^(\d+)_.+\.sql$")


class MigrationError(Exception):
    """Schema migration failed or drifted from the applied checksum."""

    def __init__(self, message: str) -> None:
        self.message = message
        super().__init__(message)


@dataclass(frozen=True)
class Migration:
    version: int
    name: str
    sql: str
    checksum: str


def _checksum(sql: str) -> str:
    return hashlib.sha256(sql.encode("utf-8")).hexdigest()


def _migration_files() -> list[tuple[int, str, str]]:
    root = Path(__file__).resolve().parent / "migrations"
    if not root.is_dir():
        return []
    items: list[tuple[int, str, str]] = []
    for path in sorted(root.glob("*.sql")):
        match = _MIGRATION_NAME.match(path.name)
        if not match:
            continue
        version = int(match.group(1))
        sql = path.read_text(encoding="utf-8")
        items.append((version, path.name, sql))
    items.sort(key=lambda item: item[0])
    return items


def load_migrations() -> list[Migration]:
    loaded: list[Migration] = []
    for version, name, sql in _migration_files():
        loaded.append(Migration(version=version, name=name, sql=sql, checksum=_checksum(sql)))
    return loaded


def _ensure_migrations_table(conn: sqlite3.Connection) -> None:
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            checksum TEXT NOT NULL,
            applied_at TEXT NOT NULL
        )
        """
    )


def _applied(conn: sqlite3.Connection) -> dict[int, tuple[str, str]]:
    rows = conn.execute(
        "SELECT version, name, checksum FROM schema_migrations ORDER BY version"
    ).fetchall()
    return {int(row[0]): (row[1], row[2]) for row in rows}


def run_migrations(conn: sqlite3.Connection) -> list[int]:
    """Apply pending migrations. Returns versions applied in this call."""
    migrations = load_migrations()
    if not migrations:
        raise MigrationError("No migration files found")

    _ensure_migrations_table(conn)
    applied = _applied(conn)
    newly_applied: list[int] = []

    for migration in migrations:
        existing = applied.get(migration.version)
        if existing is not None:
            _, recorded_checksum = existing
            if recorded_checksum != migration.checksum:
                raise MigrationError(
                    f"Migration {migration.version} ({migration.name}) checksum mismatch. "
                    "Applied migration files must not be edited after release."
                )
            continue

        for prior in migrations:
            if prior.version >= migration.version:
                break
            if prior.version not in applied and prior.version not in newly_applied:
                raise MigrationError(
                    f"Migration {migration.version} pending but {prior.version} is not applied"
                )

        try:
            conn.executescript(migration.sql)
            conn.execute(
                """
                INSERT INTO schema_migrations(version, name, checksum, applied_at)
                VALUES (?, ?, ?, ?)
                """,
                (
                    migration.version,
                    migration.name,
                    migration.checksum,
                    datetime.now(timezone.utc).isoformat(),
                ),
            )
            conn.commit()
        except sqlite3.Error as exc:
            conn.rollback()
            raise MigrationError(
                f"Failed applying migration {migration.version} ({migration.name}): {exc}"
            ) from exc
        newly_applied.append(migration.version)
        applied[migration.version] = (migration.name, migration.checksum)

    from basis.admin.org_backfill import ensure_organization_backfill

    ensure_organization_backfill(conn)

    return newly_applied


def package_migrations_dir() -> Path:
    """Return the migrations directory (for tests and tooling)."""
    return Path(__file__).resolve().parent / "migrations"
