"""Document timeline ledger events — canonical DB SQL (caller holds lock)."""

from __future__ import annotations

from typing import Any


def fetch_document_header(conn: Any, kb_id: str, document_id: str) -> Any:
    return conn.execute(
        """
        SELECT id, external_key, title, created_at
        FROM documents
        WHERE kb_id = ? AND id = ? AND deleted_at IS NULL
        """,
        (kb_id, document_id),
    ).fetchone()


def list_document_version_rows(conn: Any, kb_id: str, document_id: str) -> list[Any]:
    return conn.execute(
        """
        SELECT id, status, created_at, byte_size
        FROM document_versions
        WHERE kb_id = ? AND document_id = ?
        ORDER BY created_at ASC
        """,
        (kb_id, document_id),
    ).fetchall()


def list_ingest_jobs_for_versions(
    conn: Any, kb_id: str, version_ids: list[str]
) -> list[Any]:
    placeholders = ",".join("?" for _ in version_ids)
    return conn.execute(
        f"""
        SELECT id, status, created_at, finished_at, error_code
        FROM jobs
        WHERE kb_id = ? AND kind = 'ingest'
          AND subject_type = 'document_version'
          AND subject_id IN ({placeholders})
        ORDER BY created_at ASC
        """,
        (kb_id, *version_ids),
    ).fetchall()


def list_statements_for_document_versions(
    conn: Any, kb_id: str, version_ids: list[str]
) -> list[Any]:
    placeholders = ",".join("?" for _ in version_ids)
    return conn.execute(
        f"""
        SELECT s.id, s.surface_phrase, s.status, s.recorded_at, s.invalidated_at,
               c.id AS chunk_id
        FROM statements s
        INNER JOIN statement_evidence e ON e.statement_id = s.id AND e.kb_id = s.kb_id
        INNER JOIN chunks c ON c.id = e.chunk_id
        WHERE s.kb_id = ? AND c.version_id IN ({placeholders})
        ORDER BY s.recorded_at ASC
        """,
        (kb_id, *version_ids),
    ).fetchall()


def list_time_mentions_for_versions(
    conn: Any, kb_id: str, version_ids: list[str]
) -> list[Any]:
    placeholders = ",".join("?" for _ in version_ids)
    return conn.execute(
        f"""
        SELECT tm.id, tm.text, tm.char_start, tm.char_end, tm.chunk_id,
               s.recorded_at AS statement_at
        FROM time_mentions tm
        INNER JOIN chunks c ON c.id = tm.chunk_id
        LEFT JOIN statements s ON s.id = tm.statement_id AND s.kb_id = tm.kb_id
        WHERE tm.kb_id = ? AND c.version_id IN ({placeholders})
        ORDER BY tm.char_start ASC
        """,
        (kb_id, *version_ids),
    ).fetchall()
