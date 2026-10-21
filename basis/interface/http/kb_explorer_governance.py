"""KB Explorer enrich, provenance, and decisions routes."""

from __future__ import annotations

import asyncio
from typing import Any, Optional

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import PlainTextResponse, Response

from basis.domain.errors import AdminError
from basis.domain.tenancy.admin.store import AdminStore, User
from basis.interface.http.deps import (
    get_current_user,
    explorer_runtime_for,
    get_kb_for_editor,
    get_kb_for_viewer,
    get_runtime_limits,
    get_store,
)
from basis.domain.graph.explorer.session.guard import require_explorer_graph_session
from basis.infra.runtime.limits import RuntimeLimits
from basis.interface.http.kb_explorer_shared import link_prediction_semaphore

router = APIRouter(tags=["knowledge-bases"])

@router.post("/{kb_id}/enrich/links")
async def kb_enrich_links(
    kb_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> Any:
    """
Kb Enrich Links. Graph enrichment and governance proposals. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
    """
    get_kb_for_viewer(request, user, kb_id, store)
    runtime = explorer_runtime_for(request, kb_id)
    session = require_explorer_graph_session(runtime)
    from basis.domain.graph.explorer.governance.enrich_read import predict_links

    raw = await request.json()
    if not isinstance(raw, dict):
        raise AdminError(422, "validation_error", "请求体须为 JSON 对象")
    node_id = str(raw.get("node_id") or "")
    if not node_id:
        raise AdminError(422, "validation_error", "node_id 必填")
    top_n = int(raw.get("top_n", 10))
    min_score = float(raw.get("min_score", 0.0))
    candidate_type = raw.get("candidate_type")
    async with link_prediction_semaphore:
        return await asyncio.to_thread(
            predict_links,
            session,
            node_id=node_id,
            top_n=top_n,
            candidate_type=str(candidate_type) if candidate_type else None,
            min_score=min_score,
        )


@router.post("/{kb_id}/enrich/dedup")
async def kb_enrich_dedup(
    kb_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> Any:
    """
Kb Enrich Dedup. Graph enrichment and governance proposals. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
    """
    get_kb_for_viewer(request, user, kb_id, store)
    runtime = explorer_runtime_for(request, kb_id)
    session = require_explorer_graph_session(runtime)
    from basis.domain.graph.explorer.governance.enrich_read import detect_duplicates

    raw = await request.json()
    threshold = float(raw.get("threshold", 0.8)) if isinstance(raw, dict) else 0.8
    return await asyncio.to_thread(detect_duplicates, session, threshold=threshold)


@router.post("/{kb_id}/enrich/merge")
async def kb_enrich_merge(
    kb_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> Any:
    """Direct graph merge is disabled; use the review queue (Gate D)."""
    get_kb_for_editor(request, user, kb_id, store)
    raise AdminError(
        409,
        "merge_requires_review",
        "图节点合并请提交审核队列，并在批准后应用",
    )


@router.get("/{kb_id}/provenance")
async def kb_provenance_lineage(
    kb_id: str,
    request: Request,
    node_id: Optional[str] = Query(None),
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> Any:
    """
Kb Provenance Lineage. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
    """
    get_kb_for_viewer(request, user, kb_id, store)
    runtime = explorer_runtime_for(request, kb_id)
    session = require_explorer_graph_session(runtime)
    from basis.domain.graph.explorer.governance.provenance_read import get_provenance_lineage

    return await asyncio.to_thread(get_provenance_lineage, session, node_id)


@router.get("/{kb_id}/provenance/report")
async def kb_provenance_report(
    kb_id: str,
    request: Request,
    node_id: str = Query(...),
    format: str = Query("json"),
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> Response:
    """
Kb Provenance Report. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
    """
    get_kb_for_viewer(request, user, kb_id, store)
    runtime = explorer_runtime_for(request, kb_id)
    session = require_explorer_graph_session(runtime)
    from basis.domain.graph.explorer.governance.provenance_read import export_provenance_report

    body, media_type, disposition = await asyncio.to_thread(
        export_provenance_report,
        session,
        node_id,
        format=format,
    )
    if isinstance(body, str):
        return PlainTextResponse(
            body,
            media_type=media_type,
            headers={"Content-Disposition": disposition},
        )
    return Response(
        content=body,
        media_type=media_type,
        headers={"Content-Disposition": disposition},
    )


