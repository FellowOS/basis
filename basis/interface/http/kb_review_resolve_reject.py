"""KB review reject route."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Request

from basis.domain.tenancy.admin.store import AdminStore, User
from basis.interface.http.deps import (
    get_blob_store,
    get_current_user,
    graph_projection_bindings,
    get_kb_for_editor,
    get_knowledge_store,
    get_store,
)
from basis.domain.knowledge.services.review_resolve import reject_review_item as reject_review_item_domain
from basis.domain.knowledge.store import KnowledgeStore
from basis.interface.http.kb_review_models import ResolveReviewRequest

router = APIRouter(tags=["knowledge-bases"])


@router.post("/{kb_id}/review/items/{item_id}/reject")
async def reject_review_item(
    kb_id: str,
    item_id: str,
    request: Request,
    body: ResolveReviewRequest,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    """
Reject Review Item. Human review queue for merges, imports, and conflicts. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
    """
    get_kb_for_editor(request, user, kb_id, store)
    return reject_review_item_domain(
        knowledge=knowledge,
        store=store,
        user=user,
        kb_id=kb_id,
        item_id=item_id,
        rationale=body.rationale,
        blob_store=get_blob_store(request),
        projection_bindings=graph_projection_bindings(request),
    )
