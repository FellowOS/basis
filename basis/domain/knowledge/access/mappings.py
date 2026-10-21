"""Ontology surface → URI mappings — KnowledgeStore API."""

from __future__ import annotations

import sqlite3
import uuid
from datetime import datetime, timezone
from typing import Any, TYPE_CHECKING

from sqlalchemy.exc import IntegrityError as SQLAlchemyIntegrityError

from basis.domain.errors import AdminError
from basis.domain.knowledge import sql_mappings as mapping_persist

if TYPE_CHECKING:
    from basis.domain.knowledge.store import KnowledgeStore

MAPPING_TARGET_KINDS = frozenset({"class", "property", "none"})
MAPPING_DIRECTIONS = frozenset({"forward", "reverse", "n/a"})
MAPPING_STATUSES = frozenset({"proposed", "confirmed", "rejected", "superseded"})


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class MappingsAccess:
    def __init__(self, store: KnowledgeStore) -> None:
        self._store = store

    def list_mappings(
        self,
        kb_id: str,
        *,
        status: str | None = None,
        include_invalidated: bool = False,
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        limit = min(max(1, limit), 200)
        if status and status not in MAPPING_STATUSES:
            raise AdminError(422, "bad_status", "无效的映射状态")
        with self._store._lock:
            self._store._assert_kb_exists(kb_id)
            rows = mapping_persist.list_mapping_rows(
                self._store._conn,
                kb_id,
                include_invalidated=include_invalidated,
                status=status,
                limit=limit,
            )
        return [mapping_persist.mapping_row_to_dict(row) for row in rows]

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
        if target_kind not in MAPPING_TARGET_KINDS:
            raise AdminError(422, "bad_target_kind", "target_kind 无效")
        if direction not in MAPPING_DIRECTIONS:
            raise AdminError(422, "bad_direction", "direction 无效")
        if status not in MAPPING_STATUSES:
            raise AdminError(422, "bad_status", "status 无效")
        mapping_id = str(uuid.uuid4())
        now = _now()
        with self._store._lock:
            self._store._assert_kb_exists(kb_id)
            try:
                mapping_persist.insert_mapping(
                    self._store._conn,
                    mapping_id=mapping_id,
                    kb_id=kb_id,
                    signature=signature,
                    target_uri=target_uri,
                    target_kind=target_kind,
                    direction=direction,
                    status=status,
                    actor_id=actor_id,
                    why=why,
                    created_at=now,
                )
                self._store._conn.commit()
            except (sqlite3.IntegrityError, SQLAlchemyIntegrityError) as exc:
                raise AdminError(
                    409,
                    "mapping_exists",
                    "已存在相同签名的已确认映射",
                ) from exc
        return self.get_mapping(kb_id, mapping_id)

    def get_mapping(self, kb_id: str, mapping_id: str) -> dict[str, Any]:
        with self._store._lock:
            self._store._assert_kb_exists(kb_id)
            row = mapping_persist.fetch_mapping(
                self._store._conn, kb_id, mapping_id
            )
        if row is None:
            raise AdminError(404, "not_found", "映射不存在")
        return mapping_persist.mapping_row_to_dict(row)

    def update_mapping_status(
        self,
        kb_id: str,
        mapping_id: str,
        actor_id: str,
        *,
        status: str,
        why: str | None = None,
    ) -> dict[str, Any]:
        if status not in MAPPING_STATUSES:
            raise AdminError(422, "bad_status", "status 无效")
        now = _now()
        with self._store._lock:
            self._store._assert_kb_exists(kb_id)
            row = mapping_persist.fetch_mapping_status_row(
                self._store._conn, kb_id, mapping_id
            )
            if row is None:
                raise AdminError(404, "not_found", "映射不存在")
            if row["invalidated_at"] is not None:
                raise AdminError(409, "mapping_invalidated", "映射已失效")
            try:
                mapping_persist.update_mapping_status_row(
                    self._store._conn,
                    kb_id,
                    mapping_id,
                    status=status,
                    why=why,
                    actor_id=actor_id,
                )
                if status in {"rejected", "superseded"}:
                    mapping_persist.invalidate_mapping_row(
                        self._store._conn, kb_id, mapping_id, now
                    )
                self._store._conn.commit()
            except (sqlite3.IntegrityError, SQLAlchemyIntegrityError) as exc:
                raise AdminError(
                    409, "mapping_exists", "已存在相同签名的已确认映射"
                ) from exc
        return self.get_mapping(kb_id, mapping_id)

    def list_distinct_surface_phrases(self, kb_id: str, *, limit: int = 100) -> list[str]:
        limit = min(max(1, limit), 200)
        with self._store._lock:
            self._store._assert_kb_exists(kb_id)
            return mapping_persist.list_distinct_surface_phrases(
                self._store._conn, kb_id, limit
            )

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
        with self._store._lock:
            conn = self._store._conn
            rows = mapping_persist.statements_for_mapping_materialization(
                conn, kb_id, signature
            )
            for row in rows:
                object_entity_id = row["object_entity_id"]
                object_value = row["object_value"]
                if object_entity_id and object_value:
                    continue
                if not object_entity_id and not object_value:
                    continue
                if mapping_persist.typed_fact_exists_for_statement_mapping(
                    conn, kb_id, row["id"], mapping_id
                ):
                    continue
                fact_id = str(uuid.uuid4())
                mapping_persist.insert_typed_fact_from_statement(
                    conn,
                    fact_id=fact_id,
                    kb_id=kb_id,
                    subject_id=row["subject_id"],
                    predicate_uri=predicate_uri,
                    object_entity_id=object_entity_id,
                    object_value=object_value,
                    from_statement_id=row["id"],
                    mapping_id=mapping_id,
                    confidence=row["confidence"],
                    recorded_at=now,
                )
                created += 1
            conn.commit()
        return {"created": created, "mapping_id": mapping_id}
