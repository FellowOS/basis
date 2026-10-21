"""Workspace ledger entity delete and merge revert."""

from __future__ import annotations

import asyncio
from typing import Any

from fastapi import APIRouter, Depends, Request

from basis.domain.tenancy.admin.store import AdminStore, User
from basis.interface.http.deps import (
    get_current_user,
    get_workspace_for_editor,
    get_knowledge_store,
    get_store,
    rebuild_kb_projection,
)
from basis.domain.knowledge.services.graph_audit import audit_kb_graph
from basis.domain.knowledge.store import KnowledgeStore

router = APIRouter(tags=["knowledge-bases"])

@router.delete("/{workspace_id}/ledger/entities/{entity_id}")
async def delete_ledger_entity(
    workspace_id: str,
    entity_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    """
Delete Ledger Entity. Evidence ledger: documents, chunks, statements, entities. Requires workspace membership (session) or workspace API token with read/write scope. All paths are scoped to `{workspace_id}`.
    """
    get_workspace_for_editor(request, user, workspace_id, store)
    outcome = knowledge.delete_entity(workspace_id, entity_id)
    projection = await asyncio.to_thread(rebuild_kb_projection, request, workspace_id)
    audit_kb_graph(
        store,
        user,
        workspace_id,
        "kb.ledger.entity_delete",
        extra={
            "entity_id": outcome["entity_id"],
            "canonical_label": outcome["canonical_label"],
            "statements_removed": outcome["statements_removed"],
            "projection": projection,
        },
    )
    return {"ok": True, **outcome, "projection": projection}

@router.post("/{workspace_id}/ledger/entity-merges/{merge_id}/revert")
async def revert_entity_merge_route(
    workspace_id: str,
    merge_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    """
Revert Entity Merge Route. Evidence ledger: documents, chunks, statements, entities. Requires workspace membership (session) or workspace API token with read/write scope. All paths are scoped to `{workspace_id}`.
    """
    get_workspace_for_editor(request, user, workspace_id, store)
    merged = knowledge.revert_entity_merge(workspace_id, merge_id, reverted_by=user.id)
    projection = rebuild_kb_projection(request, workspace_id)
    audit_kb_graph(
        store,
        user,
        workspace_id,
        "kb.ledger.entity_merge_revert",
        extra={"merge_id": merge_id, "merge": merged, "projection": projection},
    )
    return {"merge": merged, "projection": projection}
