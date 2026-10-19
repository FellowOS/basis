"""SQLite repository for canonical knowledge ledger tables."""

from __future__ import annotations

import json
import secrets
import sqlite3
import threading
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy.exc import IntegrityError as SQLAlchemyIntegrityError

from basis.platform.admin.errors import AdminError
from basis.infra.database import Database, get_sqlite_database
from basis.domain.kb.blob_store import BlobRef, BlobStore
from basis.domain.kb.search_config import SearchConfig, validate_search_config


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _uploaded_filename(title: str | None, external_key: str | None) -> str | None:
    """Return the stored title when it is a real upload name.

    Pasted text is saved as ``{doc_id}.txt`` and has no filename.
    """
    name = (title or "").strip()
    if not name:
        return None
    key = (external_key or "").strip()
    if key and name == f"{key}.txt":
        return None
    return name


def _chunk_payload(item: str | dict[str, Any]) -> dict[str, Any]:
    raw = {"text": item} if isinstance(item, str) else item
    anchor_json = raw.get("anchor_json")
    anchor = raw.get("anchor")
    if anchor_json is None and isinstance(anchor, dict):
        anchor_json = json.dumps(anchor, ensure_ascii=False)
    return {
        "text": raw.get("text") or "",
        "heading": raw.get("heading"),
        "char_start": raw.get("char_start"),
        "char_end": raw.get("char_end"),
        "token_count": raw.get("token_count"),
        "language": raw.get("language"),
        "origin": raw.get("origin") or "stated",
        "anchor_json": anchor_json,
    }


def _chunk_api_row(row: Any) -> dict[str, Any]:
    anchor_raw = row["anchor_json"]
    anchor: Any = None
    if anchor_raw:
        try:
            anchor = json.loads(anchor_raw)
        except json.JSONDecodeError:
            anchor = None
    return {
        "id": row["id"],
        "ordinal": row["ordinal"],
        "text": row["text"] or "",
        "heading": row["heading"],
        "char_start": row["char_start"],
        "char_end": row["char_end"],
        "token_count": row["token_count"],
        "language": row["language"],
        "origin": row["origin"],
        "anchor": anchor,
        "created_at": row["created_at"],
    }


@dataclass(frozen=True)
class JobRow:
    id: str
    kb_id: str
    kind: str
    subject_type: str
    subject_id: str
    status: str
    attempt: int
    progress: float | None
    error_code: str | None
    error_detail: dict[str, Any] | None
    options: dict[str, Any]
    result: dict[str, Any] | None
    created_at: str
    started_at: str | None
    finished_at: str | None


@dataclass(frozen=True)
class DocumentVersionRow:
    id: str
    document_id: str
    kb_id: str
    version_no: int
    sha256: str
    blob_key: str
    byte_size: int
    status: str


@dataclass(frozen=True)
class StoreDocumentOutcome:
    document_id: str
    version_id: str
    blob: BlobRef
    version_no: int
    new_document: bool
    new_version: bool


class KnowledgeStore:
    """Canonical ledger access shared with AdminStore."""

    def __init__(self, db_path: Path | Database, blob_store: BlobStore) -> None:
        self._blob_store = blob_store
        if isinstance(db_path, Database):
            self._db = db_path
            self._owns_db_ref = False
        else:
            self._db = get_sqlite_database(db_path)
            self._owns_db_ref = True
        self._lock = self._db.lock
        self._conn = self._db.conn

    def close(self) -> None:
        if self._owns_db_ref:
            self._db.release()

    @property
    def database(self) -> Database:
        return self._db

    def store_upload_bytes(
        self,
        kb_id: str,
        *,
        title: str,
        mime_type: str,
        data: bytes,
        created_by: str | None,
        original_filename: str | None = None,
        external_key: str | None = None,
    ) -> tuple[str, str, str, BlobRef]:
        """Compatibility helper: store a source and create a queued ingest job."""
        outcome = self.store_document_bytes(
            kb_id,
            title=title,
            mime_type=mime_type,
            data=data,
            created_by=created_by,
            original_filename=original_filename,
            external_key=external_key,
        )
        job, _ = self.create_processing_job(kb_id, version_id=outcome.version_id, options={})
        return outcome.document_id, outcome.version_id, job["id"], outcome.blob

    def store_document_bytes(
        self,
        kb_id: str,
        *,
        title: str,
        mime_type: str,
        data: bytes,
        created_by: str | None,
        original_filename: str | None = None,
        external_key: str | None = None,
        document_id: str | None = None,
        source_id: str | None = None,
    ) -> StoreDocumentOutcome:
        """Persist a source document/version without starting processing.

        When ``document_id`` or an active ``external_key`` matches an existing document,
        appends a new version instead of creating a duplicate document row.
        """
        title = title.strip() or (original_filename or "upload").strip() or "upload"
        if len(title) > 256:
            raise AdminError(422, "bad_name", "标题过长")

        target_document_id = document_id
        if target_document_id is None and external_key:
            existing = self.find_document_by_external_key(kb_id, external_key)
            if existing is not None:
                target_document_id = existing["document_id"]

        if target_document_id is not None:
            return self.append_document_version(
                kb_id,
                target_document_id,
                title=title,
                mime_type=mime_type,
                data=data,
                created_by=created_by,
            )

        blob = self._blob_store.put(kb_id, data)
        new_document_id = str(uuid.uuid4())
        version_id = str(uuid.uuid4())
        now = _now()

        with self._lock:
            self._assert_kb_exists(kb_id)
            self._conn.execute(
                """
                INSERT INTO documents(
                    id, kb_id, source_id, external_key, title, mime_type,
                    current_version_id, created_by, created_at, deleted_at
                ) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, NULL)
                """,
                (new_document_id, kb_id, source_id, external_key, title, mime_type, created_by, now),
            )
            self._conn.execute(
                """
                INSERT INTO document_versions(
                    id, kb_id, document_id, version_no, sha256, blob_key, byte_size,
                    source_time, source_time_kind, status, error_code, error_detail_json,
                    created_at, ready_at
                ) VALUES (?, ?, ?, 1, ?, ?, ?, NULL, 'none', 'uploaded', NULL, NULL, ?, NULL)
                """,
                (
                    version_id,
                    kb_id,
                    new_document_id,
                    blob.sha256,
                    blob.blob_key,
                    blob.byte_size,
                    now,
                ),
            )
            self._conn.execute(
                "UPDATE documents SET current_version_id = ? WHERE id = ? AND kb_id = ?",
                (version_id, new_document_id, kb_id),
            )
            self._conn.commit()
        return StoreDocumentOutcome(
            document_id=new_document_id,
            version_id=version_id,
            blob=blob,
            version_no=1,
            new_document=True,
            new_version=True,
        )

    def append_document_version(
        self,
        kb_id: str,
        document_id: str,
        *,
        title: str,
        mime_type: str,
        data: bytes,
        created_by: str | None,
    ) -> StoreDocumentOutcome:
        """Add a new version to an existing document; supersedes the current version."""
        blob = self._blob_store.put(kb_id, data)
        now = _now()
        with self._lock:
            self._assert_kb_exists(kb_id)
            doc = self._conn.execute(
                """
                SELECT id, current_version_id, title, mime_type
                FROM documents
                WHERE id = ? AND kb_id = ? AND deleted_at IS NULL
                """,
                (document_id, kb_id),
            ).fetchone()
            if doc is None:
                raise AdminError(404, "not_found", "文档不存在")
            current_version_id = doc["current_version_id"]
            if not current_version_id:
                raise AdminError(409, "no_current_version", "文档没有当前版本")
            if self._has_active_ingest_job(kb_id, current_version_id):
                raise AdminError(409, "processing_active", "当前版本正在处理，请稍后再更新")

            current = self._conn.execute(
                """
                SELECT id, version_no, sha256, status
                FROM document_versions
                WHERE id = ? AND kb_id = ? AND document_id = ?
                """,
                (current_version_id, kb_id, document_id),
            ).fetchone()
            if current is None:
                raise AdminError(409, "no_current_version", "文档没有当前版本")

            if current["sha256"] == blob.sha256:
                self._conn.commit()
                return StoreDocumentOutcome(
                    document_id=document_id,
                    version_id=current_version_id,
                    blob=blob,
                    version_no=int(current["version_no"]),
                    new_document=False,
                    new_version=False,
                )

            next_row = self._conn.execute(
                """
                SELECT COALESCE(MAX(version_no), 0) AS value
                FROM document_versions
                WHERE kb_id = ? AND document_id = ?
                """,
                (kb_id, document_id),
            ).fetchone()
            version_no = int(next_row["value"] or 0) + 1
            version_id = str(uuid.uuid4())
            self._supersede_version(kb_id, current_version_id)
            self._conn.execute(
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
                    blob.sha256,
                    blob.blob_key,
                    blob.byte_size,
                    now,
                ),
            )
            self._conn.execute(
                """
                UPDATE documents
                SET current_version_id = ?, title = ?, mime_type = ?
                WHERE id = ? AND kb_id = ?
                """,
                (version_id, title, mime_type, document_id, kb_id),
            )
            self._conn.commit()
        return StoreDocumentOutcome(
            document_id=document_id,
            version_id=version_id,
            blob=blob,
            version_no=version_no,
            new_document=False,
            new_version=True,
        )

    def _has_active_ingest_job(self, kb_id: str, version_id: str) -> bool:
        row = self._conn.execute(
            """
            SELECT id FROM jobs
            WHERE kb_id = ? AND kind = 'ingest'
              AND subject_type = 'document_version' AND subject_id = ?
              AND status IN ('queued', 'running')
            LIMIT 1
            """,
            (kb_id, version_id),
        ).fetchone()
        return row is not None

    def _supersede_version(self, kb_id: str, version_id: str) -> None:
        self._conn.execute(
            """
            UPDATE document_versions
            SET status = 'stale'
            WHERE id = ? AND kb_id = ? AND status NOT IN ('failed', 'stale')
            """,
            (version_id, kb_id),
        )

    def _processing_job_dict(
        self,
        *,
        job_id: str,
        kb_id: str,
        version_id: str,
        attempt: int,
        now: str,
        options: dict[str, Any],
    ) -> dict[str, Any]:
        return {
            "id": job_id,
            "kb_id": kb_id,
            "kind": "ingest",
            "subject_type": "document_version",
            "subject_id": version_id,
            "status": "queued",
            "attempt": attempt,
            "progress": 0,
            "options": dict(options),
            "result": None,
            "created_at": now,
            "started_at": None,
            "finished_at": None,
            "error_code": None,
            "error_detail": None,
        }

    @staticmethod
    def _processing_job_from_db_row(row: sqlite3.Row) -> dict[str, Any]:
        return {
            "id": row["id"],
            "kb_id": row["kb_id"],
            "kind": row["kind"],
            "subject_type": row["subject_type"],
            "subject_id": row["subject_id"],
            "status": row["status"],
            "attempt": int(row["attempt"] or 1),
            "progress": row["progress"],
            "options": json.loads(row["options_json"]) if row["options_json"] else {},
            "result": json.loads(row["result_json"]) if row["result_json"] else None,
            "created_at": row["created_at"],
            "started_at": row["started_at"],
            "finished_at": row["finished_at"],
            "error_code": row["error_code"],
            "error_detail": (
                json.loads(row["error_detail_json"]) if row["error_detail_json"] else None
            ),
        }

    def find_processing_job_by_idempotency_key(
        self,
        kb_id: str,
        idempotency_key: str,
    ) -> dict[str, Any] | None:
        key = idempotency_key.strip()
        if not key:
            return None
        with self._lock:
            row = self._conn.execute(
                """
                SELECT id, kb_id, kind, subject_type, subject_id, status, attempt,
                       progress, error_code, error_detail_json, options_json, result_json,
                       created_at, started_at, finished_at
                FROM jobs
                WHERE kb_id = ? AND kind = 'ingest' AND idempotency_key = ?
                LIMIT 1
                """,
                (kb_id, key),
            ).fetchone()
        if row is None:
            return None
        return self._processing_job_from_db_row(row)

    def create_processing_job(
        self,
        kb_id: str,
        *,
        version_id: str,
        options: dict[str, Any],
        idempotency_key: str | None = None,
    ) -> tuple[dict[str, Any], bool]:
        """Create one immutable processing attempt for a document version.

        Returns ``(job, created)``. When ``idempotency_key`` matches an existing
        ingest job in this KB, returns that job with ``created=False``.
        """
        normalized_key = (idempotency_key or "").strip() or None
        if normalized_key:
            existing = self.find_processing_job_by_idempotency_key(kb_id, normalized_key)
            if existing is not None:
                return existing, False

        job_id = str(uuid.uuid4())
        now = _now()
        with self._lock:
            self._assert_row_in_kb("document_versions", version_id, kb_id)
            active = self._conn.execute(
                """
                SELECT id FROM jobs
                WHERE kb_id = ? AND kind = 'ingest'
                  AND subject_type = 'document_version' AND subject_id = ?
                  AND status IN ('queued', 'running')
                LIMIT 1
                """,
                (kb_id, version_id),
            ).fetchone()
            if active is not None:
                raise AdminError(409, "processing_active", "该文档版本已有处理任务")
            attempt_row = self._conn.execute(
                """
                SELECT COALESCE(MAX(attempt), 0) AS value FROM jobs
                WHERE kb_id = ? AND kind = 'ingest'
                  AND subject_type = 'document_version' AND subject_id = ?
                """,
                (kb_id, version_id),
            ).fetchone()
            attempt = int(attempt_row["value"] or 0) + 1
            try:
                self._conn.execute(
                    """
                    INSERT INTO jobs(
                        id, kb_id, kind, subject_type, subject_id, status, attempt,
                        progress, error_code, error_detail_json, idempotency_key,
                        created_at, started_at, finished_at, options_json, result_json
                    ) VALUES (?, ?, 'ingest', 'document_version', ?, 'queued', ?,
                        0, NULL, NULL, ?, ?, NULL, NULL, ?, NULL)
                    """,
                    (
                        job_id,
                        kb_id,
                        version_id,
                        attempt,
                        normalized_key,
                        now,
                        json.dumps(options, ensure_ascii=False, sort_keys=True),
                    ),
                )
            except sqlite3.IntegrityError:
                if normalized_key:
                    row = self._conn.execute(
                        """
                        SELECT id, kb_id, kind, subject_type, subject_id, status, attempt,
                               progress, error_code, error_detail_json, options_json, result_json,
                               created_at, started_at, finished_at
                        FROM jobs
                        WHERE kb_id = ? AND kind = 'ingest' AND idempotency_key = ?
                        LIMIT 1
                        """,
                        (kb_id, normalized_key),
                    ).fetchone()
                    if row is not None:
                        return self._processing_job_from_db_row(row), False
                raise
            self._conn.execute(
                """
                UPDATE document_versions
                SET status = 'queued', error_code = NULL, error_detail_json = NULL
                WHERE id = ? AND kb_id = ?
                """,
                (version_id, kb_id),
            )
            self._conn.commit()
        return (
            self._processing_job_dict(
                job_id=job_id,
                kb_id=kb_id,
                version_id=version_id,
                attempt=attempt,
                now=now,
                options=options,
            ),
            True,
        )

    def get_version(self, kb_id: str, version_id: str) -> DocumentVersionRow:
        with self._lock:
            row = self._conn.execute(
                """
                SELECT id, document_id, kb_id, version_no, sha256, blob_key, byte_size, status
                FROM document_versions
                WHERE id = ? AND kb_id = ?
                """,
                (version_id, kb_id),
            ).fetchone()
        if row is None:
            raise AdminError(404, "not_found", "文档版本不存在")
        return DocumentVersionRow(
            id=row["id"],
            document_id=row["document_id"],
            kb_id=row["kb_id"],
            version_no=row["version_no"],
            sha256=row["sha256"],
            blob_key=row["blob_key"],
            byte_size=row["byte_size"],
            status=row["status"],
        )

    def get_processing_context(self, kb_id: str, version_id: str) -> dict[str, Any]:
        with self._lock:
            row = self._conn.execute(
                """
                SELECT dv.id AS version_id, dv.status AS version_status,
                       d.id AS document_id, d.external_key, d.title, d.mime_type
                FROM document_versions dv
                INNER JOIN documents d
                  ON d.id = dv.document_id AND d.kb_id = dv.kb_id
                WHERE dv.id = ? AND dv.kb_id = ? AND d.deleted_at IS NULL
                """,
                (version_id, kb_id),
            ).fetchone()
        if row is None:
            raise AdminError(404, "not_found", "文档版本不存在")
        return {
            "version_id": row["version_id"],
            "version_status": row["version_status"],
            "document_id": row["document_id"],
            "doc_id": row["external_key"] or row["document_id"],
            "filename": row["title"],
            "mime_type": row["mime_type"],
        }

    def get_job(self, kb_id: str, job_id: str) -> JobRow:
        with self._lock:
            row = self._conn.execute(
                """
                SELECT id, kb_id, kind, subject_type, subject_id, status, attempt,
                       progress, error_code, error_detail_json, options_json, result_json,
                       created_at, started_at, finished_at
                FROM jobs WHERE id = ? AND kb_id = ?
                """,
                (job_id, kb_id),
            ).fetchone()
        if row is None:
            raise AdminError(404, "not_found", "任务不存在")
        return JobRow(
            id=row["id"],
            kb_id=row["kb_id"],
            kind=row["kind"],
            subject_type=row["subject_type"],
            subject_id=row["subject_id"],
            status=row["status"],
            attempt=int(row["attempt"] or 1),
            progress=row["progress"],
            error_code=row["error_code"],
            error_detail=json.loads(row["error_detail_json"]) if row["error_detail_json"] else None,
            options=json.loads(row["options_json"]) if row["options_json"] else {},
            result=json.loads(row["result_json"]) if row["result_json"] else None,
            created_at=row["created_at"],
            started_at=row["started_at"],
            finished_at=row["finished_at"],
        )

    def list_processing_jobs(
        self,
        kb_id: str,
        *,
        status: str | None = None,
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        limit = min(max(1, limit), 200)
        params: list[Any] = [kb_id]
        status_clause = ""
        if status:
            status_clause = " AND j.status = ?"
            params.append(status)
        params.append(limit)
        with self._lock:
            self._assert_kb_exists(kb_id)
            rows = self._conn.execute(
                f"""
                SELECT j.id, j.kind, j.subject_type, j.subject_id, j.status,
                       j.attempt, j.progress, j.error_code, j.error_detail_json,
                       j.options_json, j.result_json, j.created_at, j.started_at,
                       j.finished_at, d.id AS document_id, d.external_key,
                       d.title AS document_title, dv.status AS version_status
                FROM jobs j
                LEFT JOIN document_versions dv
                  ON dv.id = j.subject_id AND dv.kb_id = j.kb_id
                LEFT JOIN documents d
                  ON d.id = dv.document_id AND d.kb_id = j.kb_id
                WHERE j.kb_id = ? AND j.kind = 'ingest'{status_clause}
                ORDER BY j.created_at DESC
                LIMIT ?
                """,
                tuple(params),
            ).fetchall()
        return [
            {
                "id": row["id"],
                "kind": row["kind"],
                "subject_type": row["subject_type"],
                "version_id": row["subject_id"],
                "status": row["status"],
                "attempt": int(row["attempt"] or 1),
                "progress": row["progress"],
                "error_code": row["error_code"],
                "error_detail": (
                    json.loads(row["error_detail_json"])
                    if row["error_detail_json"]
                    else None
                ),
                "options": json.loads(row["options_json"]) if row["options_json"] else {},
                "result": json.loads(row["result_json"]) if row["result_json"] else None,
                "created_at": row["created_at"],
                "started_at": row["started_at"],
                "finished_at": row["finished_at"],
                "document_id": row["document_id"],
                "doc_id": row["external_key"] or row["document_id"],
                "document_title": row["document_title"] or "",
                "version_status": row["version_status"],
            }
            for row in rows
        ]

    def set_job_result(
        self, kb_id: str, job_id: str, result: dict[str, Any]
    ) -> None:
        with self._lock:
            row = self._conn.execute(
                "SELECT id FROM jobs WHERE id = ? AND kb_id = ?", (job_id, kb_id)
            ).fetchone()
            if row is None:
                raise AdminError(404, "not_found", "任务不存在")
            self._conn.execute(
                "UPDATE jobs SET result_json = ?, progress = 1 WHERE id = ? AND kb_id = ?",
                (json.dumps(result, ensure_ascii=False, default=str), job_id, kb_id),
            )
            self._conn.commit()

    def set_version_status(self, kb_id: str, version_id: str, status: str) -> None:
        allowed = {
            "uploaded",
            "queued",
            "parsing",
            "chunking",
            "embedding",
            "extracting",
            "ready",
            "failed",
            "stale",
        }
        if status not in allowed:
            raise AdminError(422, "bad_status", "版本状态无效")
        with self._lock:
            self._assert_row_in_kb("document_versions", version_id, kb_id)
            ready_at = _now() if status == "ready" else None
            if ready_at:
                self._conn.execute(
                    """
                    UPDATE document_versions
                    SET status = ?, ready_at = ?
                    WHERE id = ? AND kb_id = ?
                    """,
                    (status, ready_at, version_id, kb_id),
                )
            else:
                self._conn.execute(
                    "UPDATE document_versions SET status = ? WHERE id = ? AND kb_id = ?",
                    (status, version_id, kb_id),
                )
            self._conn.commit()

    def set_job_status(self, kb_id: str, job_id: str, status: str) -> None:
        if status not in {"queued", "running", "succeeded", "failed", "cancelled"}:
            raise AdminError(422, "bad_status", "任务状态无效")
        with self._lock:
            row = self._conn.execute(
                "SELECT id FROM jobs WHERE id = ? AND kb_id = ?", (job_id, kb_id)
            ).fetchone()
            if row is None:
                raise AdminError(404, "not_found", "任务不存在")
            started = _now() if status == "running" else None
            finished = _now() if status in {"succeeded", "failed", "cancelled"} else None
            if started:
                self._conn.execute(
                    """
                    UPDATE jobs SET status = ?, started_at = COALESCE(started_at, ?)
                    WHERE id = ? AND kb_id = ?
                    """,
                    (status, started, job_id, kb_id),
                )
            elif finished:
                self._conn.execute(
                    "UPDATE jobs SET status = ?, finished_at = ? WHERE id = ? AND kb_id = ?",
                    (status, finished, job_id, kb_id),
                )
            else:
                self._conn.execute(
                    "UPDATE jobs SET status = ? WHERE id = ? AND kb_id = ?",
                    (status, job_id, kb_id),
                )
            self._conn.commit()

    def fail_version(self, kb_id: str, version_id: str, code: str, message: str) -> None:
        with self._lock:
            self._conn.execute(
                """
                UPDATE document_versions
                SET status = 'failed', error_code = ?, error_detail_json = ?
                WHERE id = ? AND kb_id = ?
                """,
                (code, json.dumps({"message": message}, ensure_ascii=False), version_id, kb_id),
            )
            self._conn.commit()

    def fail_job(self, kb_id: str, job_id: str, code: str, message: str) -> None:
        with self._lock:
            self._conn.execute(
                """
                UPDATE jobs
                SET status = 'failed', error_code = ?, error_detail_json = ?, finished_at = ?
                WHERE id = ? AND kb_id = ?
                """,
                (
                    code,
                    json.dumps({"message": message}, ensure_ascii=False),
                    _now(),
                    job_id,
                    kb_id,
                ),
            )
            self._conn.commit()
        try:
            from basis.domain.kb.kb_alerts_emit import emit_processing_failed_alert

            emit_processing_failed_alert(self, kb_id, job_id, code, message)
        except Exception:
            import logging

            logging.getLogger(__name__).exception(
                "processing.failed alert not recorded kb_id=%s job_id=%s",
                kb_id,
                job_id,
            )

    def get_document_summary(self, kb_id: str, doc_ref: str) -> dict[str, Any] | None:
        doc = self.resolve_document_ref(kb_id, doc_ref)
        if doc is None:
            return None
        with self._lock:
            row = self._conn.execute(
                """
                SELECT d.title, d.external_key, dv.status AS version_status
                FROM documents d
                LEFT JOIN document_versions dv ON dv.id = d.current_version_id
                WHERE d.id = ? AND d.kb_id = ? AND d.deleted_at IS NULL
                """,
                (doc["document_id"], kb_id),
            ).fetchone()
        if row is None:
            return None
        doc_id = row["external_key"] or doc["document_id"]
        return {
            **doc,
            "doc_id": doc_id,
            "title": row["title"] or doc_id,
            "version_status": row["version_status"],
        }

    def resolve_document_ref(self, kb_id: str, doc_ref: str) -> dict[str, Any] | None:
        doc_ref = doc_ref.strip()
        if not doc_ref:
            return None
        by_key = self.find_document_by_external_key(kb_id, doc_ref)
        if by_key is not None:
            return by_key
        with self._lock:
            row = self._conn.execute(
                """
                SELECT d.id AS document_id, d.external_key, dv.id AS version_id
                FROM documents d
                LEFT JOIN document_versions dv ON dv.id = d.current_version_id
                WHERE d.kb_id = ? AND d.id = ? AND d.deleted_at IS NULL
                LIMIT 1
                """,
                (kb_id, doc_ref),
            ).fetchone()
        if row is None:
            return None
        return {
            "document_id": row["document_id"],
            "external_key": row["external_key"],
            "version_id": row["version_id"],
        }

    def find_document_by_external_key(self, kb_id: str, external_key: str) -> dict[str, Any] | None:
        with self._lock:
            row = self._conn.execute(
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
        if row is None:
            return None
        return {
            "document_id": row["document_id"],
            "external_key": row["external_key"],
            "version_id": row["version_id"],
        }

    def first_chunk_id_for_version(self, kb_id: str, version_id: str) -> str | None:
        with self._lock:
            row = self._conn.execute(
                """
                SELECT id FROM chunks
                WHERE kb_id = ? AND version_id = ?
                ORDER BY ordinal LIMIT 1
                """,
                (kb_id, version_id),
            ).fetchone()
        return row["id"] if row else None

    def ensure_legacy_document(
        self,
        kb_id: str,
        *,
        external_key: str,
        title: str,
        text: str,
    ) -> tuple[dict[str, Any], str, bool]:
        """Idempotent legacy import: document + ready version + one chunk (no fabricated offsets)."""
        existing = self.find_document_by_external_key(kb_id, external_key)
        if existing and existing["version_id"]:
            chunk_id = self.first_chunk_id_for_version(kb_id, existing["version_id"])
            if chunk_id:
                return existing, chunk_id, False

        document_id, version_id, job_id, _blob = self.store_upload_bytes(
            kb_id,
            title=title,
            mime_type="text/plain",
            data=text.encode("utf-8"),
            created_by=None,
            original_filename=title,
            external_key=external_key,
        )
        self.set_version_status(kb_id, version_id, "ready")
        self.set_job_status(kb_id, job_id, "succeeded")
        chunk_id = self.create_chunk(kb_id, version_id, ordinal=0, text=text)
        row = {
            "document_id": document_id,
            "external_key": external_key,
            "version_id": version_id,
        }
        return row, chunk_id, True

    def hard_delete_document(self, kb_id: str, document_id: str) -> dict[str, Any]:
        from basis.domain.kb.document_delete import execute_hard_delete_document

        return execute_hard_delete_document(self, kb_id, document_id)

    def preview_entity_deletion(self, kb_id: str, entity_id: str) -> dict[str, Any]:
        from basis.domain.kb.entity_delete import preview_entity_deletion

        return preview_entity_deletion(self, kb_id, entity_id)

    def delete_entity(self, kb_id: str, entity_id: str) -> dict[str, Any]:
        from basis.domain.kb.entity_delete import execute_delete_entity

        return execute_delete_entity(self, kb_id, entity_id)

    def list_documents(self, kb_id: str) -> list[dict[str, Any]]:
        with self._lock:
            rows = self._conn.execute(
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
            items: list[dict[str, Any]] = []
            for row in rows:
                doc_id = row["external_key"] or row["id"]
                preview = ""
                char_count = 0
                if row["version_id"]:
                    chunk = self._conn.execute(
                        """
                        SELECT text FROM chunks
                        WHERE version_id = ? AND kb_id = ?
                        ORDER BY ordinal LIMIT 1
                        """,
                        (row["version_id"], kb_id),
                    ).fetchone()
                    if chunk:
                        preview = (chunk["text"] or "")[:200]
                        char_count = len(chunk["text"] or "")
                items.append(
                    {
                        "doc_id": doc_id,
                        "document_id": row["id"],
                        "filename": _uploaded_filename(row["title"], row["external_key"]),
                        "preview": preview,
                        "char_count": char_count,
                        "version_status": row["version_status"],
                        "version_id": row["version_id"],
                        "version_no": row["version_no"],
                        "created_at": row["created_at"],
                        "updated_at": row["version_created_at"] or row["created_at"],
                    }
                )
        return items

    def read_version_bytes(self, kb_id: str, version_id: str) -> bytes:
        version = self.get_version(kb_id, version_id)
        return self._blob_store.read(version.kb_id, version.blob_key)

    def list_chunks_for_version(self, kb_id: str, version_id: str) -> list[dict[str, Any]]:
        with self._lock:
            self._assert_row_in_kb("document_versions", version_id, kb_id)
            rows = self._conn.execute(
                """
                SELECT id, ordinal, text, heading, char_start, char_end,
                       token_count, language, origin, anchor_json, created_at
                FROM chunks
                WHERE kb_id = ? AND version_id = ?
                ORDER BY ordinal
                """,
                (kb_id, version_id),
            ).fetchall()
        return [_chunk_api_row(r) for r in rows]

    def get_or_create_entity_by_label(self, kb_id: str, label: str) -> str:
        clean = label.strip()
        if not clean:
            raise AdminError(422, "bad_entity", "实体名称无效")
        with self._lock:
            row = self._conn.execute(
                """
                SELECT id FROM entities
                WHERE kb_id = ? AND canonical_label = ? AND invalidated_at IS NULL
                LIMIT 1
                """,
                (kb_id, clean),
            ).fetchone()
        if row is not None:
            return row["id"]
        return self.create_entity(kb_id, canonical_label=clean)

    def has_statement_on_chunk(
        self,
        kb_id: str,
        chunk_id: str,
        subject_id: str,
        surface_phrase: str,
        *,
        object_entity_id: str | None,
        object_value: str | None,
    ) -> bool:
        with self._lock:
            if object_entity_id is not None:
                row = self._conn.execute(
                    """
                    SELECT s.id FROM statements s
                    INNER JOIN statement_evidence e ON e.statement_id = s.id AND e.chunk_id = ?
                    WHERE s.kb_id = ? AND s.subject_id = ? AND s.surface_phrase = ?
                      AND s.object_entity_id = ? AND s.invalidated_at IS NULL
                    LIMIT 1
                    """,
                    (chunk_id, kb_id, subject_id, surface_phrase, object_entity_id),
                ).fetchone()
            else:
                row = self._conn.execute(
                    """
                    SELECT s.id FROM statements s
                    INNER JOIN statement_evidence e ON e.statement_id = s.id AND e.chunk_id = ?
                    WHERE s.kb_id = ? AND s.subject_id = ? AND s.surface_phrase = ?
                      AND s.object_value = ? AND s.invalidated_at IS NULL
                    LIMIT 1
                    """,
                    (chunk_id, kb_id, subject_id, surface_phrase, object_value),
                ).fetchone()
        return row is not None

    def has_equivalent_statement(
        self,
        kb_id: str,
        subject_id: str,
        surface_phrase: str,
        *,
        object_entity_id: str | None,
        object_value: str | None,
    ) -> bool:
        """True when an active statement already asserts the same triple in this KB."""
        with self._lock:
            if object_entity_id is not None:
                row = self._conn.execute(
                    """
                    SELECT id FROM statements
                    WHERE kb_id = ? AND subject_id = ? AND surface_phrase = ?
                      AND object_entity_id = ? AND invalidated_at IS NULL
                      AND status IN ('pending', 'confirmed')
                    LIMIT 1
                    """,
                    (kb_id, subject_id, surface_phrase, object_entity_id),
                ).fetchone()
            else:
                row = self._conn.execute(
                    """
                    SELECT id FROM statements
                    WHERE kb_id = ? AND subject_id = ? AND surface_phrase = ?
                      AND object_value = ? AND invalidated_at IS NULL
                      AND status IN ('pending', 'confirmed')
                    LIMIT 1
                    """,
                    (kb_id, subject_id, surface_phrase, object_value),
                ).fetchone()
        return row is not None

    def add_extraction_drop(
        self,
        kb_id: str,
        version_id: str,
        chunk_id: str | None,
        code: str,
        detail: dict[str, Any],
        *,
        severity: str = "drop",
    ) -> str:
        drop_id = str(uuid.uuid4())
        with self._lock:
            self._assert_kb_exists(kb_id)
            self._assert_row_in_kb("document_versions", version_id, kb_id)
            if chunk_id:
                self._assert_row_in_kb("chunks", chunk_id, kb_id)
            self._conn.execute(
                """
                INSERT INTO extraction_drops(
                    id, kb_id, version_id, chunk_id, code, severity, detail_json, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    drop_id,
                    kb_id,
                    version_id,
                    chunk_id,
                    code,
                    severity,
                    json.dumps(detail, ensure_ascii=False, default=str),
                    _now(),
                ),
            )
            self._conn.commit()
        return drop_id

    def count_statements_for_version(self, kb_id: str, version_id: str) -> int:
        with self._lock:
            row = self._conn.execute(
                """
                SELECT COUNT(*) AS n
                FROM statements s
                INNER JOIN statement_evidence e ON e.statement_id = s.id
                INNER JOIN chunks c ON c.id = e.chunk_id
                WHERE c.kb_id = ? AND c.version_id = ? AND s.invalidated_at IS NULL
                """,
                (kb_id, version_id),
            ).fetchone()
        return int(row["n"])

    def create_entity(
        self,
        kb_id: str,
        *,
        canonical_label: str | None = None,
        description: str | None = None,
        entity_kind: str = "named",
    ) -> str:
        if entity_kind not in {"named", "described"}:
            raise AdminError(422, "bad_entity_kind", "实体类型无效")
        entity_id = str(uuid.uuid4())
        with self._lock:
            self._assert_kb_exists(kb_id)
            self._conn.execute(
                """
                INSERT INTO entities(
                    id, kb_id, canonical_label, description, entity_kind, created_at, invalidated_at
                ) VALUES (?, ?, ?, ?, ?, ?, NULL)
                """,
                (entity_id, kb_id, canonical_label, description, entity_kind, _now()),
            )
            self._conn.commit()
        return entity_id

    def add_open_statement(
        self,
        kb_id: str,
        *,
        subject_id: str,
        surface_phrase: str,
        object_entity_id: str | None,
        object_value: str | None,
        status: str,
        proposed_by: str,
        chunk_id: str,
        quote: str,
        quote_start: int | None = None,
        quote_end: int | None = None,
        confidence: float | None = None,
    ) -> str:
        if bool(object_entity_id) == bool(object_value):
            raise AdminError(422, "bad_statement", "陈述必须指定对象实体或对象值之一")
        if status not in {"pending", "confirmed", "rejected", "invalidated", "superseded"}:
            raise AdminError(422, "bad_status", "陈述状态无效")
        statement_id = str(uuid.uuid4())
        evidence_id = str(uuid.uuid4())
        now = _now()
        with self._lock:
            self._assert_row_in_kb("entities", subject_id, kb_id)
            if object_entity_id:
                self._assert_row_in_kb("entities", object_entity_id, kb_id)
            self._assert_row_in_kb("chunks", chunk_id, kb_id)
            if quote_start is not None and quote_end is not None:
                self._validate_quote_in_chunk(chunk_id, quote, quote_start, quote_end)
            self._conn.execute(
                """
                INSERT INTO statements(
                    id, kb_id, subject_id, surface_phrase, object_entity_id, object_value,
                    object_datatype, confidence, status, proposed_by, recorded_at,
                    invalidated_at, supersedes_id
                ) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, NULL, NULL)
                """,
                (
                    statement_id,
                    kb_id,
                    subject_id,
                    surface_phrase,
                    object_entity_id,
                    object_value,
                    confidence,
                    status,
                    proposed_by,
                    now,
                ),
            )
            self._conn.execute(
                """
                INSERT INTO statement_evidence(
                    id, kb_id, statement_id, chunk_id, quote, quote_start, quote_end, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (evidence_id, kb_id, statement_id, chunk_id, quote, quote_start, quote_end, now),
            )
            self._conn.commit()
        return statement_id

    def create_chunk(
        self,
        kb_id: str,
        version_id: str,
        *,
        ordinal: int,
        text: str,
        heading: str | None = None,
        char_start: int | None = None,
        char_end: int | None = None,
        token_count: int | None = None,
        language: str | None = None,
        origin: str = "stated",
        anchor_json: str | None = None,
    ) -> str:
        chunk_id = str(uuid.uuid4())
        with self._lock:
            self._assert_row_in_kb("document_versions", version_id, kb_id)
            self._conn.execute(
                """
                INSERT INTO chunks(
                    id, kb_id, version_id, ordinal, text, heading,
                    char_start, char_end, token_count, language, origin, anchor_json, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    chunk_id,
                    kb_id,
                    version_id,
                    ordinal,
                    text,
                    heading,
                    char_start,
                    char_end,
                    token_count,
                    language,
                    origin or "stated",
                    anchor_json,
                    _now(),
                ),
            )
            self._conn.commit()
        return chunk_id

    def create_chunks(
        self,
        kb_id: str,
        version_id: str,
        texts: list[str] | list[dict[str, Any]],
    ) -> list[str]:
        """Insert one version's chunks in a single transaction."""
        if not texts:
            return []
        now = _now()
        chunk_ids = [str(uuid.uuid4()) for _ in texts]
        rows = []
        for ordinal, (chunk_id, item) in enumerate(zip(chunk_ids, texts)):
            payload = _chunk_payload(item)
            rows.append(
                (
                    chunk_id,
                    kb_id,
                    version_id,
                    ordinal,
                    payload["text"],
                    payload["heading"],
                    payload["char_start"],
                    payload["char_end"],
                    payload["token_count"],
                    payload["language"],
                    payload["origin"],
                    payload["anchor_json"],
                    now,
                )
            )
        with self._lock:
            self._assert_row_in_kb("document_versions", version_id, kb_id)
            self._conn.executemany(
                """
                INSERT INTO chunks(
                    id, kb_id, version_id, ordinal, text, heading,
                    char_start, char_end, token_count, language, origin,
                    anchor_json, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                rows,
            )
            self._conn.commit()
        return chunk_ids

    PROJECTION_SCHEMA_VERSION = 1

    def get_ledger_temporal_bounds(self, kb_id: str) -> dict[str, str | None]:
        """Earliest/latest instants in the ledger (including invalidated_at for valid_until bounds)."""
        with self._lock:
            self._assert_kb_exists(kb_id)
            row = self._conn.execute(
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

    def ensure_projection_state(self, kb_id: str) -> None:
        with self._lock:
            self._assert_kb_exists(kb_id)
            self._conn.execute(
                """
                INSERT OR IGNORE INTO projection_state(
                    kb_id, revision, schema_version, status, last_built_at, last_error_code
                ) VALUES (?, 0, ?, 'dirty', NULL, NULL)
                """,
                (kb_id, self.PROJECTION_SCHEMA_VERSION),
            )
            self._conn.commit()

    def get_projection_state(self, kb_id: str) -> dict[str, Any]:
        with self._lock:
            self._assert_kb_exists(kb_id)
            self._conn.execute(
                """
                INSERT OR IGNORE INTO projection_state(
                    kb_id, revision, schema_version, status, last_built_at, last_error_code
                ) VALUES (?, 0, ?, 'dirty', NULL, NULL)
                """,
                (kb_id, self.PROJECTION_SCHEMA_VERSION),
            )
            self._conn.commit()
            row = self._conn.execute(
                """
                SELECT revision, schema_version, status, last_built_at, last_error_code
                FROM projection_state WHERE kb_id = ?
                """,
                (kb_id,),
            ).fetchone()
        if row is None:
            raise AdminError(404, "not_found", "投影状态不存在")
        return {
            "revision": int(row["revision"]),
            "schema_version": int(row["schema_version"]),
            "status": row["status"],
            "last_built_at": row["last_built_at"],
            "last_error_code": row["last_error_code"],
        }

    def set_projection_status(
        self,
        kb_id: str,
        status: str,
        *,
        error_code: str | None = None,
    ) -> None:
        if status not in {"dirty", "building", "clean", "failed"}:
            raise AdminError(422, "bad_status", "投影状态无效")
        self.ensure_projection_state(kb_id)
        with self._lock:
            self._conn.execute(
                """
                UPDATE projection_state
                SET status = ?, last_error_code = ?
                WHERE kb_id = ?
                """,
                (status, error_code, kb_id),
            )
            self._conn.commit()

    def bump_projection_revision(self, kb_id: str) -> int:
        self.ensure_projection_state(kb_id)
        now = _now()
        with self._lock:
            self._conn.execute(
                """
                UPDATE projection_state
                SET revision = revision + 1,
                    status = 'clean',
                    last_built_at = ?,
                    last_error_code = NULL,
                    schema_version = ?
                WHERE kb_id = ?
                """,
                (now, self.PROJECTION_SCHEMA_VERSION, kb_id),
            )
            row = self._conn.execute(
                "SELECT revision FROM projection_state WHERE kb_id = ?", (kb_id,)
            ).fetchone()
            self._conn.commit()
        return int(row["revision"])

    def list_ready_documents_for_projection(
        self,
        kb_id: str,
        *,
        include_version_ids: tuple[str, ...] | None = None,
    ) -> list[dict[str, Any]]:
        with self._lock:
            extra = tuple(v for v in (include_version_ids or ()) if v)
            if extra:
                placeholders = ", ".join("?" for _ in extra)
                status_clause = f"(dv.status = 'ready' OR dv.id IN ({placeholders}))"
                params: tuple[Any, ...] = (kb_id, *extra)
            else:
                status_clause = "dv.status = 'ready'"
                params = (kb_id,)
            rows = self._conn.execute(
                f"""
                SELECT d.id AS document_id, d.external_key, dv.id AS version_id,
                       dv.created_at AS version_created_at
                FROM documents d
                INNER JOIN document_versions dv ON dv.id = d.current_version_id
                WHERE d.kb_id = ? AND d.deleted_at IS NULL AND {status_clause}
                ORDER BY d.created_at ASC
                """,
                params,
            ).fetchall()
            items: list[dict[str, Any]] = []
            for row in rows:
                version_id = row["version_id"]
                chunks = self._conn.execute(
                    """
                    SELECT text FROM chunks
                    WHERE kb_id = ? AND version_id = ?
                    ORDER BY ordinal
                    """,
                    (kb_id, version_id),
                ).fetchall()
                text = "\n\n".join(c["text"] or "" for c in chunks)
                graph_doc_id = row["external_key"] or row["document_id"]
                items.append(
                    {
                        "document_id": row["document_id"],
                        "version_id": version_id,
                        "graph_doc_id": graph_doc_id,
                        "text": text,
                        "version_created_at": row["version_created_at"],
                    }
                )
        return items

    def list_entities_for_projection(self, kb_id: str) -> list[dict[str, Any]]:
        with self._lock:
            rows = self._conn.execute(
                """
                SELECT id, canonical_label, description, entity_kind, created_at
                FROM entities
                WHERE kb_id = ? AND invalidated_at IS NULL
                ORDER BY created_at ASC
                """,
                (kb_id,),
            ).fetchall()
        return [dict(r) for r in rows]

    def list_statements_for_projection(self, kb_id: str) -> list[dict[str, Any]]:
        with self._lock:
            rows = self._conn.execute(
                """
                SELECT
                    s.id AS statement_id,
                    s.subject_id,
                    s.surface_phrase,
                    s.object_entity_id,
                    s.object_value,
                    s.confidence,
                    s.status,
                    s.recorded_at,
                    e.id AS evidence_id,
                    e.chunk_id,
                    d.external_key,
                    d.id AS ledger_document_id
                FROM statements s
                LEFT JOIN statement_evidence e ON e.statement_id = s.id AND e.kb_id = s.kb_id
                LEFT JOIN chunks c ON c.id = e.chunk_id
                LEFT JOIN document_versions dv ON dv.id = c.version_id
                LEFT JOIN documents d ON d.id = dv.document_id
                WHERE s.kb_id = ?
                  AND s.invalidated_at IS NULL
                  AND s.status IN ('pending', 'confirmed')
                ORDER BY s.recorded_at ASC
                """,
                (kb_id,),
            ).fetchall()
            items: list[dict[str, Any]] = []
            for row in rows:
                graph_doc_id = row["external_key"] or row["ledger_document_id"]
                items.append(
                    {
                        "statement_id": row["statement_id"],
                        "subject_id": row["subject_id"],
                        "surface_phrase": row["surface_phrase"],
                        "object_entity_id": row["object_entity_id"],
                        "object_value": row["object_value"],
                        "confidence": row["confidence"],
                        "status": row["status"],
                        "evidence_id": row["evidence_id"],
                        "chunk_id": row["chunk_id"],
                        "graph_doc_id": graph_doc_id,
                        "recorded_at": row["recorded_at"],
                    }
                )
        return items

    def list_statements_for_temporal_projection(self, kb_id: str) -> list[dict[str, Any]]:
        """Statements for graph projection including invalidated rows (F-TIM-01 valid_until)."""
        with self._lock:
            rows = self._conn.execute(
                """
                SELECT
                    s.id AS statement_id,
                    s.subject_id,
                    s.surface_phrase,
                    s.object_entity_id,
                    s.object_value,
                    s.confidence,
                    s.status,
                    s.recorded_at,
                    s.invalidated_at,
                    e.id AS evidence_id,
                    e.chunk_id,
                    d.external_key,
                    d.id AS ledger_document_id
                FROM statements s
                LEFT JOIN statement_evidence e ON e.statement_id = s.id AND e.kb_id = s.kb_id
                LEFT JOIN chunks c ON c.id = e.chunk_id
                LEFT JOIN document_versions dv ON dv.id = c.version_id
                LEFT JOIN documents d ON d.id = dv.document_id
                WHERE s.kb_id = ?
                  AND s.status IN ('pending', 'confirmed', 'invalidated', 'superseded')
                ORDER BY s.recorded_at ASC
                """,
                (kb_id,),
            ).fetchall()
            items: list[dict[str, Any]] = []
            for row in rows:
                graph_doc_id = row["external_key"] or row["ledger_document_id"]
                items.append(
                    {
                        "statement_id": row["statement_id"],
                        "subject_id": row["subject_id"],
                        "surface_phrase": row["surface_phrase"],
                        "object_entity_id": row["object_entity_id"],
                        "object_value": row["object_value"],
                        "confidence": row["confidence"],
                        "status": row["status"],
                        "evidence_id": row["evidence_id"],
                        "chunk_id": row["chunk_id"],
                        "graph_doc_id": graph_doc_id,
                        "recorded_at": row["recorded_at"],
                        "invalidated_at": row["invalidated_at"],
                    }
                )
        return items

    def list_entities_for_temporal_projection(self, kb_id: str) -> list[dict[str, Any]]:
        """Entities for temporal graph projection including invalidated rows (F-TIM-01 valid_until)."""
        with self._lock:
            rows = self._conn.execute(
                """
                SELECT id, canonical_label, description, entity_kind, created_at, invalidated_at
                FROM entities
                WHERE kb_id = ?
                ORDER BY created_at ASC
                """,
                (kb_id,),
            ).fetchall()
        return [dict(r) for r in rows]

    def list_typed_facts_for_temporal_projection(self, kb_id: str) -> list[dict[str, Any]]:
        """Typed facts for temporal graph projection including invalidated rows (F-TIM-01 valid_until)."""
        with self._lock:
            self._assert_kb_exists(kb_id)
            rows = self._conn.execute(
                """
                SELECT id, subject_id, predicate_uri, object_entity_id, object_value,
                       mapping_id, confidence, recorded_at, invalidated_at
                FROM typed_facts
                WHERE kb_id = ?
                ORDER BY recorded_at ASC
                """,
                (kb_id,),
            ).fetchall()
        return [
            {
                "id": row["id"],
                "subject_id": row["subject_id"],
                "predicate_uri": row["predicate_uri"],
                "object_entity_id": row["object_entity_id"],
                "object_value": row["object_value"],
                "mapping_id": row["mapping_id"],
                "confidence": row["confidence"],
                "recorded_at": row["recorded_at"],
                "invalidated_at": row["invalidated_at"],
            }
            for row in rows
        ]

    def list_derived_facts_for_temporal_projection(self, kb_id: str) -> list[dict[str, Any]]:
        """Derived facts for temporal graph projection including invalidated rows (F-TIM-01 valid_until)."""
        with self._lock:
            self._assert_kb_exists(kb_id)
            rows = self._conn.execute(
                """
                SELECT id, subject_id, predicate_uri, object_entity_id, object_value, rule_id,
                       recorded_at, invalidated_at
                FROM derived_facts
                WHERE kb_id = ?
                ORDER BY recorded_at ASC
                """,
                (kb_id,),
            ).fetchall()
        return [
            {
                "id": row["id"],
                "subject_id": row["subject_id"],
                "predicate_uri": row["predicate_uri"],
                "object_entity_id": row["object_entity_id"],
                "object_value": row["object_value"],
                "rule_id": row["rule_id"],
                "recorded_at": row["recorded_at"],
                "invalidated_at": row["invalidated_at"],
            }
            for row in rows
        ]

    def list_document_timeline_events(
        self,
        kb_id: str,
        document_id: str,
        *,
        limit: int = 200,
    ) -> list[dict[str, Any]]:
        """Ledger-ordered events for one document (F-TIM-02)."""
        limit = min(max(1, limit), 500)
        events: list[dict[str, Any]] = []
        with self._lock:
            self._assert_kb_exists(kb_id)
            doc = self._conn.execute(
                """
                SELECT id, external_key, title, created_at
                FROM documents
                WHERE kb_id = ? AND id = ? AND deleted_at IS NULL
                """,
                (kb_id, document_id),
            ).fetchone()
            if doc is None:
                return []
            version_rows = self._conn.execute(
                """
                SELECT id, status, created_at, byte_size
                FROM document_versions
                WHERE kb_id = ? AND document_id = ?
                ORDER BY created_at ASC
                """,
                (kb_id, document_id),
            ).fetchall()
            version_ids = [row["id"] for row in version_rows]
            for row in version_rows:
                events.append(
                    {
                        "kind": "version_created",
                        "at": row["created_at"],
                        "version_id": row["id"],
                        "status": row["status"],
                        "byte_size": row["byte_size"],
                    }
                )
            if version_ids:
                placeholders = ",".join("?" for _ in version_ids)
                job_rows = self._conn.execute(
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
                for row in job_rows:
                    events.append(
                        {
                            "kind": "processing_job",
                            "at": row["finished_at"] or row["created_at"],
                            "job_id": row["id"],
                            "status": row["status"],
                            "error_code": row["error_code"],
                        }
                    )
                stmt_rows = self._conn.execute(
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
                for row in stmt_rows:
                    events.append(
                        {
                            "kind": "statement_recorded",
                            "at": row["recorded_at"],
                            "statement_id": row["id"],
                            "surface_phrase": row["surface_phrase"],
                            "status": row["status"],
                            "invalidated_at": row["invalidated_at"],
                            "chunk_id": row["chunk_id"],
                        }
                    )
                mention_rows = self._conn.execute(
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
                for row in mention_rows:
                    events.append(
                        {
                            "kind": "time_mention",
                            "at": row["statement_at"],
                            "mention_id": row["id"],
                            "text": row["text"],
                            "char_start": row["char_start"],
                            "char_end": row["char_end"],
                            "chunk_id": row["chunk_id"],
                        }
                    )
        events.sort(key=lambda ev: str(ev.get("at") or ""))
        return events[-limit:]

    def list_active_statements(self, kb_id: str) -> list[dict[str, Any]]:
        with self._lock:
            self._assert_kb_exists(kb_id)
            rows = self._conn.execute(
                """
                SELECT id AS statement_id, subject_id, surface_phrase,
                       object_entity_id, object_value, status
                FROM statements
                WHERE kb_id = ?
                  AND invalidated_at IS NULL
                  AND status IN ('pending', 'confirmed')
                ORDER BY recorded_at ASC
                """,
                (kb_id,),
            ).fetchall()
        return [dict(row) for row in rows]

    def set_statement_status(self, kb_id: str, statement_id: str, status: str) -> None:
        allowed = {"pending", "confirmed", "rejected", "invalidated", "superseded"}
        if status not in allowed:
            raise AdminError(422, "bad_status", "陈述状态无效")
        now = _now()
        with self._lock:
            row = self._conn.execute(
                "SELECT kb_id, status FROM statements WHERE id = ?", (statement_id,)
            ).fetchone()
            if row is None:
                raise AdminError(404, "not_found", "陈述不存在")
            if row["kb_id"] != kb_id:
                raise AdminError(403, "forbidden", "记录不属于该知识库")
            if row["status"] != "pending" and status in {"confirmed", "rejected"}:
                raise AdminError(409, "statement_not_pending", "陈述已处理")
            invalidated_at = now if status in {"invalidated", "rejected", "superseded"} else None
            self._conn.execute(
                """
                UPDATE statements
                SET status = ?, invalidated_at = COALESCE(?, invalidated_at)
                WHERE id = ? AND kb_id = ?
                """,
                (status, invalidated_at, statement_id, kb_id),
            )
            self._conn.commit()

    def invalidate_statement(self, kb_id: str, statement_id: str) -> None:
        now = _now()
        with self._lock:
            row = self._conn.execute(
                "SELECT kb_id FROM statements WHERE id = ?", (statement_id,)
            ).fetchone()
            if row is None:
                raise AdminError(404, "not_found", "陈述不存在")
            if row["kb_id"] != kb_id:
                raise AdminError(403, "forbidden", "记录不属于该知识库")
            self._conn.execute(
                """
                UPDATE statements
                SET status = 'invalidated', invalidated_at = ?
                WHERE id = ? AND kb_id = ?
                """,
                (now, statement_id, kb_id),
            )
            self._conn.commit()

    def count_entities_named(self, kb_id: str, label: str) -> int:
        with self._lock:
            row = self._conn.execute(
                """
                SELECT COUNT(*) AS n FROM entities
                WHERE kb_id = ? AND canonical_label = ? AND invalidated_at IS NULL
                """,
                (kb_id, label),
            ).fetchone()
        return int(row["n"])

    def kb_mcp_stats(self, kb_id: str) -> dict[str, int]:
        with self._lock:
            docs = self._conn.execute(
                "SELECT COUNT(*) AS n FROM documents WHERE kb_id = ?", (kb_id,)
            ).fetchone()["n"]
            chunks = self._conn.execute(
                "SELECT COUNT(*) AS n FROM chunks WHERE kb_id = ?", (kb_id,)
            ).fetchone()["n"]
            entities = self._conn.execute(
                """
                SELECT COUNT(*) AS n FROM entities
                WHERE kb_id = ? AND invalidated_at IS NULL
                """,
                (kb_id,),
            ).fetchone()["n"]
            statements = self._conn.execute(
                """
                SELECT COUNT(*) AS n FROM statements
                WHERE kb_id = ? AND invalidated_at IS NULL
                """,
                (kb_id,),
            ).fetchone()["n"]
        return {
            "document_count": int(docs),
            "chunk_count": int(chunks),
            "entity_count": int(entities),
            "statement_count": int(statements),
        }

    def get_search_config(self, kb_id: str) -> SearchConfig:
        """Return the persisted policy, creating the SQLite default on first use."""
        with self._lock:
            self._assert_kb_exists(kb_id)
            row = self._conn.execute(
                "SELECT * FROM kb_search_configs WHERE kb_id = ?", (kb_id,)
            ).fetchone()
            if row is None:
                now = _now()
                chunk_backend = (
                    "postgres_ledger"
                    if self._db.backend == "postgres"
                    else "sqlite_ledger"
                )
                vector_backend = (
                    "pgvector" if self._db.backend == "postgres" else "sqlite_vec"
                )
                self._conn.execute(
                    """
                    INSERT INTO kb_search_configs (
                        kb_id, schema_version, chunk_backend, vector_backend,
                        embedding_model_id, keyword_enabled, semantic_enabled,
                        default_mode, auto_index, created_at, updated_at
                    ) VALUES (?, 1, ?, ?, NULL, 1, 1, 'hybrid', 1, ?, ?)
                    """,
                    (kb_id, chunk_backend, vector_backend, now, now),
                )
                self._conn.commit()
                return SearchConfig(
                    kb_id=kb_id,
                    chunk_backend=chunk_backend,
                    vector_backend=vector_backend,
                )
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

    def update_search_config(
        self,
        kb_id: str,
        *,
        embedding_model_id: str | None,
        keyword_enabled: bool,
        semantic_enabled: bool,
        default_mode: str,
        auto_index: bool,
        chunk_backend: str = "sqlite_ledger",
        vector_backend: str = "sqlite_vec",
    ) -> SearchConfig:
        config = SearchConfig(
            kb_id=kb_id,
            chunk_backend=chunk_backend,
            vector_backend=vector_backend,
            embedding_model_id=embedding_model_id or None,
            keyword_enabled=keyword_enabled,
            semantic_enabled=semantic_enabled,
            default_mode=default_mode,  # type: ignore[arg-type]
            auto_index=auto_index,
        )
        validate_search_config(config)
        expected_chunk_backend = (
            "postgres_ledger" if self._db.backend == "postgres" else "sqlite_ledger"
        )
        if config.chunk_backend != expected_chunk_backend:
            raise AdminError(
                422,
                "chunk_backend_mismatch",
                "Chunk 存储必须与当前部署的 canonical 数据库一致",
            )
        with self._lock:
            self._assert_kb_exists(kb_id)
            now = _now()
            self._conn.execute(
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
                    kb_id,
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
            self._conn.commit()
        return config

    def search_chunks_keyword(
        self, kb_id: str, *, query: str, limit: int = 10
    ) -> list[dict[str, Any]]:
        query = query.strip()
        if not query:
            return []
        limit = min(max(1, limit), 50)
        if self._db.backend == "postgres":
            return self._search_chunks_postgres(kb_id, query=query, limit=limit)
        if len(query) >= 3:
            try:
                return self._search_chunks_fts(kb_id, query=query, limit=limit)
            except sqlite3.OperationalError:
                # Existing processes may briefly run before migration 0005 has
                # been applied; retain a correct, slower fallback.
                pass
        return self._search_chunks_like(kb_id, query=query, limit=limit)

    def _search_chunks_postgres(
        self, kb_id: str, *, query: str, limit: int
    ) -> list[dict[str, Any]]:
        escaped = (
            query.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        )
        pattern = f"%{escaped}%"
        with self._lock:
            self._assert_kb_exists(kb_id)
            rows = self._conn.execute(
                """
                WITH ranked AS MATERIALIZED (
                    SELECT id AS chunk_id, 1 - (text <-> ?) AS keyword_score
                    FROM chunks
                    WHERE kb_id = ? AND text ILIKE ? ESCAPE '\\'
                    ORDER BY text <-> ?, created_at DESC
                    LIMIT ?
                )
                SELECT c.id AS chunk_id, c.ordinal, c.text,
                       d.id AS document_id, d.title AS document_title,
                       ranked.keyword_score
                FROM ranked
                INNER JOIN chunks c ON c.id = ranked.chunk_id
                INNER JOIN document_versions dv
                    ON dv.id = c.version_id AND dv.kb_id = c.kb_id
                INNER JOIN documents d
                    ON d.id = dv.document_id AND d.kb_id = c.kb_id
                ORDER BY ranked.keyword_score DESC, c.created_at DESC
                """,
                (query, kb_id, pattern, query, limit),
            ).fetchall()
        return [self._chunk_hit_from_row(row) for row in rows]

    def _search_chunks_fts(
        self, kb_id: str, *, query: str, limit: int
    ) -> list[dict[str, Any]]:
        # A quoted phrase preserves the previous LIKE substring semantics and
        # prevents user input from being interpreted as FTS query operators.
        escaped_query = query.replace('"', '""')
        match_query = f'"{escaped_query}"'
        with self._lock:
            self._assert_kb_exists(kb_id)
            rows = self._conn.execute(
                """
                WITH ranked AS MATERIALIZED (
                    SELECT chunk_id, -rank AS keyword_score
                    FROM chunks_fts
                    WHERE chunks_fts MATCH ? AND chunks_fts.kb_id = ?
                    ORDER BY rank
                    LIMIT ?
                )
                SELECT c.id AS chunk_id, c.ordinal, c.text,
                       d.id AS document_id, d.title AS document_title,
                       ranked.keyword_score
                FROM ranked
                INNER JOIN chunks c ON c.id = ranked.chunk_id
                INNER JOIN document_versions dv
                    ON dv.id = c.version_id AND dv.kb_id = c.kb_id
                INNER JOIN documents d
                    ON d.id = dv.document_id AND d.kb_id = c.kb_id
                ORDER BY ranked.keyword_score DESC, c.created_at DESC
                """,
                (match_query, kb_id, limit),
            ).fetchall()
        return [self._chunk_hit_from_row(row) for row in rows]

    def _search_chunks_like(
        self, kb_id: str, *, query: str, limit: int
    ) -> list[dict[str, Any]]:
        pattern = f"%{query.replace('%', '')}%"
        with self._lock:
            self._assert_kb_exists(kb_id)
            rows = self._conn.execute(
                """
                SELECT c.id AS chunk_id, c.ordinal, c.text, d.id AS document_id, d.title AS document_title
                FROM chunks c
                INNER JOIN document_versions dv ON dv.id = c.version_id AND dv.kb_id = c.kb_id
                INNER JOIN documents d ON d.id = dv.document_id AND d.kb_id = c.kb_id
                WHERE c.kb_id = ? AND c.text LIKE ?
                ORDER BY c.created_at DESC
                LIMIT ?
                """,
                (kb_id, pattern, limit),
            ).fetchall()
        return [self._chunk_hit_from_row(row) for row in rows]

    def search_chunks(self, kb_id: str, *, query: str, limit: int = 10) -> list[dict[str, Any]]:
        return self.search_chunks_keyword(kb_id, query=query, limit=limit)

    @staticmethod
    def _chunk_hit_from_row(row: sqlite3.Row) -> dict[str, Any]:
        text = row["text"] or ""
        hit = {
            "chunk_id": row["chunk_id"],
            "document_id": row["document_id"],
            "document_title": row["document_title"] or "",
            "ordinal": row["ordinal"],
            "text": text,
            "snippet": text[:400],
        }
        if "keyword_score" in row.keys():
            hit["keyword_score"] = float(row["keyword_score"])
        return hit

    def get_chunks_by_ids(self, kb_id: str, chunk_ids: list[str]) -> list[dict[str, Any]]:
        if not chunk_ids:
            return []
        placeholders = ",".join("?" * len(chunk_ids))
        with self._lock:
            rows = self._conn.execute(
                f"""
                SELECT c.id AS chunk_id, c.ordinal, c.text, d.id AS document_id, d.title AS document_title
                FROM chunks c
                INNER JOIN document_versions dv ON dv.id = c.version_id AND dv.kb_id = c.kb_id
                INNER JOIN documents d ON d.id = dv.document_id AND d.kb_id = c.kb_id
                WHERE c.kb_id = ? AND c.id IN ({placeholders})
                """,
                (kb_id, *chunk_ids),
            ).fetchall()
        return [self._chunk_hit_from_row(row) for row in rows]

    def list_chunks_for_indexing(
        self, kb_id: str, chunk_ids: list[str] | None = None
    ) -> list[dict[str, Any]]:
        with self._lock:
            self._assert_kb_exists(kb_id)
            if chunk_ids:
                placeholders = ",".join("?" * len(chunk_ids))
                rows = self._conn.execute(
                    f"""
                    SELECT c.id AS chunk_id, c.version_id, c.text,
                           d.id AS document_id, d.title AS document_title
                    FROM chunks c
                    INNER JOIN document_versions dv ON dv.id = c.version_id
                    INNER JOIN documents d ON d.id = dv.document_id
                    WHERE c.kb_id = ? AND c.id IN ({placeholders})
                    """,
                    (kb_id, *chunk_ids),
                ).fetchall()
            else:
                rows = self._conn.execute(
                    """
                    SELECT c.id AS chunk_id, c.version_id, c.text,
                           d.id AS document_id, d.title AS document_title
                    FROM chunks c
                    INNER JOIN document_versions dv ON dv.id = c.version_id
                    INNER JOIN documents d ON d.id = dv.document_id
                    WHERE c.kb_id = ?
                    """,
                    (kb_id,),
                ).fetchall()
        return [
            {
                "chunk_id": row["chunk_id"],
                "version_id": row["version_id"],
                "document_id": row["document_id"],
                "document_title": row["document_title"] or "",
                "text": row["text"] or "",
            }
            for row in rows
        ]

    def chunk_ids_matching_filters(
        self,
        kb_id: str,
        *,
        document_id: str | None = None,
        entity_id: str | None = None,
        created_after: str | None = None,
        created_before: str | None = None,
    ) -> set[str]:
        clauses = ["c.kb_id = ?"]
        params: list[Any] = [kb_id]
        if document_id:
            clauses.append("d.id = ?")
            params.append(document_id)
        if created_after:
            clauses.append("d.created_at >= ?")
            params.append(created_after)
        if created_before:
            clauses.append("d.created_at <= ?")
            params.append(created_before)
        if entity_id:
            clauses.append(
                """
                EXISTS (
                    SELECT 1 FROM statement_evidence se
                    INNER JOIN statements s ON s.id = se.statement_id
                    WHERE se.chunk_id = c.id AND se.kb_id = c.kb_id
                      AND s.invalidated_at IS NULL
                      AND (s.subject_id = ? OR s.object_entity_id = ?)
                )
                """
            )
            params.extend([entity_id, entity_id])
        sql = f"""
            SELECT DISTINCT c.id AS chunk_id
            FROM chunks c
            INNER JOIN document_versions dv ON dv.id = c.version_id
            INNER JOIN documents d ON d.id = dv.document_id
            WHERE {" AND ".join(clauses)}
        """
        with self._lock:
            rows = self._conn.execute(sql, tuple(params)).fetchall()
        return {row["chunk_id"] for row in rows}

    def get_embedding_record(
        self, kb_id: str, chunk_id: str, model_ref: str
    ) -> dict[str, Any] | None:
        with self._lock:
            row = self._conn.execute(
                """
                SELECT content_sha256, model_ref, dimension, vector_key
                FROM embedding_records
                WHERE kb_id = ? AND chunk_id = ? AND model_ref = ?
                """,
                (kb_id, chunk_id, model_ref),
            ).fetchone()
        if row is None:
            return None
        return dict(row)

    def upsert_embedding_record(
        self,
        kb_id: str,
        *,
        chunk_id: str,
        model_ref: str,
        dimension: int,
        content_sha256: str,
        vector_key: str,
    ) -> None:
        now = _now()
        record_id = str(uuid.uuid4())
        with self._lock:
            self._conn.execute(
                """
                INSERT INTO embedding_records (
                    id, kb_id, chunk_id, model_ref, dimension, content_sha256, vector_key, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(chunk_id, model_ref) DO UPDATE SET
                    dimension = excluded.dimension,
                    content_sha256 = excluded.content_sha256,
                    vector_key = excluded.vector_key,
                    created_at = excluded.created_at
                """,
                (
                    record_id,
                    kb_id,
                    chunk_id,
                    model_ref,
                    dimension,
                    content_sha256,
                    vector_key,
                    now,
                ),
            )
            self._conn.commit()

    def delete_all_embedding_records(self, kb_id: str) -> int:
        with self._lock:
            cur = self._conn.execute(
                "DELETE FROM embedding_records WHERE kb_id = ?", (kb_id,)
            )
            self._conn.commit()
            return int(cur.rowcount)

    def list_statements_for_chunk(
        self, kb_id: str, chunk_id: str, *, limit: int = 50
    ) -> list[dict[str, Any]]:
        limit = min(max(1, limit), 100)
        with self._lock:
            self._assert_row_in_kb("chunks", chunk_id, kb_id)
            rows = self._conn.execute(
                """
                SELECT
                    s.id AS statement_id,
                    s.surface_phrase,
                    s.subject_id,
                    s.object_entity_id,
                    s.object_value,
                    s.status,
                    e.quote
                FROM statements s
                INNER JOIN statement_evidence e ON e.statement_id = s.id AND e.chunk_id = ?
                WHERE s.kb_id = ? AND s.invalidated_at IS NULL
                ORDER BY s.recorded_at DESC
                LIMIT ?
                """,
                (chunk_id, kb_id, limit),
            ).fetchall()
        return [
            {
                "statement_id": row["statement_id"],
                "surface_phrase": row["surface_phrase"],
                "subject_id": row["subject_id"],
                "object_entity_id": row["object_entity_id"],
                "object_value": row["object_value"],
                "status": row["status"],
                "quote": row["quote"],
            }
            for row in rows
        ]

    def get_chunk(self, kb_id: str, chunk_id: str) -> dict[str, Any] | None:
        with self._lock:
            row = self._conn.execute(
                """
                SELECT c.id, c.text, c.ordinal, c.heading, c.char_start, c.char_end,
                       c.token_count, c.language, c.origin, c.anchor_json, c.created_at,
                       d.id AS document_id, d.title AS document_title
                FROM chunks c
                INNER JOIN document_versions dv ON dv.id = c.version_id
                INNER JOIN documents d ON d.id = dv.document_id
                WHERE c.id = ? AND c.kb_id = ?
                """,
                (chunk_id, kb_id),
            ).fetchone()
        if row is None:
            return None
        return {
            "chunk_id": row["id"],
            "document_id": row["document_id"],
            "document_title": row["document_title"] or "",
            **_chunk_api_row(row),
        }

    @staticmethod
    def _entity_browse_row(row: Any) -> dict[str, Any]:
        return {
            "id": row["id"],
            "entity_id": row["id"],
            "canonical_label": row["canonical_label"],
            "description": row["description"],
            "entity_kind": row["entity_kind"],
        }

    def count_browse_entities(self, kb_id: str, *, query: str = "") -> int:
        query = query.strip()
        with self._lock:
            self._assert_kb_exists(kb_id)
            if query:
                pattern = f"%{query.replace('%', '')}%"
                row = self._conn.execute(
                    """
                    SELECT COUNT(*) AS n
                    FROM entities
                    WHERE kb_id = ? AND invalidated_at IS NULL
                      AND (canonical_label LIKE ? OR description LIKE ?)
                    """,
                    (kb_id, pattern, pattern),
                ).fetchone()
            else:
                row = self._conn.execute(
                    """
                    SELECT COUNT(*) AS n
                    FROM entities
                    WHERE kb_id = ? AND invalidated_at IS NULL
                    """,
                    (kb_id,),
                ).fetchone()
        return int(row["n"] or 0)

    def list_recent_entities(
        self,
        kb_id: str,
        *,
        limit: int = 20,
        offset: int = 0,
    ) -> list[dict[str, Any]]:
        limit = min(max(1, limit), 50)
        offset = max(0, offset)
        with self._lock:
            self._assert_kb_exists(kb_id)
            rows = self._conn.execute(
                """
                SELECT id, canonical_label, description, entity_kind
                FROM entities
                WHERE kb_id = ? AND invalidated_at IS NULL
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
                """,
                (kb_id, limit, offset),
            ).fetchall()
        return [self._entity_browse_row(row) for row in rows]

    def find_entities(
        self,
        kb_id: str,
        *,
        query: str,
        limit: int = 20,
        offset: int = 0,
    ) -> list[dict[str, Any]]:
        query = query.strip()
        if not query:
            return []
        limit = min(max(1, limit), 50)
        offset = max(0, offset)
        pattern = f"%{query.replace('%', '')}%"
        with self._lock:
            self._assert_kb_exists(kb_id)
            rows = self._conn.execute(
                """
                SELECT id, canonical_label, description, entity_kind
                FROM entities
                WHERE kb_id = ? AND invalidated_at IS NULL
                  AND (canonical_label LIKE ? OR description LIKE ?)
                ORDER BY canonical_label
                LIMIT ? OFFSET ?
                """,
                (kb_id, pattern, pattern, limit, offset),
            ).fetchall()
        return [self._entity_browse_row(row) for row in rows]

    def list_entity_facts(
        self, kb_id: str, *, entity_id: str, limit: int = 50
    ) -> list[dict[str, Any]]:
        limit = min(max(1, limit), 100)
        with self._lock:
            self._assert_row_in_kb("entities", entity_id, kb_id)
            rows = self._conn.execute(
                """
                SELECT
                    s.id,
                    s.surface_phrase,
                    s.object_entity_id,
                    s.object_value,
                    s.status,
                    s.confidence,
                    s.recorded_at,
                    (
                        SELECT e.chunk_id
                        FROM statement_evidence e
                        WHERE e.statement_id = s.id AND e.kb_id = ?
                        ORDER BY e.created_at
                        LIMIT 1
                    ) AS evidence_chunk_id,
                    (
                        SELECT e.quote
                        FROM statement_evidence e
                        WHERE e.statement_id = s.id AND e.kb_id = ?
                        ORDER BY e.created_at
                        LIMIT 1
                    ) AS evidence_quote
                FROM statements s
                WHERE s.kb_id = ? AND s.subject_id = ? AND s.invalidated_at IS NULL
                ORDER BY s.recorded_at DESC
                LIMIT ?
                """,
                (kb_id, kb_id, kb_id, entity_id, limit),
            ).fetchall()
        return [
            {
                "statement_id": row["id"],
                "surface_phrase": row["surface_phrase"],
                "object_entity_id": row["object_entity_id"],
                "object_value": row["object_value"],
                "status": row["status"],
                "confidence": row["confidence"],
                "recorded_at": row["recorded_at"],
                "evidence_chunk_id": row["evidence_chunk_id"],
                "evidence_quote": row["evidence_quote"],
            }
            for row in rows
        ]

    def get_statement_browse(
        self, kb_id: str, *, statement_id: str
    ) -> dict[str, Any] | None:
        with self._lock:
            row = self._conn.execute(
                """
                SELECT id, subject_id, surface_phrase, object_entity_id, object_value, status
                FROM statements
                WHERE kb_id = ? AND id = ? AND invalidated_at IS NULL
                """,
                (kb_id, statement_id),
            ).fetchone()
        if row is None:
            return None
        return {
            "statement_id": row["id"],
            "subject_id": row["subject_id"],
            "surface_phrase": row["surface_phrase"],
            "object_entity_id": row["object_entity_id"],
            "object_value": row["object_value"],
            "status": row["status"],
        }

    def create_review_item(
        self,
        kb_id: str,
        *,
        kind: str,
        subject_type: str,
        subject_id: str,
        payload: dict[str, Any],
        priority: int = 0,
    ) -> dict[str, Any]:
        item_id = str(uuid.uuid4())
        now = _now()
        with self._lock:
            self._assert_kb_exists(kb_id)
            try:
                self._conn.execute(
                    """
                    INSERT INTO review_items (
                        id, kb_id, kind, subject_type, subject_id, status,
                        priority, payload_json, version, created_at
                    ) VALUES (?, ?, ?, ?, ?, 'open', ?, ?, 1, ?)
                    """,
                    (
                        item_id,
                        kb_id,
                        kind,
                        subject_type,
                        subject_id,
                        priority,
                        json.dumps(payload),
                        now,
                    ),
                )
                self._conn.commit()
            except (sqlite3.IntegrityError, SQLAlchemyIntegrityError) as exc:
                raise AdminError(
                    409,
                    "review_exists",
                    "已有未处理的同类审核项",
                ) from exc
        return self.get_review_item(kb_id, item_id)

    def list_review_items(
        self,
        kb_id: str,
        *,
        status: str | None = "open",
        kind: str | None = None,
        limit: int = 50,
    ) -> list[dict[str, Any]]:
        limit = min(max(1, limit), 200)
        clauses = ["kb_id = ?"]
        params: list[Any] = [kb_id]
        if status:
            clauses.append("status = ?")
            params.append(status)
        if kind:
            clauses.append("kind = ?")
            params.append(kind)
        params.append(limit)
        sql = f"""
            SELECT id, kind, subject_type, subject_id, status, priority,
                   payload_json, version, created_at, resolved_at, resolved_by, rationale
            FROM review_items
            WHERE {' AND '.join(clauses)}
            ORDER BY priority DESC, created_at ASC
            LIMIT ?
        """
        with self._lock:
            self._assert_kb_exists(kb_id)
            rows = self._conn.execute(sql, tuple(params)).fetchall()
        return [self._review_row_to_dict(row) for row in rows]

    def find_open_review_item(
        self,
        kb_id: str,
        *,
        kind: str,
        subject_type: str,
        subject_id: str,
    ) -> dict[str, Any] | None:
        with self._lock:
            self._assert_kb_exists(kb_id)
            row = self._conn.execute(
                """
                SELECT id, kind, subject_type, subject_id, status, priority,
                       payload_json, version, created_at, resolved_at, resolved_by, rationale
                FROM review_items
                WHERE kb_id = ? AND kind = ? AND subject_type = ? AND subject_id = ?
                  AND status = 'open'
                LIMIT 1
                """,
                (kb_id, kind, subject_type, subject_id),
            ).fetchone()
        if row is None:
            return None
        return self._review_row_to_dict(row)

    def get_review_item(self, kb_id: str, item_id: str) -> dict[str, Any]:
        with self._lock:
            self._assert_kb_exists(kb_id)
            row = self._conn.execute(
                """
                SELECT id, kind, subject_type, subject_id, status, priority,
                       payload_json, version, created_at, resolved_at, resolved_by, rationale
                FROM review_items
                WHERE kb_id = ? AND id = ?
                """,
                (kb_id, item_id),
            ).fetchone()
        if row is None:
            raise AdminError(404, "not_found", "审核项不存在")
        return self._review_row_to_dict(row)

    def resolve_review_item(
        self,
        kb_id: str,
        item_id: str,
        *,
        status: str,
        resolved_by: str,
        rationale: str | None = None,
    ) -> dict[str, Any]:
        if status not in {"approved", "rejected", "cancelled"}:
            raise AdminError(422, "bad_status", "无效的审核状态")
        now = _now()
        with self._lock:
            self._assert_kb_exists(kb_id)
            row = self._conn.execute(
                "SELECT status FROM review_items WHERE kb_id = ? AND id = ?",
                (kb_id, item_id),
            ).fetchone()
            if row is None:
                raise AdminError(404, "not_found", "审核项不存在")
            if row["status"] != "open":
                raise AdminError(409, "review_closed", "审核项已处理")
            self._conn.execute(
                """
                UPDATE review_items
                SET status = ?, resolved_at = ?, resolved_by = ?, rationale = ?
                WHERE kb_id = ? AND id = ?
                """,
                (status, now, resolved_by, rationale, kb_id, item_id),
            )
            self._conn.commit()
        return self.get_review_item(kb_id, item_id)

    @staticmethod
    def _review_row_to_dict(row: sqlite3.Row) -> dict[str, Any]:
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

    @staticmethod
    def merge_review_subject_key(primary_id: str, duplicate_ids: list[str]) -> str:
        parts = sorted({primary_id, *duplicate_ids})
        return ":".join(parts)

    _MAPPING_TARGET_KINDS = frozenset({"class", "property", "none"})
    _MAPPING_DIRECTIONS = frozenset({"forward", "reverse", "n/a"})
    _MAPPING_STATUSES = frozenset({"proposed", "confirmed", "rejected", "superseded"})

    def list_mappings(
        self,
        kb_id: str,
        *,
        status: str | None = None,
        include_invalidated: bool = False,
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        limit = min(max(1, limit), 200)
        clauses = ["kb_id = ?"]
        params: list[Any] = [kb_id]
        if not include_invalidated:
            clauses.append("invalidated_at IS NULL")
        if status:
            if status not in self._MAPPING_STATUSES:
                raise AdminError(422, "bad_status", "无效的映射状态")
            clauses.append("status = ?")
            params.append(status)
        params.append(limit)
        sql = f"""
            SELECT id, signature, target_uri, target_kind, direction, status,
                   actor_id, why, created_at, invalidated_at, supersedes_id
            FROM mappings
            WHERE {' AND '.join(clauses)}
            ORDER BY created_at DESC
            LIMIT ?
        """
        with self._lock:
            self._assert_kb_exists(kb_id)
            rows = self._conn.execute(sql, tuple(params)).fetchall()
        return [self._mapping_row_to_dict(row) for row in rows]

    def create_mapping(
        self,
        kb_id: str,
        actor_id: str,
        *,
        signature: str,
        target_uri: str | None,
        target_kind: str,
        direction: str,
        status: str = "proposed",
        why: str | None = None,
    ) -> dict[str, Any]:
        signature = signature.strip()
        if not signature:
            raise AdminError(422, "bad_signature", "映射签名不能为空")
        if target_kind not in self._MAPPING_TARGET_KINDS:
            raise AdminError(422, "bad_target_kind", "target_kind 无效")
        if direction not in self._MAPPING_DIRECTIONS:
            raise AdminError(422, "bad_direction", "direction 无效")
        if status not in self._MAPPING_STATUSES:
            raise AdminError(422, "bad_status", "status 无效")
        mapping_id = str(uuid.uuid4())
        now = _now()
        with self._lock:
            self._assert_kb_exists(kb_id)
            try:
                self._conn.execute(
                    """
                    INSERT INTO mappings (
                        id, kb_id, signature, target_uri, target_kind, direction,
                        status, actor_id, why, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        mapping_id,
                        kb_id,
                        signature,
                        target_uri,
                        target_kind,
                        direction,
                        status,
                        actor_id,
                        why,
                        now,
                    ),
                )
                self._conn.commit()
            except (sqlite3.IntegrityError, SQLAlchemyIntegrityError) as exc:
                raise AdminError(
                    409,
                    "mapping_exists",
                    "已存在相同签名的已确认映射",
                ) from exc
        return self.get_mapping(kb_id, mapping_id)

    def get_mapping(self, kb_id: str, mapping_id: str) -> dict[str, Any]:
        with self._lock:
            self._assert_kb_exists(kb_id)
            row = self._conn.execute(
                """
                SELECT id, signature, target_uri, target_kind, direction, status,
                       actor_id, why, created_at, invalidated_at, supersedes_id
                FROM mappings
                WHERE kb_id = ? AND id = ?
                """,
                (kb_id, mapping_id),
            ).fetchone()
        if row is None:
            raise AdminError(404, "not_found", "映射不存在")
        return self._mapping_row_to_dict(row)

    def update_mapping_status(
        self,
        kb_id: str,
        mapping_id: str,
        actor_id: str,
        *,
        status: str,
        why: str | None = None,
    ) -> dict[str, Any]:
        if status not in self._MAPPING_STATUSES:
            raise AdminError(422, "bad_status", "status 无效")
        now = _now()
        with self._lock:
            self._assert_kb_exists(kb_id)
            row = self._conn.execute(
                "SELECT status, invalidated_at FROM mappings WHERE kb_id = ? AND id = ?",
                (kb_id, mapping_id),
            ).fetchone()
            if row is None:
                raise AdminError(404, "not_found", "映射不存在")
            if row["invalidated_at"] is not None:
                raise AdminError(409, "mapping_invalidated", "映射已失效")
            try:
                self._conn.execute(
                    """
                    UPDATE mappings
                    SET status = ?, why = COALESCE(?, why), actor_id = ?
                    WHERE kb_id = ? AND id = ?
                    """,
                    (status, why, actor_id, kb_id, mapping_id),
                )
                if status in {"rejected", "superseded"}:
                    self._conn.execute(
                        """
                        UPDATE mappings SET invalidated_at = ?
                        WHERE kb_id = ? AND id = ?
                        """,
                        (now, kb_id, mapping_id),
                    )
                self._conn.commit()
            except (sqlite3.IntegrityError, SQLAlchemyIntegrityError) as exc:
                raise AdminError(409, "mapping_exists", "已存在相同签名的已确认映射") from exc
        return self.get_mapping(kb_id, mapping_id)

    def list_distinct_surface_phrases(self, kb_id: str, *, limit: int = 100) -> list[str]:
        limit = min(max(1, limit), 200)
        with self._lock:
            self._assert_kb_exists(kb_id)
            rows = self._conn.execute(
                """
                SELECT DISTINCT surface_phrase
                FROM statements
                WHERE kb_id = ?
                  AND invalidated_at IS NULL
                  AND TRIM(surface_phrase) != ''
                ORDER BY surface_phrase
                LIMIT ?
                """,
                (kb_id, limit),
            ).fetchall()
        return [row["surface_phrase"] for row in rows]

    def list_typed_facts_for_projection(self, kb_id: str) -> list[dict[str, Any]]:
        with self._lock:
            self._assert_kb_exists(kb_id)
            rows = self._conn.execute(
                """
                SELECT id, subject_id, predicate_uri, object_entity_id, object_value,
                       mapping_id, confidence, recorded_at
                FROM typed_facts
                WHERE kb_id = ? AND invalidated_at IS NULL
                ORDER BY recorded_at ASC
                """,
                (kb_id,),
            ).fetchall()
        return [
            {
                "id": row["id"],
                "subject_id": row["subject_id"],
                "predicate_uri": row["predicate_uri"],
                "object_entity_id": row["object_entity_id"],
                "object_value": row["object_value"],
                "mapping_id": row["mapping_id"],
                "confidence": row["confidence"],
                "recorded_at": row["recorded_at"],
            }
            for row in rows
        ]

    def list_derived_facts_for_projection(self, kb_id: str) -> list[dict[str, Any]]:
        with self._lock:
            self._assert_kb_exists(kb_id)
            rows = self._conn.execute(
                """
                SELECT id, subject_id, predicate_uri, object_entity_id, object_value, rule_id,
                       recorded_at
                FROM derived_facts
                WHERE kb_id = ? AND invalidated_at IS NULL
                ORDER BY recorded_at ASC
                """,
                (kb_id,),
            ).fetchall()
        return [
            {
                "id": row["id"],
                "subject_id": row["subject_id"],
                "predicate_uri": row["predicate_uri"],
                "object_entity_id": row["object_entity_id"],
                "object_value": row["object_value"],
                "rule_id": row["rule_id"],
                "recorded_at": row["recorded_at"],
            }
            for row in rows
        ]

    def list_typed_facts(self, kb_id: str, *, limit: int = 100) -> list[dict[str, Any]]:
        limit = min(max(1, limit), 200)
        with self._lock:
            self._assert_kb_exists(kb_id)
            rows = self._conn.execute(
                """
                SELECT id, subject_id, predicate_uri, object_entity_id, object_value,
                       from_statement_id, mapping_id, confidence, recorded_at
                FROM typed_facts
                WHERE kb_id = ? AND invalidated_at IS NULL
                ORDER BY recorded_at DESC
                LIMIT ?
                """,
                (kb_id, limit),
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

    def materialize_mapping_facts(self, kb_id: str, mapping_id: str) -> dict[str, Any]:
        mapping = self.get_mapping(kb_id, mapping_id)
        if mapping["status"] != "confirmed":
            return {"created": 0, "reason": "mapping_not_confirmed"}
        if mapping["target_kind"] != "property":
            return {"created": 0, "reason": "target_not_property"}
        predicate_uri = (mapping["target_uri"] or "").strip()
        if not predicate_uri:
            return {"created": 0, "reason": "missing_predicate_uri"}
        signature = mapping["signature"]
        now = _now()
        created = 0
        with self._lock:
            rows = self._conn.execute(
                """
                SELECT id, subject_id, object_entity_id, object_value, confidence
                FROM statements
                WHERE kb_id = ?
                  AND invalidated_at IS NULL
                  AND surface_phrase = ?
                  AND status IN ('pending', 'confirmed')
                """,
                (kb_id, signature),
            ).fetchall()
            for row in rows:
                object_entity_id = row["object_entity_id"]
                object_value = row["object_value"]
                if object_entity_id and object_value:
                    continue
                if not object_entity_id and not object_value:
                    continue
                exists = self._conn.execute(
                    """
                    SELECT 1 FROM typed_facts
                    WHERE kb_id = ? AND from_statement_id = ? AND mapping_id = ?
                      AND invalidated_at IS NULL
                    LIMIT 1
                    """,
                    (kb_id, row["id"], mapping_id),
                ).fetchone()
                if exists:
                    continue
                fact_id = str(uuid.uuid4())
                self._conn.execute(
                    """
                    INSERT INTO typed_facts (
                        id, kb_id, subject_id, predicate_uri,
                        object_entity_id, object_value, from_statement_id,
                        mapping_id, confidence, recorded_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        fact_id,
                        kb_id,
                        row["subject_id"],
                        predicate_uri,
                        object_entity_id,
                        object_value,
                        row["id"],
                        mapping_id,
                        row["confidence"],
                        now,
                    ),
                )
                created += 1
            self._conn.commit()
        return {"created": created, "mapping_id": mapping_id}

    def entity_labels_by_ids(self, kb_id: str, entity_ids: list[str]) -> dict[str, str | None]:
        if not entity_ids:
            return {}
        unique = list(dict.fromkeys(entity_ids))
        placeholders = ",".join("?" * len(unique))
        with self._lock:
            rows = self._conn.execute(
                f"""
                SELECT id, canonical_label FROM entities
                WHERE kb_id = ? AND invalidated_at IS NULL
                  AND id IN ({placeholders})
                """,
                (kb_id, *unique),
            ).fetchall()
        labels: dict[str, str | None] = {eid: None for eid in unique}
        for row in rows:
            labels[row["id"]] = (row["canonical_label"] or "").strip() or None
        return labels

    def ledger_entity_exists(self, kb_id: str, entity_id: str) -> bool:
        with self._lock:
            row = self._conn.execute(
                """
                SELECT 1 FROM entities
                WHERE id = ? AND kb_id = ? AND invalidated_at IS NULL
                """,
                (entity_id, kb_id),
            ).fetchone()
        return row is not None

    def record_entity_merge(
        self,
        kb_id: str,
        *,
        source_entity_id: str,
        target_entity_id: str,
        actor_id: str | None,
        why: str | None = None,
        decision_id: str | None = None,
    ) -> dict[str, Any]:
        if source_entity_id == target_entity_id:
            raise AdminError(422, "same_entity", "不能合并同一实体")
        with self._lock:
            self._assert_row_in_kb("entities", source_entity_id, kb_id)
            self._assert_row_in_kb("entities", target_entity_id, kb_id)
            merge_id = str(uuid.uuid4())
            now = _now()
            self._conn.execute(
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
                    now,
                ),
            )
            self._conn.commit()
            row = self._conn.execute(
                "SELECT * FROM entity_merges WHERE id = ?", (merge_id,)
            ).fetchone()
        return self._entity_merge_row_to_dict(row)

    def entity_merge_redirect(self, kb_id: str) -> dict[str, str]:
        """Map merged-away entity ids to their surviving target (chains collapsed)."""
        direct: dict[str, str] = {}
        for row in self.list_entity_merges(kb_id, active_only=True, limit=10_000):
            direct[row["source_entity_id"]] = row["target_entity_id"]
        redirect: dict[str, str] = {}
        for source in direct:
            target = direct[source]
            seen = {source}
            while target in direct and target not in seen:
                seen.add(target)
                target = direct[target]
            redirect[source] = target
        return redirect

    def revert_entity_merge(
        self,
        kb_id: str,
        merge_id: str,
        *,
        reverted_by: str,
    ) -> dict[str, Any]:
        with self._lock:
            row = self._conn.execute(
                "SELECT * FROM entity_merges WHERE id = ? AND kb_id = ?",
                (merge_id, kb_id),
            ).fetchone()
            if row is None:
                raise AdminError(404, "not_found", "合并记录不存在")
            if row["reverted_at"] is not None:
                raise AdminError(409, "merge_reverted", "合并已回滚")
            now = _now()
            self._conn.execute(
                """
                UPDATE entity_merges
                SET reverted_at = ?, reverted_by = ?
                WHERE id = ? AND kb_id = ?
                """,
                (now, reverted_by, merge_id, kb_id),
            )
            self._conn.commit()
            updated = self._conn.execute(
                "SELECT * FROM entity_merges WHERE id = ?", (merge_id,)
            ).fetchone()
        return self._entity_merge_row_to_dict(updated)

    def list_entity_merges(
        self,
        kb_id: str,
        *,
        limit: int = 100,
        active_only: bool = True,
    ) -> list[dict[str, Any]]:
        with self._lock:
            self._assert_kb_exists(kb_id)
            clause = "AND reverted_at IS NULL" if active_only else ""
            rows = self._conn.execute(
                f"""
                SELECT * FROM entity_merges
                WHERE kb_id = ? {clause}
                ORDER BY created_at DESC
                LIMIT ?
                """,
                (kb_id, limit),
            ).fetchall()
        return [self._entity_merge_row_to_dict(row) for row in rows]

    @staticmethod
    def _entity_merge_row_to_dict(row: sqlite3.Row) -> dict[str, Any]:
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

    @staticmethod
    def _mapping_row_to_dict(row: sqlite3.Row) -> dict[str, Any]:
        return {
            "id": row["id"],
            "signature": row["signature"],
            "target_uri": row["target_uri"],
            "target_kind": row["target_kind"],
            "direction": row["direction"],
            "status": row["status"],
            "actor_id": row["actor_id"],
            "why": row["why"],
            "created_at": row["created_at"],
            "invalidated_at": row["invalidated_at"],
            "supersedes_id": row["supersedes_id"],
        }

    def _assert_kb_exists(self, kb_id: str) -> None:
        row = self._conn.execute(
            "SELECT id FROM knowledge_bases WHERE id = ?", (kb_id,)
        ).fetchone()
        if row is None:
            raise AdminError(404, "not_found", "知识库不存在")

    def _assert_row_in_kb(self, table: str, row_id: str, kb_id: str) -> None:
        allowed = {"entities", "chunks", "documents", "document_versions"}
        if table not in allowed:
            raise ValueError(f"unsupported table guard: {table}")
        row = self._conn.execute(
            f"SELECT kb_id FROM {table} WHERE id = ?", (row_id,)
        ).fetchone()
        if row is None:
            raise AdminError(404, "not_found", "记录不存在")
        if row["kb_id"] != kb_id:
            raise AdminError(403, "forbidden", "记录不属于该知识库")

    _INGEST_SOURCE_KINDS = frozenset({"webhook", "http_poll", "git", "connector"})

    def list_scheduled_ingest_sources_global(self) -> list[dict[str, Any]]:
        with self._lock:
            rows = self._conn.execute(
                """
                SELECT id, kb_id, kind, name, config_json, enabled, created_by, created_at, updated_at
                FROM ingest_sources
                WHERE deleted_at IS NULL AND enabled = 1 AND kind IN ('http_poll', 'git')
                ORDER BY kb_id, created_at ASC
                """,
            ).fetchall()
        return [self._ingest_source_row_to_dict(row) for row in rows]

    def list_http_poll_sources_global(self) -> list[dict[str, Any]]:
        return [s for s in self.list_scheduled_ingest_sources_global() if s["kind"] == "http_poll"]

    def list_active_connector_table_mappings_global(self) -> list[tuple[str, str]]:
        """All active inbound/bidirectional BOCP table mappings (kb_id, mapping_id)."""
        with self._lock:
            rows = self._conn.execute(
                """
                SELECT kb_id, id
                FROM source_table_mappings
                WHERE status = 'active'
                  AND sync_direction IN ('inbound', 'bidirectional')
                ORDER BY kb_id, created_at ASC
                """,
            ).fetchall()
        return [(str(row[0]), str(row[1])) for row in rows]

    def list_ingest_sources(self, kb_id: str) -> list[dict[str, Any]]:
        with self._lock:
            self._assert_kb_exists(kb_id)
            rows = self._conn.execute(
                """
                SELECT id, kb_id, kind, name, config_json, enabled, created_by, created_at, updated_at
                FROM ingest_sources
                WHERE kb_id = ? AND deleted_at IS NULL
                ORDER BY created_at DESC
                """,
                (kb_id,),
            ).fetchall()
        return [self._ingest_source_row_to_dict(row) for row in rows]

    def create_ingest_source(
        self,
        kb_id: str,
        actor_id: str,
        *,
        kind: str,
        name: str,
        config: dict[str, Any] | None = None,
        enabled: bool = True,
    ) -> tuple[dict[str, Any], str | None]:
        """Returns (source, one_time_secret) for kinds that issue ingest tokens."""
        name = name.strip()
        if not name:
            raise AdminError(422, "bad_name", "来源名称不能为空")
        if kind not in self._INGEST_SOURCE_KINDS:
            raise AdminError(422, "bad_kind", "不支持的来源类型")
        config_payload = dict(config or {})
        if kind == "http_poll":
            url = str(config_payload.get("url") or "").strip()
            if not url.startswith(("http://", "https://")):
                raise AdminError(422, "bad_url", "http_poll 需要有效的 http(s) URL")
        if kind == "git":
            repo = str(config_payload.get("repo_url") or "").strip()
            if not repo:
                raise AdminError(422, "bad_repo", "git 需要 repo_url")
            paths = config_payload.get("paths")
            if not isinstance(paths, list) or not any(str(p).strip() for p in paths):
                raise AdminError(422, "bad_paths", "git 需要至少一个 paths 文件路径")
        source_id = str(uuid.uuid4())
        now = _now()
        secret_ref: str | None = None
        one_time_secret: str | None = None
        if kind == "webhook":
            one_time_secret = secrets.token_urlsafe(32)
            secret_ref = one_time_secret
        with self._lock:
            self._assert_kb_exists(kb_id)
            self._conn.execute(
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
                    json.dumps(config_payload),
                    secret_ref,
                    1 if enabled else 0,
                    actor_id,
                    now,
                    now,
                ),
            )
            self._conn.commit()
        return self.get_ingest_source(kb_id, source_id), one_time_secret

    def get_ingest_source(self, kb_id: str, source_id: str) -> dict[str, Any]:
        with self._lock:
            self._assert_kb_exists(kb_id)
            row = self._conn.execute(
                """
                SELECT id, kb_id, kind, name, config_json, enabled, created_by, created_at, updated_at
                FROM ingest_sources
                WHERE kb_id = ? AND id = ? AND deleted_at IS NULL
                """,
                (kb_id, source_id),
            ).fetchone()
        if row is None:
            raise AdminError(404, "not_found", "来源不存在")
        return self._ingest_source_row_to_dict(row)

    def get_ingest_source_secret(self, kb_id: str, source_id: str) -> str | None:
        with self._lock:
            row = self._conn.execute(
                """
                SELECT secret_ref FROM ingest_sources
                WHERE kb_id = ? AND id = ? AND deleted_at IS NULL
                """,
                (kb_id, source_id),
            ).fetchone()
        if row is None:
            return None
        return row["secret_ref"]

    def update_ingest_source(
        self,
        kb_id: str,
        source_id: str,
        *,
        name: str | None = None,
        enabled: bool | None = None,
        config: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        with self._lock:
            self._assert_kb_exists(kb_id)
            row = self._conn.execute(
                """
                SELECT name, config_json, enabled FROM ingest_sources
                WHERE kb_id = ? AND id = ? AND deleted_at IS NULL
                """,
                (kb_id, source_id),
            ).fetchone()
            if row is None:
                raise AdminError(404, "not_found", "来源不存在")
            new_name = name.strip() if name is not None else row["name"]
            if not new_name:
                raise AdminError(422, "bad_name", "来源名称不能为空")
            merged_config = json.loads(row["config_json"])
            if config is not None:
                merged_config.update(config)
            new_enabled = (1 if enabled else 0) if enabled is not None else row["enabled"]
            now = _now()
            self._conn.execute(
                """
                UPDATE ingest_sources
                SET name = ?, config_json = ?, enabled = ?, updated_at = ?
                WHERE kb_id = ? AND id = ?
                """,
                (new_name, json.dumps(merged_config), new_enabled, now, kb_id, source_id),
            )
            self._conn.commit()
        return self.get_ingest_source(kb_id, source_id)

    def delete_ingest_source(self, kb_id: str, source_id: str) -> None:
        now = _now()
        with self._lock:
            self._assert_kb_exists(kb_id)
            cur = self._conn.execute(
                """
                UPDATE ingest_sources SET deleted_at = ?, updated_at = ?, enabled = 0
                WHERE kb_id = ? AND id = ? AND deleted_at IS NULL
                """,
                (now, now, kb_id, source_id),
            )
            self._conn.commit()
            if cur.rowcount == 0:
                raise AdminError(404, "not_found", "来源不存在")

    def rotate_ingest_source_token(self, kb_id: str, source_id: str) -> str:
        source = self.get_ingest_source(kb_id, source_id)
        if source["kind"] != "webhook":
            raise AdminError(422, "bad_kind", "仅 Webhook 来源可轮换令牌")
        new_token = secrets.token_urlsafe(32)
        now = _now()
        with self._lock:
            cur = self._conn.execute(
                """
                UPDATE ingest_sources
                SET secret_ref = ?, updated_at = ?
                WHERE kb_id = ? AND id = ? AND deleted_at IS NULL
                """,
                (new_token, now, kb_id, source_id),
            )
            self._conn.commit()
            if cur.rowcount == 0:
                raise AdminError(404, "not_found", "来源不存在")
        return new_token

    @staticmethod
    def _ingest_source_row_to_dict(row: sqlite3.Row) -> dict[str, Any]:
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

    @staticmethod
    def _reasoning_rule_row_to_dict(row: sqlite3.Row) -> dict[str, Any]:
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

    def list_reasoning_rules(self, kb_id: str, *, limit: int = 100) -> list[dict[str, Any]]:
        limit = min(max(1, limit), 200)
        with self._lock:
            self._assert_kb_exists(kb_id)
            rows = self._conn.execute(
                """
                SELECT id, kb_id, name, body, enabled, actor_id, created_at, updated_at
                FROM kb_reasoning_rules
                WHERE kb_id = ? AND deleted_at IS NULL
                ORDER BY updated_at DESC
                LIMIT ?
                """,
                (kb_id, limit),
            ).fetchall()
        return [self._reasoning_rule_row_to_dict(row) for row in rows]

    def create_reasoning_rule(
        self,
        kb_id: str,
        *,
        name: str,
        body: str,
        actor_id: str,
        enabled: bool = True,
    ) -> dict[str, Any]:
        rule_id = str(uuid.uuid4())
        now = _now()
        with self._lock:
            self._assert_kb_exists(kb_id)
            self._conn.execute(
                """
                INSERT INTO kb_reasoning_rules (
                    id, kb_id, name, body, enabled, actor_id, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (rule_id, kb_id, name, body, int(enabled), actor_id, now, now),
            )
            self._conn.commit()
        return self.get_reasoning_rule(kb_id, rule_id)

    def get_reasoning_rule(self, kb_id: str, rule_id: str) -> dict[str, Any]:
        with self._lock:
            row = self._conn.execute(
                """
                SELECT id, kb_id, name, body, enabled, actor_id, created_at, updated_at
                FROM kb_reasoning_rules
                WHERE kb_id = ? AND id = ? AND deleted_at IS NULL
                """,
                (kb_id, rule_id),
            ).fetchone()
        if row is None:
            raise AdminError(404, "not_found", "规则不存在")
        return self._reasoning_rule_row_to_dict(row)

    def update_reasoning_rule(
        self,
        kb_id: str,
        rule_id: str,
        *,
        name: str | None = None,
        body: str | None = None,
        enabled: bool | None = None,
    ) -> dict[str, Any]:
        self.get_reasoning_rule(kb_id, rule_id)
        if name is None and body is None and enabled is None:
            return self.get_reasoning_rule(kb_id, rule_id)
        now = _now()
        sets: list[str] = ["updated_at = ?"]
        params: list[Any] = [now]
        if name is not None:
            sets.append("name = ?")
            params.append(name)
        if body is not None:
            sets.append("body = ?")
            params.append(body)
        if enabled is not None:
            sets.append("enabled = ?")
            params.append(int(enabled))
        params.extend([kb_id, rule_id])
        with self._lock:
            self._conn.execute(
                f"""
                UPDATE kb_reasoning_rules
                SET {", ".join(sets)}
                WHERE kb_id = ? AND id = ? AND deleted_at IS NULL
                """,
                params,
            )
            self._conn.commit()
        return self.get_reasoning_rule(kb_id, rule_id)

    def delete_reasoning_rule(self, kb_id: str, rule_id: str) -> None:
        self.get_reasoning_rule(kb_id, rule_id)
        now = _now()
        with self._lock:
            self._conn.execute(
                """
                UPDATE kb_reasoning_rules
                SET deleted_at = ?, updated_at = ?, enabled = 0
                WHERE kb_id = ? AND id = ? AND deleted_at IS NULL
                """,
                (now, now, kb_id, rule_id),
            )
            self._conn.commit()

    def insert_derived_fact(
        self,
        kb_id: str,
        *,
        subject_id: str,
        predicate_uri: str,
        object_entity_id: str | None,
        object_value: str | None,
        rule_id: str | None,
        derivations: list[tuple[str, str]],
    ) -> str | None:
        if object_entity_id and object_value:
            raise AdminError(422, "validation_error", "派生事实 object 只能二选一")
        if not object_entity_id and not object_value:
            raise AdminError(422, "validation_error", "派生事实缺少 object")
        now = _now()
        with self._lock:
            self._assert_row_in_kb("entities", subject_id, kb_id)
            if object_entity_id:
                self._assert_row_in_kb("entities", object_entity_id, kb_id)
            exists = self._conn.execute(
                """
                SELECT id FROM derived_facts
                WHERE kb_id = ? AND subject_id = ? AND predicate_uri = ?
                  AND COALESCE(object_entity_id, '') = COALESCE(?, '')
                  AND COALESCE(object_value, '') = COALESCE(?, '')
                  AND invalidated_at IS NULL
                LIMIT 1
                """,
                (kb_id, subject_id, predicate_uri, object_entity_id, object_value),
            ).fetchone()
            if exists:
                return None
            fact_id = str(uuid.uuid4())
            self._conn.execute(
                """
                INSERT INTO derived_facts (
                    id, kb_id, subject_id, predicate_uri,
                    object_entity_id, object_value, object_datatype,
                    rule_id, recorded_at, invalidated_at
                ) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, NULL)
                """,
                (
                    fact_id,
                    kb_id,
                    subject_id,
                    predicate_uri,
                    object_entity_id,
                    object_value,
                    rule_id,
                    now,
                ),
            )
            for ordinal, (premise_kind, premise_id) in enumerate(derivations):
                self._conn.execute(
                    """
                    INSERT INTO fact_derivations (
                        derived_fact_id, premise_kind, premise_id, ordinal
                    ) VALUES (?, ?, ?, ?)
                    """,
                    (fact_id, premise_kind[:64], premise_id[:240], ordinal),
                )
            self._conn.commit()
        return fact_id

    def list_derived_facts(self, kb_id: str, *, limit: int = 100) -> list[dict[str, Any]]:
        limit = min(max(1, limit), 200)
        with self._lock:
            rows = self._conn.execute(
                """
                SELECT id, kb_id, subject_id, predicate_uri,
                       object_entity_id, object_value, rule_id, recorded_at
                FROM derived_facts
                WHERE kb_id = ? AND invalidated_at IS NULL
                ORDER BY recorded_at DESC
                LIMIT ?
                """,
                (kb_id, limit),
            ).fetchall()
            facts: list[dict[str, Any]] = []
            for row in rows:
                deriv_rows = self._conn.execute(
                    """
                    SELECT premise_kind, premise_id, ordinal
                    FROM fact_derivations
                    WHERE derived_fact_id = ?
                    ORDER BY ordinal
                    """,
                    (row["id"],),
                ).fetchall()
                facts.append(
                    {
                        "id": row["id"],
                        "subject_id": row["subject_id"],
                        "predicate_uri": row["predicate_uri"],
                        "object_entity_id": row["object_entity_id"],
                        "object_value": row["object_value"],
                        "rule_id": row["rule_id"],
                        "recorded_at": row["recorded_at"],
                        "derivations": [
                            {
                                "premise_kind": d["premise_kind"],
                                "premise_id": d["premise_id"],
                                "ordinal": d["ordinal"],
                            }
                            for d in deriv_rows
                        ],
                    }
                )
        return facts

    def list_derived_facts_for_entity(
        self,
        kb_id: str,
        entity_id: str,
        *,
        limit: int = 50,
    ) -> list[dict[str, Any]]:
        limit = min(max(1, limit), 100)
        with self._lock:
            self._assert_row_in_kb("entities", entity_id, kb_id)
            rows = self._conn.execute(
                """
                SELECT id, kb_id, subject_id, predicate_uri,
                       object_entity_id, object_value, rule_id, recorded_at
                FROM derived_facts
                WHERE kb_id = ? AND invalidated_at IS NULL
                  AND (subject_id = ? OR object_entity_id = ?)
                ORDER BY recorded_at DESC
                LIMIT ?
                """,
                (kb_id, entity_id, entity_id, limit),
            ).fetchall()
            facts: list[dict[str, Any]] = []
            for row in rows:
                deriv_rows = self._conn.execute(
                    """
                    SELECT premise_kind, premise_id, ordinal
                    FROM fact_derivations
                    WHERE derived_fact_id = ?
                    ORDER BY ordinal
                    """,
                    (row["id"],),
                ).fetchall()
                facts.append(
                    {
                        "id": row["id"],
                        "subject_id": row["subject_id"],
                        "predicate_uri": row["predicate_uri"],
                        "object_entity_id": row["object_entity_id"],
                        "object_value": row["object_value"],
                        "rule_id": row["rule_id"],
                        "recorded_at": row["recorded_at"],
                        "derivations": [
                            {
                                "premise_kind": d["premise_kind"],
                                "premise_id": d["premise_id"],
                                "ordinal": d["ordinal"],
                            }
                            for d in deriv_rows
                        ],
                    }
                )
        return facts

    @staticmethod
    def _alert_row_to_dict(row: sqlite3.Row) -> dict[str, Any]:
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

    def create_kb_alert(
        self,
        kb_id: str,
        *,
        kind: str,
        message: str,
        severity: str = "warning",
        detail: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        alert_id = str(uuid.uuid4())
        now = _now()
        with self._lock:
            self._assert_kb_exists(kb_id)
            self._conn.execute(
                """
                INSERT INTO kb_alerts (
                    id, kb_id, kind, severity, message, detail_json, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    alert_id,
                    kb_id,
                    kind,
                    severity,
                    message[:2000],
                    json.dumps(detail or {}, ensure_ascii=False),
                    now,
                ),
            )
            self._conn.commit()
        return self.get_kb_alert(kb_id, alert_id)

    def get_kb_alert(self, kb_id: str, alert_id: str) -> dict[str, Any]:
        with self._lock:
            row = self._conn.execute(
                """
                SELECT id, kb_id, kind, severity, message, detail_json,
                       created_at, read_at, dismissed_at
                FROM kb_alerts
                WHERE kb_id = ? AND id = ?
                """,
                (kb_id, alert_id),
            ).fetchone()
        if row is None:
            raise AdminError(404, "not_found", "告警不存在")
        return self._alert_row_to_dict(row)

    def list_kb_alerts(
        self,
        kb_id: str,
        *,
        include_dismissed: bool = False,
        limit: int = 50,
    ) -> list[dict[str, Any]]:
        limit = min(max(1, limit), 100)
        clauses = ["kb_id = ?"]
        params: list[Any] = [kb_id]
        if not include_dismissed:
            clauses.append("dismissed_at IS NULL")
        with self._lock:
            self._assert_kb_exists(kb_id)
            rows = self._conn.execute(
                f"""
                SELECT id, kb_id, kind, severity, message, detail_json,
                       created_at, read_at, dismissed_at
                FROM kb_alerts
                WHERE {' AND '.join(clauses)}
                ORDER BY created_at DESC
                LIMIT ?
                """,
                (*params, limit),
            ).fetchall()
        return [self._alert_row_to_dict(row) for row in rows]

    def count_kb_alerts(self, kb_id: str, *, include_dismissed: bool = False) -> int:
        clauses = ["kb_id = ?"]
        params: list[Any] = [kb_id]
        if not include_dismissed:
            clauses.append("dismissed_at IS NULL")
        with self._lock:
            self._assert_kb_exists(kb_id)
            row = self._conn.execute(
                f"SELECT COUNT(*) AS n FROM kb_alerts WHERE {' AND '.join(clauses)}",
                params,
            ).fetchone()
        return int(row["n"])

    def count_kb_unread_alerts(self, kb_id: str) -> int:
        """Active alerts not yet read (F-ALT: badge / unread_count)."""
        with self._lock:
            self._assert_kb_exists(kb_id)
            row = self._conn.execute(
                """
                SELECT COUNT(*) AS n FROM kb_alerts
                WHERE kb_id = ? AND dismissed_at IS NULL AND read_at IS NULL
                """,
                (kb_id,),
            ).fetchone()
        return int(row["n"])

    def list_kb_alerts_since(
        self,
        kb_id: str,
        *,
        since_created_at: str | None,
        limit: int = 20,
    ) -> list[dict[str, Any]]:
        limit = min(max(1, limit), 50)
        with self._lock:
            self._assert_kb_exists(kb_id)
            if since_created_at:
                rows = self._conn.execute(
                    """
                    SELECT id, kb_id, kind, severity, message, detail_json,
                           created_at, read_at, dismissed_at
                    FROM kb_alerts
                    WHERE kb_id = ? AND dismissed_at IS NULL AND created_at > ?
                    ORDER BY created_at ASC
                    LIMIT ?
                    """,
                    (kb_id, since_created_at, limit),
                ).fetchall()
            else:
                rows = self._conn.execute(
                    """
                    SELECT id, kb_id, kind, severity, message, detail_json,
                           created_at, read_at, dismissed_at
                    FROM kb_alerts
                    WHERE kb_id = ? AND dismissed_at IS NULL
                    ORDER BY created_at DESC
                    LIMIT ?
                    """,
                    (kb_id, limit),
                ).fetchall()
        items = [self._alert_row_to_dict(row) for row in rows]
        if since_created_at is None:
            items.reverse()
        return items

    def dismiss_kb_alert(self, kb_id: str, alert_id: str) -> dict[str, Any]:
        now = _now()
        self.get_kb_alert(kb_id, alert_id)
        with self._lock:
            self._conn.execute(
                """
                UPDATE kb_alerts
                SET dismissed_at = ?, read_at = COALESCE(read_at, ?)
                WHERE kb_id = ? AND id = ?
                """,
                (now, now, kb_id, alert_id),
            )
            self._conn.commit()
        return self.get_kb_alert(kb_id, alert_id)

    def dismiss_all_kb_alerts(self, kb_id: str) -> int:
        """Dismiss every active alert episode for a KB. Returns rows updated."""
        now = _now()
        with self._lock:
            self._assert_kb_exists(kb_id)
            cur = self._conn.execute(
                """
                UPDATE kb_alerts
                SET dismissed_at = ?, read_at = COALESCE(read_at, ?)
                WHERE kb_id = ? AND dismissed_at IS NULL
                """,
                (now, now, kb_id),
            )
            self._conn.commit()
            return int(cur.rowcount)

    def mark_all_kb_alerts_read(self, kb_id: str) -> int:
        """Mark active alerts as read without dismissing (F-ALT). Returns rows updated."""
        now = _now()
        with self._lock:
            self._assert_kb_exists(kb_id)
            cur = self._conn.execute(
                """
                UPDATE kb_alerts
                SET read_at = ?
                WHERE kb_id = ? AND dismissed_at IS NULL AND read_at IS NULL
                """,
                (now, kb_id),
            )
            self._conn.commit()
            return int(cur.rowcount)

    def _validate_quote_in_chunk(
        self, chunk_id: str, quote: str, quote_start: int, quote_end: int
    ) -> None:
        if quote_start < 0 or quote_end < quote_start:
            raise AdminError(422, "bad_quote", "引用偏移无效")
        row = self._conn.execute("SELECT text FROM chunks WHERE id = ?", (chunk_id,)).fetchone()
        if row is None:
            raise AdminError(404, "not_found", "分块不存在")
        text = row["text"]
        if text[quote_start:quote_end] != quote:
            raise AdminError(422, "quote_not_in_chunk", "引用与分块文本不匹配")
