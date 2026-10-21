"""Graph projection ledger reads and projection_state — KnowledgeStore API."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, TYPE_CHECKING

from basis.domain.errors import AdminError
from basis.domain.knowledge import sql_projection_reads as proj_read_persist
from basis.domain.knowledge.sql_projection_state import (
    bump_projection_revision_row,
    fetch_projection_state_row,
    insert_projection_state_ignore,
    ledger_temporal_bounds,
    projection_state_dict,
    update_projection_status,
)

if TYPE_CHECKING:
    from basis.domain.knowledge.store import KnowledgeStore


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class ProjectionAccess:
    def __init__(self, store: KnowledgeStore) -> None:
        self._store = store

    def get_ledger_temporal_bounds(self, kb_id: str) -> dict[str, str | None]:
        with self._store._lock:
            self._store._assert_kb_exists(kb_id)
            return ledger_temporal_bounds(self._store._conn, kb_id)

    def ensure_projection_state(self, kb_id: str) -> None:
        with self._store._lock:
            self._store._assert_kb_exists(kb_id)
            insert_projection_state_ignore(
                self._store._conn,
                kb_id,
                schema_version=self._store.PROJECTION_SCHEMA_VERSION,
            )
            self._store._conn.commit()

    def get_projection_state(self, kb_id: str) -> dict[str, Any]:
        with self._store._lock:
            self._store._assert_kb_exists(kb_id)
            conn = self._store._conn
            insert_projection_state_ignore(
                conn, kb_id, schema_version=self._store.PROJECTION_SCHEMA_VERSION
            )
            conn.commit()
            row = fetch_projection_state_row(conn, kb_id)
        if row is None:
            raise AdminError(404, "not_found", "投影状态不存在")
        return projection_state_dict(row)

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
        with self._store._lock:
            update_projection_status(self._store._conn, kb_id, status, error_code)
            self._store._conn.commit()

    def bump_projection_revision(self, kb_id: str) -> int:
        self.ensure_projection_state(kb_id)
        now = _now()
        with self._store._lock:
            revision = bump_projection_revision_row(
                self._store._conn,
                kb_id,
                built_at=now,
                schema_version=self._store.PROJECTION_SCHEMA_VERSION,
            )
            self._store._conn.commit()
        return revision

    def list_ready_documents_for_projection(
        self,
        kb_id: str,
        *,
        include_version_ids: tuple[str, ...] | None = None,
    ) -> list[dict[str, Any]]:
        with self._store._lock:
            return proj_read_persist.list_ready_documents_for_projection(
                self._store._conn,
                kb_id,
                include_version_ids=include_version_ids,
            )

    def list_entities_for_projection(self, kb_id: str) -> list[dict[str, Any]]:
        with self._store._lock:
            return proj_read_persist.list_entities_for_projection(
                self._store._conn, kb_id
            )

    def list_statements_for_projection(self, kb_id: str) -> list[dict[str, Any]]:
        with self._store._lock:
            return proj_read_persist.list_statements_for_projection(
                self._store._conn, kb_id
            )

    def list_statements_for_temporal_projection(self, kb_id: str) -> list[dict[str, Any]]:
        with self._store._lock:
            return proj_read_persist.list_statements_for_temporal_projection(
                self._store._conn, kb_id
            )

    def list_entities_for_temporal_projection(self, kb_id: str) -> list[dict[str, Any]]:
        with self._store._lock:
            return proj_read_persist.list_entities_for_temporal_projection(
                self._store._conn, kb_id
            )

    def list_typed_facts_for_temporal_projection(self, kb_id: str) -> list[dict[str, Any]]:
        with self._store._lock:
            self._store._assert_kb_exists(kb_id)
            return proj_read_persist.list_typed_facts_for_temporal_projection(
                self._store._conn, kb_id
            )

    def list_derived_facts_for_temporal_projection(self, kb_id: str) -> list[dict[str, Any]]:
        with self._store._lock:
            self._store._assert_kb_exists(kb_id)
            return proj_read_persist.list_derived_facts_for_temporal_projection(
                self._store._conn, kb_id
            )

    def list_typed_facts_for_projection(self, kb_id: str) -> list[dict[str, Any]]:
        with self._store._lock:
            self._store._assert_kb_exists(kb_id)
            return proj_read_persist.list_typed_facts_for_projection(
                self._store._conn, kb_id
            )

    def list_derived_facts_for_projection(self, kb_id: str) -> list[dict[str, Any]]:
        with self._store._lock:
            self._store._assert_kb_exists(kb_id)
            return proj_read_persist.list_derived_facts_for_projection(
                self._store._conn, kb_id
            )
