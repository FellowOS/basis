import sqlite3
from pathlib import Path

import pytest

from basis.platform.admin.errors import AdminError
from basis.platform.admin.migrations import MigrationError, load_migrations, run_migrations
from basis.platform.admin.store import AdminStore


def _expected_migration_versions() -> list[int]:
    return [m.version for m in load_migrations()]


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
    db_path = tmp_path / "basis.db"
    store = AdminStore(db_path)
    versions = {
        row[0]
        for row in store._conn.execute("SELECT version FROM schema_migrations ORDER BY version")
    }
    store.close()
    assert versions == set(_expected_migration_versions())

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
    assert "kb_connector_policies" in tables
    assert "kb_connections" in tables
    assert "kb_oauth_configs" in tables
    assert "kb_connector_runs" in tables
    assert "source_table_mappings" in tables
    assert "entity_external_refs" in tables
    assert "entity_sync_outbox" in tables
    assert "kb_governance_configs" in tables


def test_migrations_are_idempotent(tmp_path: Path) -> None:
    db_path = tmp_path / "basis.db"
    conn = sqlite3.connect(db_path)
    first = run_migrations(conn)
    second = run_migrations(conn)
    conn.close()
    assert first == _expected_migration_versions()
    assert second == []


def test_legacy_database_upgrades_without_data_loss(tmp_path: Path) -> None:
    db_path = tmp_path / "basis.db"
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
    assert versions == _expected_migration_versions()
    store.close()


def test_checksum_mismatch_fails(tmp_path: Path) -> None:
    db_path = tmp_path / "basis.db"
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
    versions = [m.version for m in migrations]
    assert versions == sorted(versions)
    assert versions and versions[0] == 1
    assert versions == list(range(1, len(versions) + 1))
    assert migrations[0].checksum != migrations[1].checksum
