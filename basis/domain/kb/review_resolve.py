"""Sync review resolution helpers for integration core (MCP / HTTP)."""

from __future__ import annotations

from typing import Any, Callable

from basis.platform.admin.errors import AdminError
from basis.platform.admin.store import AdminStore, User
from basis.domain.kb.conflict_review import scan_statement_conflicts
from basis.domain.kb.graph_audit import audit_kb_graph
from basis.domain.kb.services.remember_service import STATEMENT_REVIEW_KIND
from basis.domain.kb.store import KnowledgeStore


def approve_statement_remember_review(
    *,
    knowledge: KnowledgeStore,
    store: AdminStore,
    user: User,
    kb_id: str,
    item_id: str,
    rationale: str | None,
    rebuild_projection: Callable[[], Any] | None = None,
    audit_extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Approve an open ``statement_remember`` review item (MCP / core parity with console)."""
    item = knowledge.get_review_item(kb_id, item_id)
    if item["status"] != "open":
        raise AdminError(409, "review_closed", "审核项已处理")
    if item.get("kind") != STATEMENT_REVIEW_KIND:
        raise AdminError(422, "unsupported_review_kind", f"不支持的审核类型: {item.get('kind')}")
    payload = item.get("payload") or {}
    statement_id = str(payload.get("statement_id") or item["subject_id"])
    knowledge.set_statement_status(kb_id, statement_id, "confirmed")
    if rebuild_projection is not None:
        rebuild_projection()
    merge_result = {
        "statement_id": statement_id,
        "status": "confirmed",
        "conflicts": scan_statement_conflicts(knowledge, kb_id),
    }
    resolved = knowledge.resolve_review_item(
        kb_id,
        item_id,
        status="approved",
        resolved_by=user.id,
        rationale=rationale,
    )
    audit_extra_merged: dict[str, Any] = {"merge": merge_result, "rationale": rationale}
    if audit_extra:
        audit_extra_merged.update(audit_extra)
    audit_kb_graph(
        store,
        user,
        kb_id,
        "kb.statement.remember_approved",
        review_item_id=item_id,
        extra=audit_extra_merged,
    )
    return {"item": resolved, "merge": merge_result}


def reject_statement_remember_review(
    *,
    knowledge: KnowledgeStore,
    store: AdminStore,
    user: User,
    kb_id: str,
    item_id: str,
    rationale: str | None,
) -> dict[str, Any]:
    """Reject an open ``statement_remember`` review item."""
    item = knowledge.get_review_item(kb_id, item_id)
    if item["status"] != "open":
        raise AdminError(409, "review_closed", "审核项已处理")
    if item.get("kind") != STATEMENT_REVIEW_KIND:
        raise AdminError(422, "unsupported_review_kind", f"不支持的审核类型: {item.get('kind')}")
    payload = item.get("payload") or {}
    statement_id = str(payload.get("statement_id") or item["subject_id"])
    knowledge.set_statement_status(kb_id, statement_id, "rejected")
    resolved = knowledge.resolve_review_item(
        kb_id,
        item_id,
        status="rejected",
        resolved_by=user.id,
        rationale=rationale,
    )
    audit_kb_graph(
        store,
        user,
        kb_id,
        "kb.statement.remember_rejected",
        review_item_id=item_id,
        extra={"rationale": rationale, "payload": item.get("payload")},
    )
    return {"item": resolved}
