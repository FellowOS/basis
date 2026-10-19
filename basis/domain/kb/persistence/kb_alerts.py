"""KB alert rows — canonical DB SQL (caller holds lock)."""

from __future__ import annotations

import json
import sqlite3
from typing import Any

_ALERT_SELECT = """
    SELECT id, kb_id, kind, severity, message, detail_json,
           created_at, read_at, dismissed_at
"""


def alert_row_to_dict(row: sqlite3.Row) -> dict[str, Any]:
    detail_raw = row["detail_json"]
    try:
        detail = json.loads(detail_raw) if detail_raw else {}
    except json.JSONDecodeError:
        detail = {}
    return {
        "id": row["id"],
        "kb_id": row["kb_id"],
        "kind": row["kind"],
        "severity": row["severity"],
        "message": row["message"],
        "detail": detail,
        "created_at": row["created_at"],
        "read_at": row["read_at"],
        "dismissed_at": row["dismissed_at"],
    }


def insert_kb_alert(
    conn: Any,
    *,
    alert_id: str,
    kb_id: str,
    kind: str,
    severity: str,
    message: str,
    detail_json: str,
    created_at: str,
) -> None:
    conn.execute(
        """
        INSERT INTO kb_alerts (
            id, kb_id, kind, severity, message, detail_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (alert_id, kb_id, kind, severity, message, detail_json, created_at),
    )


def fetch_kb_alert(conn: Any, kb_id: str, alert_id: str) -> Any:
    return conn.execute(
        f"""
        {_ALERT_SELECT}
        FROM kb_alerts
        WHERE kb_id = ? AND id = ?
        """,
        (kb_id, alert_id),
    ).fetchone()


def list_kb_alert_rows(
    conn: Any,
    kb_id: str,
    *,
    include_dismissed: bool,
    limit: int,
) -> list[Any]:
    clauses = ["kb_id = ?"]
    params: list[Any] = [kb_id]
    if not include_dismissed:
        clauses.append("dismissed_at IS NULL")
    return conn.execute(
        f"""
        {_ALERT_SELECT}
        FROM kb_alerts
        WHERE {' AND '.join(clauses)}
        ORDER BY created_at DESC
        LIMIT ?
        """,
        (*params, limit),
    ).fetchall()


def count_kb_alerts(conn: Any, kb_id: str, *, include_dismissed: bool) -> int:
    clauses = ["kb_id = ?"]
    params: list[Any] = [kb_id]
    if not include_dismissed:
        clauses.append("dismissed_at IS NULL")
    row = conn.execute(
        f"SELECT COUNT(*) AS n FROM kb_alerts WHERE {' AND '.join(clauses)}",
        params,
    ).fetchone()
    return int(row["n"])


def count_kb_unread_alerts(conn: Any, kb_id: str) -> int:
    row = conn.execute(
        """
        SELECT COUNT(*) AS n FROM kb_alerts
        WHERE kb_id = ? AND dismissed_at IS NULL AND read_at IS NULL
        """,
        (kb_id,),
    ).fetchone()
    return int(row["n"])


def list_kb_alerts_since_rows(
    conn: Any, kb_id: str, *, since_created_at: str | None, limit: int
) -> list[Any]:
    if since_created_at:
        return conn.execute(
            f"""
            {_ALERT_SELECT}
            FROM kb_alerts
            WHERE kb_id = ? AND dismissed_at IS NULL AND created_at > ?
            ORDER BY created_at ASC
            LIMIT ?
            """,
            (kb_id, since_created_at, limit),
        ).fetchall()
    return conn.execute(
        f"""
        {_ALERT_SELECT}
        FROM kb_alerts
        WHERE kb_id = ? AND dismissed_at IS NULL
        ORDER BY created_at DESC
        LIMIT ?
        """,
        (kb_id, limit),
    ).fetchall()


def dismiss_kb_alert_row(
    conn: Any, kb_id: str, alert_id: str, *, dismissed_at: str, read_at: str
) -> None:
    conn.execute(
        """
        UPDATE kb_alerts
        SET dismissed_at = ?, read_at = COALESCE(read_at, ?)
        WHERE kb_id = ? AND id = ?
        """,
        (dismissed_at, read_at, kb_id, alert_id),
    )


def dismiss_all_kb_alerts(conn: Any, kb_id: str, *, dismissed_at: str, read_at: str) -> int:
    cur = conn.execute(
        """
        UPDATE kb_alerts
        SET dismissed_at = ?, read_at = COALESCE(read_at, ?)
        WHERE kb_id = ? AND dismissed_at IS NULL
        """,
        (dismissed_at, read_at, kb_id),
    )
    return int(cur.rowcount)


def mark_all_kb_alerts_read(conn: Any, kb_id: str, *, read_at: str) -> int:
    cur = conn.execute(
        """
        UPDATE kb_alerts
        SET read_at = ?
        WHERE kb_id = ? AND dismissed_at IS NULL AND read_at IS NULL
        """,
        (read_at, kb_id),
    )
    return int(cur.rowcount)
