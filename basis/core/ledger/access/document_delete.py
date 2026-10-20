"""Document hard-delete API on KnowledgeStore."""

from __future__ import annotations

from typing import TYPE_CHECKING

from basis.core.ledger.persistence.document_delete import execute_hard_delete_document

if TYPE_CHECKING:
    from basis.core.ledger.store import KnowledgeStore


class DocumentDeleteAccess:
    def __init__(self, store: KnowledgeStore) -> None:
        self._store = store

    def execute_hard_delete_document(self, kb_id: str, document_id: str) -> dict:
        with self._store._lock:
            self._store._assert_kb_exists(kb_id)
            return execute_hard_delete_document(self._store, kb_id, document_id)
