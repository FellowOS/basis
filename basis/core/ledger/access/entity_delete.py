"""Entity delete API on KnowledgeStore."""

from __future__ import annotations

from typing import TYPE_CHECKING

from basis.core.ledger.persistence.entity_delete import (
    execute_delete_entity as _execute_delete_entity,
    preview_entity_deletion as _preview_entity_deletion,
)

if TYPE_CHECKING:
    from basis.core.ledger.store import KnowledgeStore


class EntityDeleteAccess:
    def __init__(self, store: KnowledgeStore) -> None:
        self._store = store

    def preview_entity_deletion(self, kb_id: str, entity_id: str) -> dict:
        with self._store._lock:
            self._store._assert_kb_exists(kb_id)
            return _preview_entity_deletion(self._store._conn, kb_id, entity_id)

    def execute_delete_entity(self, kb_id: str, entity_id: str) -> dict:
        with self._store._lock:
            self._store._assert_kb_exists(kb_id)
            return _execute_delete_entity(self._store._conn, kb_id, entity_id)
