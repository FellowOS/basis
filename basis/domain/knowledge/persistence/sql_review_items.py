"""Review queue rows — canonical DB SQL (caller holds lock)."""

from __future__ import annotations

import json
import sqlite3
from typing import Any

_REVIEW_SELECT = """
    SELECT id, kind, subject_type, subject_id, status, priority,
           payload_json, version, created_at, resolved_at, resolved_by, rationale
"""


def review_row_to_dict(row: sqlite3.Row) -> dict[str, Any]:
    payload_raw = row["payload_json"]
    try:
        payload = json.loads(payload_raw) if payload_raw else {}
    except json.JSONDecodeError:
        payload = {}
    return {
        "id": row["id"],
        "kind": row["kind"],
        "subject_type": row["subject_type"],
        "subject_id": row["subject_id"],
        "status": row["status"],
        "priority": row["priority"],
        "payload": payload,
        "version": row["version"],
        "created_at": row["created_at"],
        "resolved_at": row["resolved_at"],
        "resolved_by": row["resolved_by"],
        "rationale": row["rationale"],
    }


def insert_review_item(
    conn: Any,
    *,
    item_id: str,
    workspace_id: str,
    kind: str,
    subject_type: str,
    subject_id: str,
    priority: int,
    payload_json: str,
    created_at: str,
) -> None:
    conn.execute(
        """
        INSERT INTO review_items (
            id, workspace_id, kind, subject_type, subject_id, status,
            priority, payload_json, version, created_at
        ) VALUES (?, ?, ?, ?, ?, 'open', ?, ?, 1, ?)
        """,
        (
            item_id,
            workspace_id,
            kind,
            subject_type,
            subject_id,
            priority,
            payload_json,
            created_at,
        ),
    )


def fetch_review_item(conn: Any, workspace_id: str, item_id: str) -> Any:
    return conn.execute(
        f"""
        {_REVIEW_SELECT}
        FROM review_items
        WHERE workspace_id = ? AND id = ?
        """,
        (workspace_id, item_id),
    ).fetchone()


def fetch_open_review_item(
    conn: Any,
    workspace_id: str,
    *,
    kind: str,
    subject_type: str,
    subject_id: str,
) -> Any:
    return conn.execute(
        f"""
        {_REVIEW_SELECT}
        FROM review_items
        WHERE workspace_id = ? AND kind = ? AND subject_type = ? AND subject_id = ?
          AND status = 'open'
        LIMIT 1
        """,
        (workspace_id, kind, subject_type, subject_id),
    ).fetchone()


def list_review_item_rows(
    conn: Any,
    workspace_id: str,
    *,
    status: str | None,
    kind: str | None,
    limit: int,
) -> list[Any]:
    clauses = ["workspace_id = ?"]
    params: list[Any] = [workspace_id]
    if status:
        clauses.append("status = ?")
        params.append(status)
    if kind:
        clauses.append("kind = ?")
        params.append(kind)
    params.append(limit)
    sql = f"""
        {_REVIEW_SELECT}
        FROM review_items
        WHERE {' AND '.join(clauses)}
        ORDER BY priority DESC, created_at ASC
        LIMIT ?
    """
    return conn.execute(sql, tuple(params)).fetchall()


def fetch_review_item_status(conn: Any, workspace_id: str, item_id: str) -> Any:
    return conn.execute(
        "SELECT status FROM review_items WHERE workspace_id = ? AND id = ?",
        (workspace_id, item_id),
    ).fetchone()


def resolve_review_item_row(
    conn: Any,
    workspace_id: str,
    item_id: str,
    *,
    status: str,
    resolved_at: str,
    resolved_by: str,
    rationale: str | None,
) -> None:
    conn.execute(
        """
        UPDATE review_items
        SET status = ?, resolved_at = ?, resolved_by = ?, rationale = ?
        WHERE workspace_id = ? AND id = ?
        """,
        (status, resolved_at, resolved_by, rationale, workspace_id, item_id),
    )
