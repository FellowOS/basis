"""Documents and document_versions — canonical DB SQL (caller holds lock)."""

from __future__ import annotations

from typing import Any


def insert_document(
    conn: Any,
    *,
    document_id: str,
    kb_id: str,
    source_id: str | None,
    external_key: str | None,
    title: str,
    mime_type: str,
    created_by: str | None,
    created_at: str,
) -> None:
    conn.execute(
        """
        INSERT INTO documents(
            id, kb_id, source_id, external_key, title, mime_type,
            current_version_id, created_by, created_at, deleted_at
        ) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, NULL)
        """,
        (document_id, kb_id, source_id, external_key, title, mime_type, created_by, created_at),
    )


def insert_document_version(
    conn: Any,
    *,
    version_id: str,
    kb_id: str,
    document_id: str,
    version_no: int,
    sha256: str,
    blob_key: str,
    byte_size: int,
    created_at: str,
) -> None:
    conn.execute(
        """
        INSERT INTO document_versions(
            id, kb_id, document_id, version_no, sha256, blob_key, byte_size,
            source_time, source_time_kind, status, error_code, error_detail_json,
            created_at, ready_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 'none', 'uploaded', NULL, NULL, ?, NULL)
        """,
        (
            version_id,
            kb_id,
            document_id,
            version_no,
            sha256,
            blob_key,
            byte_size,
            created_at,
        ),
    )


def set_document_current_version(
    conn: Any, version_id: str, document_id: str, kb_id: str
) -> None:
    conn.execute(
        "UPDATE documents SET current_version_id = ? WHERE id = ? AND kb_id = ?",
        (version_id, document_id, kb_id),
    )


def fetch_document_for_append(conn: Any, document_id: str, kb_id: str) -> Any:
    return conn.execute(
        """
        SELECT id, current_version_id, title, mime_type
        FROM documents
        WHERE id = ? AND kb_id = ? AND deleted_at IS NULL
        """,
        (document_id, kb_id),
    ).fetchone()


def fetch_version_for_append(
    conn: Any, version_id: str, kb_id: str, document_id: str
) -> Any:
    return conn.execute(
        """
        SELECT id, version_no, sha256, status
        FROM document_versions
        WHERE id = ? AND kb_id = ? AND document_id = ?
        """,
        (version_id, kb_id, document_id),
    ).fetchone()


def next_version_no(conn: Any, kb_id: str, document_id: str) -> int:
    row = conn.execute(
        """
        SELECT COALESCE(MAX(version_no), 0) AS value
        FROM document_versions
        WHERE kb_id = ? AND document_id = ?
        """,
        (kb_id, document_id),
    ).fetchone()
    return int(row["value"] or 0) + 1


def update_document_after_append(
    conn: Any,
    *,
    version_id: str,
    title: str,
    mime_type: str,
    document_id: str,
    kb_id: str,
) -> None:
    conn.execute(
        """
        UPDATE documents
        SET current_version_id = ?, title = ?, mime_type = ?
        WHERE id = ? AND kb_id = ?
        """,
        (version_id, title, mime_type, document_id, kb_id),
    )


def find_document_ref_by_external_key(conn: Any, kb_id: str, external_key: str) -> Any:
    return conn.execute(
        """
        SELECT d.id AS document_id, d.external_key, dv.id AS version_id
        FROM documents d
        LEFT JOIN document_versions dv ON dv.id = d.current_version_id
        WHERE d.kb_id = ? AND d.external_key = ? AND d.deleted_at IS NULL
        ORDER BY d.created_at DESC
        LIMIT 1
        """,
        (kb_id, external_key),
    ).fetchone()


def find_document_ref_by_id(conn: Any, kb_id: str, document_id: str) -> Any:
    return conn.execute(
        """
        SELECT d.id AS document_id, d.external_key, dv.id AS version_id
        FROM documents d
        LEFT JOIN document_versions dv ON dv.id = d.current_version_id
        WHERE d.kb_id = ? AND d.id = ? AND d.deleted_at IS NULL
        LIMIT 1
        """,
        (kb_id, document_id),
    ).fetchone()


def fetch_document_summary_row(conn: Any, kb_id: str, document_id: str) -> Any:
    return conn.execute(
        """
        SELECT d.title, d.external_key, dv.status AS version_status
        FROM documents d
        LEFT JOIN document_versions dv ON dv.id = d.current_version_id
        WHERE d.id = ? AND d.kb_id = ? AND d.deleted_at IS NULL
        """,
        (document_id, kb_id),
    ).fetchone()


def list_document_rows(conn: Any, kb_id: str) -> list[Any]:
    return conn.execute(
        """
        SELECT d.id, d.title, d.external_key, d.created_at,
               dv.status AS version_status,
               dv.id AS version_id, dv.version_no,
               dv.created_at AS version_created_at
        FROM documents d
        LEFT JOIN document_versions dv ON dv.id = d.current_version_id
        WHERE d.kb_id = ? AND d.deleted_at IS NULL
        ORDER BY d.created_at DESC
        """,
        (kb_id,),
    ).fetchall()
