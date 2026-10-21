"""Ingest source rows — canonical DB SQL (caller holds lock)."""

from __future__ import annotations

import json
import sqlite3
from typing import Any

_INGEST_SOURCE_SELECT = """
    SELECT id, kb_id, kind, name, config_json, enabled, created_by, created_at, updated_at
"""


def ingest_source_row_to_dict(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "kb_id": row["kb_id"],
        "kind": row["kind"],
        "name": row["name"],
        "config": json.loads(row["config_json"]),
        "enabled": bool(row["enabled"]),
        "created_by": row["created_by"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def list_scheduled_ingest_source_rows(conn: Any) -> list[Any]:
    return conn.execute(
        f"""
        {_INGEST_SOURCE_SELECT}
        FROM ingest_sources
        WHERE deleted_at IS NULL AND enabled = 1 AND kind IN ('http_poll', 'git')
        ORDER BY kb_id, created_at ASC
        """
    ).fetchall()


def list_ingest_source_rows(conn: Any, kb_id: str) -> list[Any]:
    return conn.execute(
        f"""
        {_INGEST_SOURCE_SELECT}
        FROM ingest_sources
        WHERE kb_id = ? AND deleted_at IS NULL
        ORDER BY created_at DESC
        """,
        (kb_id,),
    ).fetchall()


def insert_ingest_source(
    conn: Any,
    *,
    source_id: str,
    kb_id: str,
    kind: str,
    name: str,
    config_json: str,
    secret_ref: str | None,
    enabled: int,
    created_by: str,
    created_at: str,
    updated_at: str,
) -> None:
    conn.execute(
        """
        INSERT INTO ingest_sources (
            id, kb_id, kind, name, config_json, secret_ref, enabled,
            created_by, created_at, updated_at, deleted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
        """,
        (
            source_id,
            kb_id,
            kind,
            name,
            config_json,
            secret_ref,
            enabled,
            created_by,
            created_at,
            updated_at,
        ),
    )


def fetch_ingest_source_row(conn: Any, kb_id: str, source_id: str) -> Any:
    return conn.execute(
        f"""
        {_INGEST_SOURCE_SELECT}
        FROM ingest_sources
        WHERE kb_id = ? AND id = ? AND deleted_at IS NULL
        """,
        (kb_id, source_id),
    ).fetchone()


def fetch_ingest_source_secret(conn: Any, kb_id: str, source_id: str) -> Any:
    return conn.execute(
        """
        SELECT secret_ref FROM ingest_sources
        WHERE kb_id = ? AND id = ? AND deleted_at IS NULL
        """,
        (kb_id, source_id),
    ).fetchone()


def fetch_ingest_source_for_update(conn: Any, kb_id: str, source_id: str) -> Any:
    return conn.execute(
        """
        SELECT name, config_json, enabled FROM ingest_sources
        WHERE kb_id = ? AND id = ? AND deleted_at IS NULL
        """,
        (kb_id, source_id),
    ).fetchone()


def update_ingest_source_row(
    conn: Any,
    kb_id: str,
    source_id: str,
    *,
    name: str,
    config_json: str,
    enabled: int,
    updated_at: str,
) -> None:
    conn.execute(
        """
        UPDATE ingest_sources
        SET name = ?, config_json = ?, enabled = ?, updated_at = ?
        WHERE kb_id = ? AND id = ?
        """,
        (name, config_json, enabled, updated_at, kb_id, source_id),
    )


def soft_delete_ingest_source(
    conn: Any, kb_id: str, source_id: str, *, deleted_at: str, updated_at: str
) -> int:
    cur = conn.execute(
        """
        UPDATE ingest_sources SET deleted_at = ?, updated_at = ?, enabled = 0
        WHERE kb_id = ? AND id = ? AND deleted_at IS NULL
        """,
        (deleted_at, updated_at, kb_id, source_id),
    )
    return int(cur.rowcount)


def rotate_ingest_source_secret(
    conn: Any,
    kb_id: str,
    source_id: str,
    *,
    secret_ref: str,
    updated_at: str,
) -> int:
    cur = conn.execute(
        """
        UPDATE ingest_sources
        SET secret_ref = ?, updated_at = ?
        WHERE kb_id = ? AND id = ? AND deleted_at IS NULL
        """,
        (secret_ref, updated_at, kb_id, source_id),
    )
    return int(cur.rowcount)
