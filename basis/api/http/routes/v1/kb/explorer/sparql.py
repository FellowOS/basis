"""KB Explorer SPARQL execution."""

from __future__ import annotations

import asyncio
from typing import Any

from fastapi import APIRouter, Depends, Request

from basis.core.errors import AdminError
from basis.control.admin.store import AdminStore, User
from basis.api.http.deps import (
    explorer_runtime_for,
    get_current_user,
    get_kb_for_viewer,
    get_store,
)
from basis.core.explorer.session.guard import require_explorer_graph_session
from basis.api.http.routes.v1.kb.explorer.shared import sparql_semaphore
from basis.core.explorer.sparql.read import (
    SPARQL_TIMEOUT_S,
    build_sparql_graph,
    run_sparql_on_graph,
    sparql_error_response,
    sparql_query_preflight,
    sparql_timeout_response,
)

router = APIRouter(tags=["knowledge-bases"])

@router.post("/{kb_id}/sparql")
async def kb_sparql_execute(
    kb_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> Any:
    """
Kb Sparql Execute. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
    """
    get_kb_for_viewer(request, user, kb_id, store)
    runtime = explorer_runtime_for(request, kb_id)
    session = require_explorer_graph_session(runtime)
    raw = await request.json()
    query = raw.get("query", "") if isinstance(raw, dict) else ""
    if not isinstance(query, str):
        raise AdminError(422, "validation_error", "query 必填且为字符串")

    preflight = sparql_query_preflight(query)
    if preflight is not None:
        return preflight

    try:
        graph = await asyncio.to_thread(build_sparql_graph, session)
    except ValueError as exc:
        return sparql_error_response(str(exc))

    async with sparql_semaphore:
        try:
            return await asyncio.wait_for(
                asyncio.to_thread(run_sparql_on_graph, graph, query),
                timeout=SPARQL_TIMEOUT_S,
            )
        except asyncio.TimeoutError:
            return sparql_timeout_response()

