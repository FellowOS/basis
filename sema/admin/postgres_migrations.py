"""PostgreSQL equivalents of the canonical Sema schema migrations."""

from __future__ import annotations

import hashlib
import re
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.engine import Engine


def _migration_root() -> Path:
    return Path(__file__).resolve().parent / "migrations"


def _checksum(sql: str) -> str:
    return hashlib.sha256(sql.encode("utf-8")).hexdigest()


def _statements(sql: str) -> list[str]:
    return [part.strip() for part in sql.split(";") if part.strip()]


def _postgresize(sql: str) -> str:
    sql = re.sub(
        r"INTEGER\s+PRIMARY\s+KEY\s+AUTOINCREMENT",
        "BIGSERIAL PRIMARY KEY",
        sql,
        flags=re.IGNORECASE,
    )
    sql = re.sub(
        r"INSERT\s+OR\s+IGNORE\s+INTO\s+(.+?)\s*;",
        r"INSERT INTO \1 ON CONFLICT DO NOTHING;",
        sql,
        flags=re.IGNORECASE | re.DOTALL,
    )
    return sql


def _fts_and_vector_sql() -> list[str]:
    return [
        "CREATE EXTENSION IF NOT EXISTS pg_trgm",
        "CREATE EXTENSION IF NOT EXISTS vector",
        """
        CREATE INDEX IF NOT EXISTS chunks_text_trgm
        ON chunks USING gin (text gin_trgm_ops)
        """,
        """
        CREATE INDEX IF NOT EXISTS chunks_kb_created
        ON chunks(kb_id, created_at DESC)
        """,
        """
        CREATE TABLE IF NOT EXISTS kb_vector_manifests (
            kb_id TEXT PRIMARY KEY REFERENCES knowledge_bases(id) ON DELETE CASCADE,
            backend TEXT NOT NULL,
            model_ref TEXT NOT NULL,
            dimension INTEGER NOT NULL,
            updated_at TEXT NOT NULL
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS chunk_vectors (
            kb_id TEXT NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
            chunk_id TEXT NOT NULL REFERENCES chunks(id) ON DELETE CASCADE,
            dimension INTEGER NOT NULL,
            embedding vector NOT NULL,
            metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
            model_ref TEXT NOT NULL,
            PRIMARY KEY (kb_id, chunk_id, dimension)
        ) PARTITION BY LIST (dimension)
        """,
    ]


def _postgres_search_v2_sql() -> list[str]:
    return [
        """
        CREATE INDEX IF NOT EXISTS chunks_text_trgm_gist
        ON chunks USING gist (text gist_trgm_ops)
        """
    ]


def run_postgres_migrations(engine: Engine) -> list[int]:
    """Apply the PostgreSQL schema, preserving SQLite migration version numbers."""
    applied_now: list[int] = []
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS schema_migrations (
                    version INTEGER PRIMARY KEY,
                    name TEXT NOT NULL,
                    checksum TEXT NOT NULL,
                    applied_at TEXT NOT NULL
                )
                """
            )
        )
        rows = conn.execute(
            text("SELECT version, checksum FROM schema_migrations")
        ).fetchall()
        applied = {int(row[0]): row[1] for row in rows}

        for version in range(1, 5):
            path = next(_migration_root().glob(f"{version:04d}_*.sql"))
            source = path.read_text(encoding="utf-8")
            checksum = _checksum(source)
            if version in applied:
                if applied[version] != checksum:
                    raise RuntimeError(f"PostgreSQL migration {version} checksum mismatch")
                continue
            for statement in _statements(_postgresize(source)):
                conn.exec_driver_sql(statement)
            conn.execute(
                text(
                    """
                    INSERT INTO schema_migrations(version, name, checksum, applied_at)
                    VALUES (:version, :name, :checksum, :applied_at)
                    """
                ),
                {
                    "version": version,
                    "name": path.name,
                    "checksum": checksum,
                    "applied_at": datetime.now(timezone.utc).isoformat(),
                },
            )
            applied_now.append(version)

        fts_source = (_migration_root() / "0005_chunk_fts.sql").read_text(encoding="utf-8")
        fts_checksum = _checksum(fts_source)
        if 5 in applied:
            if applied[5] != fts_checksum:
                raise RuntimeError("PostgreSQL migration 5 checksum mismatch")
        else:
            for statement in _fts_and_vector_sql():
                conn.exec_driver_sql(statement)
            conn.execute(
                text(
                    """
                    INSERT INTO schema_migrations(version, name, checksum, applied_at)
                    VALUES (5, '0005_chunk_fts.sql', :checksum, :applied_at)
                    """
                ),
                {
                    "checksum": fts_checksum,
                    "applied_at": datetime.now(timezone.utc).isoformat(),
                },
            )
            applied_now.append(5)

        search_source = (
            _migration_root() / "0006_postgres_search.sql"
        ).read_text(encoding="utf-8")
        search_checksum = _checksum(search_source)
        if 6 in applied:
            if applied[6] != search_checksum:
                raise RuntimeError("PostgreSQL migration 6 checksum mismatch")
        else:
            for statement in _postgres_search_v2_sql():
                conn.exec_driver_sql(statement)
            conn.execute(
                text(
                    """
                    INSERT INTO schema_migrations(version, name, checksum, applied_at)
                    VALUES (6, '0006_postgres_search.sql', :checksum, :applied_at)
                    """
                ),
                {
                    "checksum": search_checksum,
                    "applied_at": datetime.now(timezone.utc).isoformat(),
                },
            )
            applied_now.append(6)

        processing_source = (
            _migration_root() / "0007_processing_jobs.sql"
        ).read_text(encoding="utf-8")
        processing_checksum = _checksum(processing_source)
        if 7 in applied:
            if applied[7] != processing_checksum:
                raise RuntimeError("PostgreSQL migration 7 checksum mismatch")
        else:
            for statement in _statements(_postgresize(processing_source)):
                conn.exec_driver_sql(statement)
            conn.execute(
                text(
                    """
                    INSERT INTO schema_migrations(version, name, checksum, applied_at)
                    VALUES (7, '0007_processing_jobs.sql', :checksum, :applied_at)
                    """
                ),
                {
                    "checksum": processing_checksum,
                    "applied_at": datetime.now(timezone.utc).isoformat(),
                },
            )
            applied_now.append(7)
    return applied_now
