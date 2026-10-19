"""Shim — use KnowledgeStore.preview_entity_deletion / execute_delete_entity."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from basis.domain.kb.store import KnowledgeStore


def preview_entity_deletion(store: KnowledgeStore, kb_id: str, entity_id: str) -> dict[str, Any]:
    return store.preview_entity_deletion(kb_id, entity_id)


def execute_delete_entity(store: KnowledgeStore, kb_id: str, entity_id: str) -> dict[str, Any]:
    return store.execute_delete_entity(kb_id, entity_id)
