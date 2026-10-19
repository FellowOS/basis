"""KB reasoning rule rows — canonical DB SQL (caller holds lock)."""

from __future__ import annotations

import sqlite3
from typing import Any


def reasoning_rule_row_to_dict(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "kb_id": row["kb_id"],
        "name": row["name"],
        "body": row["body"],
        "enabled": bool(row["enabled"]),
        "actor_id": row["actor_id"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def list_reasoning_rule_rows(conn: Any, kb_id: str, limit: int) -> list[Any]:
    return conn.execute(
        """
        SELECT id, kb_id, name, body, enabled, actor_id, created_at, updated_at
        FROM kb_reasoning_rules
        WHERE kb_id = ? AND deleted_at IS NULL
        ORDER BY updated_at DESC
        LIMIT ?
        """,
        (kb_id, limit),
    ).fetchall()


def insert_reasoning_rule(
    conn: Any,
    *,
    rule_id: str,
    kb_id: str,
    name: str,
    body: str,
    enabled: int,
    actor_id: str,
    created_at: str,
    updated_at: str,
) -> None:
    conn.execute(
        """
        INSERT INTO kb_reasoning_rules (
            id, kb_id, name, body, enabled, actor_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (rule_id, kb_id, name, body, enabled, actor_id, created_at, updated_at),
    )


def fetch_reasoning_rule(conn: Any, kb_id: str, rule_id: str) -> Any:
    return conn.execute(
        """
        SELECT id, kb_id, name, body, enabled, actor_id, created_at, updated_at
        FROM kb_reasoning_rules
        WHERE kb_id = ? AND id = ? AND deleted_at IS NULL
        """,
        (kb_id, rule_id),
    ).fetchone()


def update_reasoning_rule_dynamic(
    conn: Any,
    kb_id: str,
    rule_id: str,
    set_clause: str,
    params: list[Any],
) -> None:
    conn.execute(
        f"""
        UPDATE kb_reasoning_rules
        SET {set_clause}
        WHERE kb_id = ? AND id = ? AND deleted_at IS NULL
        """,
        params,
    )


def soft_delete_reasoning_rule(
    conn: Any, kb_id: str, rule_id: str, *, deleted_at: str, updated_at: str
) -> None:
    conn.execute(
        """
        UPDATE kb_reasoning_rules
        SET deleted_at = ?, updated_at = ?, enabled = 0
        WHERE kb_id = ? AND id = ? AND deleted_at IS NULL
        """,
        (deleted_at, updated_at, kb_id, rule_id),
    )
