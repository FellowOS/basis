"""Projection revision / status rows — canonical DB SQL (caller holds lock)."""

from __future__ import annotations

from typing import Any

PROJECTION_SCHEMA_VERSION = 1


def insert_projection_state_ignore(
    conn: Any, kb_id: str, schema_version: int = PROJECTION_SCHEMA_VERSION
) -> None:
    conn.execute(
        """
        INSERT OR IGNORE INTO projection_state(
            kb_id, revision, schema_version, status, last_built_at, last_error_code
        ) VALUES (?, 0, ?, 'dirty', NULL, NULL)
        """,
        (kb_id, schema_version),
    )


def fetch_projection_state_row(conn: Any, kb_id: str) -> Any:
    return conn.execute(
        """
        SELECT revision, schema_version, status, last_built_at, last_error_code
        FROM projection_state WHERE kb_id = ?
        """,
        (kb_id,),
    ).fetchone()


def projection_state_dict(row: Any) -> dict[str, Any]:
    return {
        "revision": int(row["revision"]),
        "schema_version": int(row["schema_version"]),
        "status": row["status"],
        "last_built_at": row["last_built_at"],
        "last_error_code": row["last_error_code"],
    }


def update_projection_status(
    conn: Any, kb_id: str, status: str, error_code: str | None
) -> None:
    conn.execute(
        """
        UPDATE projection_state
        SET status = ?, last_error_code = ?
        WHERE kb_id = ?
        """,
        (status, error_code, kb_id),
    )


def bump_projection_revision_row(
    conn: Any,
    kb_id: str,
    *,
    built_at: str,
    schema_version: int,
) -> int:
    conn.execute(
        """
        UPDATE projection_state
        SET revision = revision + 1,
            status = 'clean',
            last_built_at = ?,
            last_error_code = NULL,
            schema_version = ?
        WHERE kb_id = ?
        """,
        (built_at, schema_version, kb_id),
    )
    row = conn.execute(
        "SELECT revision FROM projection_state WHERE kb_id = ?", (kb_id,)
    ).fetchone()
    return int(row["revision"])


def ledger_temporal_bounds(conn: Any, kb_id: str) -> dict[str, str | None]:
    row = conn.execute(
        """
        SELECT MIN(ts) AS min_at, MAX(ts) AS max_at
        FROM (
            SELECT recorded_at AS ts FROM statements WHERE kb_id = ?
            UNION ALL
            SELECT invalidated_at AS ts FROM statements WHERE kb_id = ?
            UNION ALL
            SELECT recorded_at FROM typed_facts WHERE kb_id = ?
            UNION ALL
            SELECT invalidated_at FROM typed_facts WHERE kb_id = ?
            UNION ALL
            SELECT recorded_at FROM derived_facts WHERE kb_id = ?
            UNION ALL
            SELECT invalidated_at FROM derived_facts WHERE kb_id = ?
            UNION ALL
            SELECT created_at FROM entities WHERE kb_id = ?
            UNION ALL
            SELECT invalidated_at FROM entities WHERE kb_id = ?
            UNION ALL
            SELECT dv.created_at AS ts
            FROM documents d
            INNER JOIN document_versions dv ON dv.id = d.current_version_id
            WHERE d.kb_id = ? AND d.deleted_at IS NULL
        )
        WHERE ts IS NOT NULL AND TRIM(ts) != ''
        """,
        (kb_id, kb_id, kb_id, kb_id, kb_id, kb_id, kb_id, kb_id, kb_id),
    ).fetchone()
    if row is None or row["min_at"] is None:
        return {"min": None, "max": None}
    return {"min": row["min_at"], "max": row["max_at"]}
