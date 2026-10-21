"""KB Explorer temporal scrubber routes."""

from __future__ import annotations

import asyncio
from typing import Any

from fastapi import APIRouter, Depends, Query, Request

from basis.domain.tenancy.admin.store import AdminStore, User
from basis.interface.http.deps import (
    get_current_user,
    graph_workspace_runtime_for,
    get_kb_for_viewer,
    get_knowledge_store,
    get_store,
)
from basis.domain.graph.workspace.session.guard import require_graph_workspace_session

router = APIRouter(tags=["knowledge-bases"])


@router.get("/{kb_id}/temporal/bounds")
async def kb_temporal_bounds(
    kb_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> Any:
    """Temporal scrubber bounds for the KB graph (F-TIM-03 / F-TIM-04).

    Returns `{min, max}` ISO instants. When the Explorer projection lacks node `valid_from`,
    `min` / `max` fall back to ledger timestamps (statements, facts, current document version).
    """
    get_kb_for_viewer(request, user, kb_id, store)
    runtime = graph_workspace_runtime_for(request, kb_id)
    session = require_graph_workspace_session(runtime)
    from basis.domain.graph.workspace.temporal.read import get_temporal_bounds

    base_bounds = await asyncio.to_thread(get_temporal_bounds, session)
    if isinstance(base_bounds, dict):
        ledger = get_knowledge_store(request).get_ledger_temporal_bounds(kb_id)
        merged = dict(base_bounds)
        if not merged.get("min") and ledger.get("min"):
            merged["min"] = ledger["min"]
        if not merged.get("max") and ledger.get("max"):
            merged["max"] = ledger["max"]
        payload = merged
    return payload


@router.get("/{kb_id}/temporal/snapshot")
async def kb_temporal_snapshot(
    kb_id: str,
    request: Request,
    at: str | None = None,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> Any:
    """Graph projection at an instant (F-TIM-03 / scrubber).

    Primary path: Explorer `temporal_snapshot`. When that returns no nodes but the Basis
    projector supports `state_at`, falls back to the same snapshot used by `GET .../graph/diff`.
    """
    get_kb_for_viewer(request, user, kb_id, store)
    runtime = graph_workspace_runtime_for(request, kb_id)
    session = require_graph_workspace_session(runtime)
    from basis.domain.graph.workspace.graph.diff import parse_query_dt
    from basis.domain.graph.workspace.temporal.read import get_temporal_snapshot
    from basis.domain.graph.projection.projector import build_temporal_graph_from_ledger

    payload = await asyncio.to_thread(get_temporal_snapshot, session, at)
    if at:
        try:
            instant = parse_query_dt(at)
            temporal_session = build_temporal_graph_from_ledger(
                get_knowledge_store(request), kb_id, preserve_from=session
            )
            state = temporal_session.graph.state_at(instant)
        except ValueError:
            state = None
        if isinstance(state, dict) and (state.get("nodes") is not None):
            base = dict(payload) if isinstance(payload, dict) else {}
            state_nodes = state.get("nodes") or []
            state_node_ids = [
                str(n.get("id"))
                for n in state_nodes
                if isinstance(n, dict) and n.get("id")
            ]
            active_ids = state_node_ids if state_nodes or not base.get("active_node_ids") else base.get("active_node_ids")
            payload = {
                **base,
                "active_node_ids": active_ids,
                "active_node_count": len(active_ids),
                "nodes": state_nodes,
                "edges": state.get("edges") or [],
                "at": instant.isoformat(),
                "source": "graph_state_at",
            }
    return payload


@router.get("/{kb_id}/temporal/diff")
async def kb_temporal_diff(
    kb_id: str,
    request: Request,
    from_time: str = Query(..., alias="from"),
    to_time: str = Query(..., alias="to"),
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> Any:
    """
Kb Temporal Diff. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
    """
    get_kb_for_viewer(request, user, kb_id, store)
    runtime = graph_workspace_runtime_for(request, kb_id)
    session = require_graph_workspace_session(runtime)
    from basis.domain.graph.workspace.graph.diff import diff_session_at
    from basis.domain.graph.projection.projector import build_temporal_graph_from_ledger

    temporal_session = build_temporal_graph_from_ledger(
        get_knowledge_store(request), kb_id, preserve_from=session
    )
    diff = diff_session_at(temporal_session, from_time, to_time)
    return {
        "from_time": diff["from_time"],
        "to_time": diff["to_time"],
        "added_nodes": diff["added_nodes"],
        "removed_nodes": diff["removed_nodes"],
    }


