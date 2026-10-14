"""Audit helpers for KB-scoped graph mutations."""

from __future__ import annotations

from typing import Any

from sema.admin.store import AdminStore, User


def audit_kb_graph(
    store: AdminStore,
    actor: User,
    kb_id: str,
    action: str,
    *,
    review_item_id: str | None = None,
    extra: dict[str, Any] | None = None,
) -> None:
    detail: dict[str, Any] = {"kb_id": kb_id}
    if review_item_id:
        detail["review_item_id"] = review_item_id
    if extra:
        detail.update(extra)
    store.record_audit(
        actor.id,
        action,
        "knowledge_base",
        kb_id,
        detail,
    )
