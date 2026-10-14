"""KB-prefixed adapters for Semantica Explorer routes used by GraphWorkspace."""

from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import Response

from sema.admin.errors import AdminError
from sema.admin.store import AdminStore, User
from sema.api.deps import (
    get_current_user,
    get_explorer_registry,
    get_kb_for_editor,
    get_kb_for_viewer,
    get_runtime_limits,
    get_store,
    save_graph,
)
from sema.api.explorer_route_errors import invoke_explorer
from sema.explorer.session_guard import require_explorer_graph_session
from sema.limits import RuntimeLimits
from sema.knowledge.graph_audit import audit_kb_graph

router = APIRouter(prefix="/api/kbs", tags=["knowledge-bases"])


@router.get("/{kb_id}/temporal/bounds")
async def kb_temporal_bounds(
    kb_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> Any:
    get_kb_for_viewer(request, user, kb_id, store)
    runtime = get_explorer_registry(request).get(request, kb_id)
    session = require_explorer_graph_session(runtime)
    from semantica.explorer.routes.temporal import temporal_bounds

    return await invoke_explorer(temporal_bounds(session=session), context="temporal")


@router.get("/{kb_id}/temporal/snapshot")
async def kb_temporal_snapshot(
    kb_id: str,
    request: Request,
    at: str | None = None,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> Any:
    get_kb_for_viewer(request, user, kb_id, store)
    runtime = get_explorer_registry(request).get(request, kb_id)
    session = require_explorer_graph_session(runtime)
    from semantica.explorer.routes.temporal import temporal_snapshot

    return await invoke_explorer(temporal_snapshot(at=at, session=session), context="temporal")


@router.post("/{kb_id}/enrich/links")
async def kb_enrich_links(
    kb_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> Any:
    get_kb_for_viewer(request, user, kb_id, store)
    runtime = get_explorer_registry(request).get(request, kb_id)
    session = require_explorer_graph_session(runtime)
    from semantica.explorer.routes.enrich import predict_links
    from semantica.explorer.schemas import LinkPredictionRequest

    raw = await request.json()
    payload = LinkPredictionRequest.model_validate(raw)
    return await invoke_explorer(predict_links(payload, session=session), context="enrich")


@router.post("/{kb_id}/enrich/dedup")
async def kb_enrich_dedup(
    kb_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> Any:
    get_kb_for_viewer(request, user, kb_id, store)
    runtime = get_explorer_registry(request).get(request, kb_id)
    session = require_explorer_graph_session(runtime)
    from semantica.explorer.routes.enrich import detect_duplicates
    from semantica.explorer.schemas import DedupRequest

    raw = await request.json()
    payload = DedupRequest.model_validate(raw)
    return await invoke_explorer(detect_duplicates(payload, session=session), context="enrich")


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


@router.get("/{kb_id}/provenance/report")
async def kb_provenance_report(
    kb_id: str,
    request: Request,
    node_id: str = Query(...),
    format: str = Query("json"),
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> Response:
    get_kb_for_viewer(request, user, kb_id, store)
    runtime = get_explorer_registry(request).get(request, kb_id)
    session = require_explorer_graph_session(runtime)
    from semantica.explorer.routes.provenance import export_provenance_report

    return await invoke_explorer(
        export_provenance_report(node_id=node_id, format=format, session=session),
        context="provenance",
    )


@router.post("/{kb_id}/sparql")
async def kb_sparql_execute(
    kb_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> Any:
    get_kb_for_viewer(request, user, kb_id, store)
    runtime = get_explorer_registry(request).get(request, kb_id)
    session = require_explorer_graph_session(runtime)
    from semantica.explorer.routes.sparql import SparqlRequest, execute_sparql

    raw = await request.json()
    payload = SparqlRequest.model_validate(raw)
    return await invoke_explorer(execute_sparql(payload, session=session), context="sparql")


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
    get_kb_for_viewer(request, user, kb_id, store)
    runtime = get_explorer_registry(request).get(request, kb_id)
    session = require_explorer_graph_session(runtime)
    from semantica.explorer.routes.graph import semantic_neighborhood_by_query

    return await invoke_explorer(
        semantic_neighborhood_by_query(
            node_id=node_id,
            top_k=top_k,
            min_similarity=min_similarity,
            session=session,
        ),
        context="semantic_neighborhood",
    )


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
    get_kb_for_viewer(request, user, kb_id, store)
    runtime = get_explorer_registry(request).get(request, kb_id)
    session = require_explorer_graph_session(runtime)
    from semantica.explorer.routes.decisions import list_decisions

    capped = min(max(1, limit), limits.explorer_decisions_max_limit)
    return await invoke_explorer(
        list_decisions(
            category=category,
            skip=skip,
            limit=capped,
            session=session,
        ),
        context="decisions",
    )


@router.get("/{kb_id}/decisions/{decision_id}/chain")
async def kb_decision_chain(
    kb_id: str,
    decision_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> Any:
    get_kb_for_viewer(request, user, kb_id, store)
    runtime = get_explorer_registry(request).get(request, kb_id)
    session = require_explorer_graph_session(runtime)
    from semantica.explorer.routes.decisions import get_causal_chain

    return await invoke_explorer(
        get_causal_chain(decision_id=decision_id, session=session),
        context="decisions",
    )


@router.post("/{kb_id}/reasoning/run")
async def kb_reasoning_run(
    kb_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> Any:
    from semantica.explorer.routes.enrich import run_reasoning
    from semantica.explorer.schemas import ReasoningRequest

    raw = await request.json()
    payload = ReasoningRequest.model_validate(raw)
    role = "editor" if payload.apply_to_graph else "viewer"
    store.get_kb_for(user, kb_id, role)
    runtime = get_explorer_registry(request).get(request, kb_id)
    session = require_explorer_graph_session(runtime)
    result = await invoke_explorer(run_reasoning(payload, session=session), context="reasoning")
    if payload.apply_to_graph and getattr(result, "mutated", False):
        save_graph(request, kb_id)
        summary = result.model_dump() if hasattr(result, "model_dump") else dict(result)
        audit_kb_graph(
            store,
            user,
            kb_id,
            "kb.graph.reasoning_apply",
            extra={
                "added_edges": summary.get("added_edges"),
                "rules_fired": summary.get("rules_fired"),
            },
        )
    return result


@router.post("/{kb_id}/import")
async def kb_import_graph(
    kb_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> Any:
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
    get_kb_for_viewer(request, user, kb_id, store)
    runtime = get_explorer_registry(request).get(request, kb_id)
    session = require_explorer_graph_session(runtime)
    from semantica.explorer.routes.export_import import export_graph
    from semantica.explorer.schemas import ExportRequest

    raw = await request.json()
    payload = ExportRequest.model_validate(raw)
    response = await invoke_explorer(export_graph(payload, session=session), context="export")
    audit_kb_graph(
        store,
        user,
        kb_id,
        "kb.graph.export",
        extra={"format": payload.format},
    )
    return response
