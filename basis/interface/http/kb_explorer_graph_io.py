"""KB Explorer graph import/export routes."""

from __future__ import annotations

import asyncio
from typing import Any

from fastapi import APIRouter, Depends, Request
from fastapi.responses import Response

from basis.domain.errors import AdminError
from basis.domain.tenancy.admin.store import AdminStore, User
from basis.interface.http.deps import (
    explorer_runtime_for,
    get_current_user,
    get_kb_for_editor,
    get_kb_for_viewer,
    get_store,
)
from basis.domain.graph.explorer.session.guard import require_explorer_graph_session
from basis.domain.knowledge.services.graph_audit import audit_kb_graph

router = APIRouter(tags=["knowledge-bases"])

@router.post("/{kb_id}/import")
async def kb_import_graph(
    kb_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> Any:
    """
Kb Import Graph. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
    """
    get_kb_for_editor(request, user, kb_id, store)
    raise AdminError(
        409,
        "import_requires_review",
        "图导入请提交审核队列，并在批准后应用",
    )


@router.post("/{kb_id}/export")
async def kb_export_graph(
    kb_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> Response:
    """
Kb Export Graph. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
    """
    get_kb_for_viewer(request, user, kb_id, store)
    runtime = explorer_runtime_for(request, kb_id)
    session = require_explorer_graph_session(runtime)
    from basis.domain.graph.explorer.graph.export_read import export_graph

    raw = await request.json()
    fmt = raw.get("format", "json") if isinstance(raw, dict) else "json"
    node_ids = raw.get("node_ids") if isinstance(raw, dict) else None
    if node_ids is not None and not isinstance(node_ids, list):
        raise AdminError(422, "validation_error", "node_ids 须为字符串数组或省略")
    content, media_type, extension = await asyncio.to_thread(
        export_graph,
        session,
        format=str(fmt),
        node_ids=[str(n) for n in node_ids] if isinstance(node_ids, list) else None,
    )
    audit_kb_graph(
        store,
        user,
        kb_id,
        "kb.graph.export",
        extra={"format": str(fmt)},
    )
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="semantica_export.{extension}"'},
    )
