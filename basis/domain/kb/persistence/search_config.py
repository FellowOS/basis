"""KB search policy rows — canonical DB SQL (caller holds lock)."""

from __future__ import annotations

from typing import Any

from basis.domain.kb.search_config import SearchConfig


def fetch_search_config_row(conn: Any, kb_id: str) -> Any:
    return conn.execute("SELECT * FROM kb_search_configs WHERE kb_id = ?", (kb_id,)).fetchone()


def insert_default_search_config(
    conn: Any,
    kb_id: str,
    *,
    chunk_backend: str,
    vector_backend: str,
    created_at: str,
    updated_at: str,
) -> None:
    conn.execute(
        """
        INSERT INTO kb_search_configs (
            kb_id, schema_version, chunk_backend, vector_backend,
            embedding_model_id, keyword_enabled, semantic_enabled,
            default_mode, auto_index, created_at, updated_at
        ) VALUES (?, 1, ?, ?, NULL, 1, 1, 'hybrid', 1, ?, ?)
        """,
        (kb_id, chunk_backend, vector_backend, created_at, updated_at),
    )


def search_config_from_row(row: Any) -> SearchConfig:
    return SearchConfig(
        kb_id=row["kb_id"],
        schema_version=int(row["schema_version"]),
        chunk_backend=row["chunk_backend"],
        vector_backend=row["vector_backend"],
        embedding_model_id=row["embedding_model_id"],
        keyword_enabled=bool(row["keyword_enabled"]),
        semantic_enabled=bool(row["semantic_enabled"]),
        default_mode=row["default_mode"],
        auto_index=bool(row["auto_index"]),
    )


def upsert_search_config(conn: Any, config: SearchConfig, *, now: str) -> None:
    conn.execute(
        """
        INSERT INTO kb_search_configs (
            kb_id, schema_version, chunk_backend, vector_backend,
            embedding_model_id, keyword_enabled, semantic_enabled,
            default_mode, auto_index, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(kb_id) DO UPDATE SET
            schema_version = excluded.schema_version,
            chunk_backend = excluded.chunk_backend,
            vector_backend = excluded.vector_backend,
            embedding_model_id = excluded.embedding_model_id,
            keyword_enabled = excluded.keyword_enabled,
            semantic_enabled = excluded.semantic_enabled,
            default_mode = excluded.default_mode,
            auto_index = excluded.auto_index,
            updated_at = excluded.updated_at
        """,
        (
            config.kb_id,
            config.schema_version,
            config.chunk_backend,
            config.vector_backend,
            config.embedding_model_id,
            int(config.keyword_enabled),
            int(config.semantic_enabled),
            config.default_mode,
            int(config.auto_index),
            now,
            now,
        ),
    )
