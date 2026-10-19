"""Shim — use KnowledgeStore.execute_hard_delete_document / hard_delete_document."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from basis.domain.kb.store import KnowledgeStore


def execute_hard_delete_document(
    store: KnowledgeStore,
    kb_id: str,
    document_id: str,
) -> dict[str, Any]:
    return store.execute_hard_delete_document(kb_id, document_id)
