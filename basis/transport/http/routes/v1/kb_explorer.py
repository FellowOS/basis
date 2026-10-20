"""KB-prefixed adapters for semantica Explorer routes used by GraphWorkspace."""

from __future__ import annotations

import asyncio
from typing import Any, Optional

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import PlainTextResponse, Response
from pydantic import BaseModel, Field

from basis.platform.admin.errors import AdminError
from basis.platform.admin.store import AdminStore, User
from basis.transport.http.deps import (
    get_current_user,
    get_explorer_registry,
    get_kb_for_editor,
    get_kb_for_viewer,
    get_knowledge_store,
    get_runtime_limits,
    get_store,
    rebuild_kb_projection,
    save_graph,
)
from basis.domain.explorer.session_guard import require_explorer_graph_session
from basis.infra.limits import RuntimeLimits
from basis.domain.kb.services.graph_audit import audit_kb_graph
from basis.domain.kb.store import KnowledgeStore
from basis.transport.http.routes.v1.kb_review import (
    CreateEntityMergeReviewRequest,
    propose_entity_merge,
)
from basis.domain.explorer.sparql_read import (
    SPARQL_TIMEOUT_S,
    _SPARQL_MAX_CONCURRENT,
    build_sparql_graph,
    run_sparql_on_graph,
    sparql_error_response,
    sparql_query_preflight,
    sparql_timeout_response,
)

router = APIRouter(tags=["knowledge-bases"])

_sparql_semaphore = asyncio.Semaphore(_SPARQL_MAX_CONCURRENT)
_link_prediction_semaphore = asyncio.Semaphore(2)


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
    runtime = get_explorer_registry(request).get(request, kb_id)
    session = require_explorer_graph_session(runtime)
    from basis.domain.explorer.temporal_read import get_temporal_bounds

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
    runtime = get_explorer_registry(request).get(request, kb_id)
    session = require_explorer_graph_session(runtime)
    from basis.domain.explorer.graph_diff import parse_query_dt
    from basis.domain.explorer.temporal_read import get_temporal_snapshot
    from basis.domain.graph.projector import build_temporal_graph_from_ledger

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
    runtime = get_explorer_registry(request).get(request, kb_id)
    session = require_explorer_graph_session(runtime)
    from basis.domain.explorer.graph_diff import diff_session_at
    from basis.domain.graph.projector import build_temporal_graph_from_ledger

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


@router.get("/{kb_id}/graph/diff")
async def kb_graph_diff(
    kb_id: str,
    request: Request,
    from_time: str = Query(..., alias="from"),
    to_time: str = Query(..., alias="to"),
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> Any:
    """Whole-graph diff between two instants (F-DIFF-01).

    Compares Explorer projection snapshots at `from` and `to` (ISO instants). Response includes
    `added_nodes`, `removed_nodes`, `modified_nodes`, `added_edges`, `removed_edges`, `summary`,
    and echo `from_time` / `to_time`. Node/edge membership follows ledger `recorded_at` → projected
    `valid_from` and `invalidated_at` → projected `valid_until` (F-TIM-01). Console graph preview dims unchanged elements and highlights
    added/modified nodes and added edges at the end instant.
    """
    get_kb_for_viewer(request, user, kb_id, store)
    runtime = get_explorer_registry(request).get(request, kb_id)
    session = require_explorer_graph_session(runtime)
    from basis.domain.explorer.graph_diff import diff_session_at
    from basis.domain.graph.projector import build_temporal_graph_from_ledger

    temporal_session = build_temporal_graph_from_ledger(
        get_knowledge_store(request), kb_id, preserve_from=session
    )
    return diff_session_at(temporal_session, from_time, to_time)


@router.get("/{kb_id}/graph/staging")
async def kb_graph_staging(
    kb_id: str,
    request: Request,
    from_time: str = Query(..., alias="from"),
    to_time: str = Query(..., alias="to"),
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> Any:
    """Diff + staging manifest for publish/review workflows (F-DIFF-01).

    Returns `{manifest, diff}` where `manifest` includes `session_key` (stable id for the
    from/to range), `focus_node_ids`, governance relpaths (`review`, `graph/staging/entity-merge`,
    graph import), and `change_total`. The nested `diff` matches `GET .../graph/diff` for the
    same instants.
    """
    get_kb_for_viewer(request, user, kb_id, store)
    runtime = get_explorer_registry(request).get(request, kb_id)
    session = require_explorer_graph_session(runtime)
    from basis.domain.graph.projector import build_temporal_graph_from_ledger

    knowledge = get_knowledge_store(request)
    temporal_session = build_temporal_graph_from_ledger(
        knowledge, kb_id, preserve_from=session
    )
    return knowledge.graph_staging_at(
        temporal_session,
        kb_id,
        from_time,
        to_time,
        updated_by=user.id,
    )


class PutGraphStagingDraftRequest(BaseModel):
    from_time: str = Field(default="")
    to_time: str = Field(default="")
    primary: str = Field(default="")
    duplicate: str = Field(default="")


@router.put("/{kb_id}/graph/staging/{session_key}/draft")
async def kb_put_graph_staging_draft(
    kb_id: str,
    session_key: str,
    body: PutGraphStagingDraftRequest,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    """Persist server-side staging studio merge draft for a compare session (F-DIFF-01)."""
    get_kb_for_editor(request, user, kb_id, store)
    return knowledge.upsert_graph_staging_session(
        kb_id,
        session_key=session_key,
        from_time=body.from_time,
        to_time=body.to_time,
        draft={"primary": body.primary, "duplicate": body.duplicate},
        updated_by=user.id,
    )


@router.post("/{kb_id}/graph/staging/entity-merge")
async def kb_graph_staging_entity_merge(
    kb_id: str,
    request: Request,
    body: CreateEntityMergeReviewRequest,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> Any:
    """Propose entity merge from diff/staging studio (Gate D; F-DIFF-01).

    JSON body: `{primary_id, duplicate_ids[]}`. Creates a review-queue item (`entity_merge`);
    identical semantics to `POST .../review/items/entity-merge`.
    """
    return await propose_entity_merge(kb_id, request, body, user, store, knowledge)


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
    runtime = get_explorer_registry(request).get(request, kb_id)
    session = require_explorer_graph_session(runtime)
    from basis.domain.explorer.enrich_read import predict_links

    raw = await request.json()
    if not isinstance(raw, dict):
        raise AdminError(422, "validation_error", "请求体须为 JSON 对象")
    node_id = str(raw.get("node_id") or "")
    if not node_id:
        raise AdminError(422, "validation_error", "node_id 必填")
    top_n = int(raw.get("top_n", 10))
    min_score = float(raw.get("min_score", 0.0))
    candidate_type = raw.get("candidate_type")
    async with _link_prediction_semaphore:
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
    runtime = get_explorer_registry(request).get(request, kb_id)
    session = require_explorer_graph_session(runtime)
    from basis.domain.explorer.enrich_read import detect_duplicates

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
    runtime = get_explorer_registry(request).get(request, kb_id)
    session = require_explorer_graph_session(runtime)
    from basis.domain.explorer.provenance_read import get_provenance_lineage

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
    runtime = get_explorer_registry(request).get(request, kb_id)
    session = require_explorer_graph_session(runtime)
    from basis.domain.explorer.provenance_read import export_provenance_report

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
    runtime = get_explorer_registry(request).get(request, kb_id)
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

    async with _sparql_semaphore:
        try:
            return await asyncio.wait_for(
                asyncio.to_thread(run_sparql_on_graph, graph, query),
                timeout=SPARQL_TIMEOUT_S,
            )
        except asyncio.TimeoutError:
            return sparql_timeout_response()


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
    runtime = get_explorer_registry(request).get(request, kb_id)
    session = require_explorer_graph_session(runtime)
    from basis.domain.explorer.graph_semantic_read import semantic_neighborhood

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
    runtime = get_explorer_registry(request).get(request, kb_id)
    session = require_explorer_graph_session(runtime)
    from basis.domain.explorer.graph_semantic_read import distance_matrix

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
    runtime = get_explorer_registry(request).get(request, kb_id)
    session = require_explorer_graph_session(runtime)
    from basis.domain.explorer.decisions_read import list_decisions

    capped = min(max(1, limit), limits.explorer_decisions_max_limit)
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
    runtime = get_explorer_registry(request).get(request, kb_id)
    session = require_explorer_graph_session(runtime)
    from basis.domain.explorer.decisions_read import get_causal_chain

    return await asyncio.to_thread(get_causal_chain, session, decision_id)


@router.post("/{kb_id}/reasoning/run")
async def kb_reasoning_run(
    kb_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> Any:
    """
Kb Reasoning Run. KB-local reasoning rules and runs. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
    """
    from basis.domain.explorer.forward_reasoning import proof_chains_for_run
    from basis.domain.explorer.reasoning_run import run_reasoning

    raw = await request.json()
    if not isinstance(raw, dict):
        raise AdminError(422, "validation_error", "请求体须为 JSON 对象")
    facts = raw.get("facts")
    rules = raw.get("rules")
    if not isinstance(facts, list) or not isinstance(rules, list):
        raise AdminError(422, "validation_error", "facts 与 rules 须为字符串数组")
    apply_to_graph = bool(raw.get("apply_to_graph", False))
    role = "editor" if apply_to_graph else "viewer"
    store.get_kb_for(user, kb_id, role)
    runtime = get_explorer_registry(request).get(request, kb_id)
    session = require_explorer_graph_session(runtime)
    summary = await asyncio.to_thread(
        run_reasoning,
        session,
        facts=[str(f) for f in facts],
        rules=[str(r) for r in rules],
        mode=str(raw.get("mode", "forward")),
        apply_to_graph=apply_to_graph,
        inferred_edge_type=raw.get("inferred_edge_type"),
    )
    summary["proof_chains"] = proof_chains_for_run(
        [str(f) for f in facts],
        [str(r) for r in rules],
        list(summary.get("inferred_facts") or []),
    )
    if apply_to_graph and summary.get("mutated"):
        from basis.domain.kb.services.derived_facts_service import persist_reasoning_derived

        summary["derived_facts_persisted"] = persist_reasoning_derived(
            knowledge,
            kb_id,
            list(summary.get("proof_chains") or []),
        )
        created = int(summary["derived_facts_persisted"].get("created") or 0)
        if created > 0:
            summary["projection"] = rebuild_kb_projection(request, kb_id)
        else:
            save_graph(request, kb_id)
        audit_kb_graph(
            store,
            user,
            kb_id,
            "kb.graph.reasoning_apply",
            extra={
                "added_edges": summary.get("added_edges"),
                "rules_fired": summary.get("rules_fired"),
                "derived_facts_created": created,
                **(
                    {"projection_revision": summary["projection"].get("projection_revision")}
                    if isinstance(summary.get("projection"), dict)
                    else {}
                ),
            },
        )
    return summary


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
    runtime = get_explorer_registry(request).get(request, kb_id)
    session = require_explorer_graph_session(runtime)
    from basis.domain.explorer.graph_export_read import export_graph

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
