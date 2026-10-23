"""Typed fact rows — canonical DB SQL (caller holds lock)."""

from __future__ import annotations

from typing import Any


def list_typed_facts_limited(conn: Any, workspace_id: str, limit: int) -> list[dict[str, Any]]:
    rows = conn.execute(
        """
        SELECT id, subject_id, predicate_uri, object_entity_id, object_value,
               from_statement_id, mapping_id, confidence, recorded_at
        FROM typed_facts
        WHERE workspace_id = ? AND invalidated_at IS NULL
        ORDER BY recorded_at DESC
        LIMIT ?
        """,
        (workspace_id, limit),
    ).fetchall()
    return [
        {
            "id": row["id"],
            "subject_id": row["subject_id"],
            "predicate_uri": row["predicate_uri"],
            "object_entity_id": row["object_entity_id"],
            "object_value": row["object_value"],
            "from_statement_id": row["from_statement_id"],
            "mapping_id": row["mapping_id"],
            "confidence": row["confidence"],
            "recorded_at": row["recorded_at"],
        }
        for row in rows
    ]
