import sqlite3
from pathlib import Path

import pytest

from sema.admin.errors import AdminError
from sema.admin.migrations import MigrationError, load_migrations, run_migrations
from sema.admin.store import AdminStore


def _legacy_baseline_only(db_path: Path) -> None:
    """Database created before the migration runner existed."""
    conn = sqlite3.connect(db_path)
    conn.executescript(
        """
        CREATE TABLE users (
            id TEXT PRIMARY KEY,
            email TEXT NOT NULL,
            display_name TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            is_admin INTEGER NOT NULL DEFAULT 0,
            deactivated_at TEXT,
            created_at TEXT NOT NULL
        );
        CREATE TABLE tokens (
            token_hash TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        CREATE TABLE knowledge_bases (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            visibility TEXT NOT NULL,
            created_by TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        CREATE TABLE settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
        INSERT INTO settings(key, value) VALUES ('open_registration', 'true');
        """
    )
    conn.commit()
    conn.close()


def test_fresh_database_applies_all_migrations(tmp_path: Path) -> None:
    db_path = tmp_path / "sema.db"
    store = AdminStore(db_path)
    versions = {
        row[0]
        for row in store._conn.execute("SELECT version FROM schema_migrations ORDER BY version")
    }
    store.close()
    assert versions == {1, 2, 3, 4, 5, 6, 7, 8, 9}

    conn = sqlite3.connect(db_path)
    tables = {
        row[0]
        for row in conn.execute(
            "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"
        )
    }
    conn.close()
    assert "documents" in tables
    assert "statements" in tables
    assert "projection_state" in tables
    assert "kb_search_configs" in tables
    assert "chunks_fts" in tables


def test_migrations_are_idempotent(tmp_path: Path) -> None:
    db_path = tmp_path / "sema.db"
    conn = sqlite3.connect(db_path)
    first = run_migrations(conn)
    second = run_migrations(conn)
    conn.close()
    assert first == [1, 2, 3, 4, 5, 6, 7, 8, 9]
    assert second == []


def test_legacy_database_upgrades_without_data_loss(tmp_path: Path) -> None:
    db_path = tmp_path / "sema.db"
    _legacy_baseline_only(db_path)

    store = AdminStore(db_path)
    row = store._conn.execute(
        "SELECT value FROM settings WHERE key = 'open_registration'"
    ).fetchone()
    assert row is not None
    assert row[0] == "true"
    versions = [
        row[0]
        for row in store._conn.execute("SELECT version FROM schema_migrations ORDER BY version")
    ]
    assert versions == [1, 2, 3, 4, 5, 6, 7, 8, 9]
    store.close()


def test_checksum_mismatch_fails(tmp_path: Path) -> None:
    db_path = tmp_path / "sema.db"
    conn = sqlite3.connect(db_path)
    run_migrations(conn)
    conn.execute(
        "UPDATE schema_migrations SET checksum = 'tampered' WHERE version = 1"
    )
    conn.commit()
    conn.close()

    with pytest.raises(MigrationError, match="checksum mismatch"):
        run_migrations(sqlite3.connect(db_path))

    with pytest.raises(AdminError) as wrapped:
        AdminStore(db_path)
    assert wrapped.value.code == "migration_failed"


def test_load_migrations_sorted() -> None:
    migrations = load_migrations()
    assert [m.version for m in migrations] == [1, 2, 3, 4, 5, 6, 7, 8, 9]
    assert migrations[0].checksum != migrations[1].checksum
