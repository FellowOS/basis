"""KB Explorer governance decision read routes."""

from __future__ import annotations

import asyncio
from typing import Any, Optional

from fastapi import APIRouter, Depends, Query, Request

from basis.domain.tenancy.admin.store import AdminStore, User
from basis.interface.http.deps import (
    graph_workspace_runtime_for,
    get_current_user,
    get_kb_for_viewer,
    get_runtime_limits,
    get_store,
)
from basis.domain.graph.workspace.session.guard import require_graph_workspace_session
from basis.infra.runtime.limits import RuntimeLimits

router = APIRouter(tags=["knowledge-bases"])

@router.get("/{kb_id}/decisions")
async def kb_list_decisions(
    kb_id: str,
    request: Request,
    category: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1),
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    limits: RuntimeLimits = Depends(get_runtime_limits),
) -> Any:
    """
Kb List Decisions. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
    """
    get_kb_for_viewer(request, user, kb_id, store)
    runtime = graph_workspace_runtime_for(request, kb_id)
    session = require_graph_workspace_session(runtime)
    from basis.domain.graph.workspace.governance.decisions_read import list_decisions

    capped = min(max(1, limit), limits.graph_workspace_decisions_max_limit)
    return await asyncio.to_thread(
        list_decisions,
        session,
        category=category,
        skip=skip,
        limit=capped,
    )


@router.get("/{kb_id}/decisions/{decision_id}/chain")
async def kb_decision_chain(
    kb_id: str,
    decision_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> Any:
    """
Kb Decision Chain. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
    """
    get_kb_for_viewer(request, user, kb_id, store)
    runtime = graph_workspace_runtime_for(request, kb_id)
    session = require_graph_workspace_session(runtime)
    from basis.domain.graph.workspace.governance.decisions_read import get_causal_chain

    return await asyncio.to_thread(get_causal_chain, session, decision_id)

