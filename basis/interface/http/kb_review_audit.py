"""KB graph mutation audit listing."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query, Request

from basis.domain.tenancy.admin.store import AdminStore, User
from basis.interface.http.deps import get_current_user, get_kb_for_viewer, get_store

router = APIRouter(tags=["knowledge-bases"])

@router.get("/{kb_id}/audit/graph-mutations")
async def list_kb_graph_audit(
    kb_id: str,
    request: Request,
    limit: int = Query(50, ge=1, le=200),
    action_prefix: str = Query("kb.graph."),
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> dict[str, Any]:
    """
List Kb Graph Audit. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
    """
    get_kb_for_viewer(request, user, kb_id, store)
    prefix = action_prefix.strip() or "kb.graph."
    events = store.list_audit_for_kb(kb_id, action_prefix=prefix, limit=limit)
    return {"events": events}
