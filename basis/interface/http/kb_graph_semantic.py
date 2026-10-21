"""KB Explorer semantic graph analytics."""

from __future__ import annotations

import asyncio
from typing import Any

from fastapi import APIRouter, Depends, Query, Request

from basis.domain.errors import AdminError
from basis.domain.tenancy.admin.store import AdminStore, User
from basis.interface.http.deps import (
    kb_graph_runtime_for,
    get_current_user,
    get_kb_for_viewer,
    get_store,
)
from basis.domain.graph.session.guard import require_kb_graph_session

router = APIRouter(tags=["knowledge-bases"])

@router.get("/{kb_id}/graph/semantic-neighborhood")
async def kb_graph_semantic_neighborhood(
    kb_id: str,
    request: Request,
    node_id: str = Query(...),
    top_k: int = Query(20, ge=1, le=200),
    min_similarity: float = Query(0.0, ge=0.0, le=1.0),
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> Any:
    """
Kb Graph Semantic Neighborhood. Projected graph read API (Explorer runtime). Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
    """
    get_kb_for_viewer(request, user, kb_id, store)
    runtime = kb_graph_runtime_for(request, kb_id)
    session = require_kb_graph_session(runtime)
    from basis.domain.graph.reads.semantic_read import semantic_neighborhood

    return await asyncio.to_thread(
        semantic_neighborhood,
        session,
        node_id,
        top_k=top_k,
        min_similarity=min_similarity,
    )


@router.post("/{kb_id}/graph/distance-matrix")
async def kb_graph_distance_matrix(
    kb_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> Any:
    """
Kb Graph Distance Matrix. Projected graph read API (Explorer runtime). Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
    """
    get_kb_for_viewer(request, user, kb_id, store)
    runtime = kb_graph_runtime_for(request, kb_id)
    session = require_kb_graph_session(runtime)
    from basis.domain.graph.reads.semantic_read import distance_matrix

    raw = await request.json()
    node_ids = raw.get("node_ids") if isinstance(raw, dict) else None
    metric = raw.get("metric", "hops") if isinstance(raw, dict) else "hops"
    if not isinstance(node_ids, list) or not node_ids:
        raise AdminError(422, "validation_error", "node_ids 必填且为非空数组")
    return await asyncio.to_thread(
        distance_matrix,
        session,
        node_ids=[str(n) for n in node_ids],
        metric=str(metric),
    )

