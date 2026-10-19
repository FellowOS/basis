"""Entity merge ledger rows — canonical DB SQL (caller holds lock)."""

from __future__ import annotations

import sqlite3
from typing import Any


def entity_merge_row_to_dict(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "kb_id": row["kb_id"],
        "source_entity_id": row["source_entity_id"],
        "target_entity_id": row["target_entity_id"],
        "decision_id": row["decision_id"],
        "actor_id": row["actor_id"],
        "why": row["why"],
        "created_at": row["created_at"],
        "reverted_at": row["reverted_at"],
        "reverted_by": row["reverted_by"],
    }


def insert_entity_merge(
    conn: Any,
    *,
    merge_id: str,
    kb_id: str,
    source_entity_id: str,
    target_entity_id: str,
    decision_id: str | None,
    actor_id: str | None,
    why: str | None,
    created_at: str,
) -> None:
    conn.execute(
        """
        INSERT INTO entity_merges(
            id, kb_id, source_entity_id, target_entity_id,
            decision_id, actor_id, why, created_at, reverted_at, reverted_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)
        """,
        (
            merge_id,
            kb_id,
            source_entity_id,
            target_entity_id,
            decision_id,
            actor_id,
            why,
            created_at,
        ),
    )


def fetch_entity_merge_by_id(conn: Any, merge_id: str) -> Any:
    return conn.execute("SELECT * FROM entity_merges WHERE id = ?", (merge_id,)).fetchone()


def fetch_entity_merge_for_kb(conn: Any, merge_id: str, kb_id: str) -> Any:
    return conn.execute(
        "SELECT * FROM entity_merges WHERE id = ? AND kb_id = ?",
        (merge_id, kb_id),
    ).fetchone()


def revert_entity_merge_row(
    conn: Any,
    merge_id: str,
    kb_id: str,
    *,
    reverted_at: str,
    reverted_by: str,
) -> None:
    conn.execute(
        """
        UPDATE entity_merges
        SET reverted_at = ?, reverted_by = ?
        WHERE id = ? AND kb_id = ?
        """,
        (reverted_at, reverted_by, merge_id, kb_id),
    )


def list_entity_merge_rows(
    conn: Any, kb_id: str, *, active_only: bool, limit: int
) -> list[Any]:
    clause = "AND reverted_at IS NULL" if active_only else ""
    return conn.execute(
        f"""
        SELECT * FROM entity_merges
        WHERE kb_id = ? {clause}
        ORDER BY created_at DESC
        LIMIT ?
        """,
        (kb_id, limit),
    ).fetchall()
