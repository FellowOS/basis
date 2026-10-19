"""KB-prefixed adapters for semantica Explorer routes used by GraphWorkspace."""

from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import Response

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
from basis.transport.http.explorer_route_errors import invoke_explorer
from basis.domain.explorer.session_guard import require_explorer_graph_session
from basis.infra.limits import RuntimeLimits
from basis.domain.kb.graph_audit import audit_kb_graph
from basis.domain.kb.store import KnowledgeStore
from basis.transport.http.routes.v1.kb_review import (
    CreateEntityMergeReviewRequest,
    propose_entity_merge,
)

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
    runtime = get_explorer_registry(request).get(request, kb_id)
    session = require_explorer_graph_session(runtime)
    from semantica.explorer.routes.temporal import temporal_bounds

    payload = await invoke_explorer(temporal_bounds(session=session), context="temporal")
    if isinstance(payload, dict):
        ledger = get_knowledge_store(request).get_ledger_temporal_bounds(kb_id)
        merged = dict(payload)
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
    from semantica.explorer.routes.temporal import temporal_snapshot
    from basis.domain.explorer.graph_diff import parse_query_dt

    payload = await invoke_explorer(temporal_snapshot(at=at, session=session), context="temporal")
    if at:
        try:
            instant = parse_query_dt(at)
            state = session.graph.state_at(instant)
        except ValueError:
            state = None
        if isinstance(state, dict) and (state.get("nodes") or []):
            base = payload if isinstance(payload, dict) else {}
            payload = {
                **base,
                "nodes": state.get("nodes") or [],
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
    from semantica.explorer.routes.temporal import temporal_diff

    return await invoke_explorer(
        temporal_diff(from_time=from_time, to_time=to_time, session=session),
        context="temporal",
    )


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
    `valid_from` (F-TIM-01). Console graph preview dims unchanged elements and highlights
    added/modified nodes and added edges at the end instant.
    """
    get_kb_for_viewer(request, user, kb_id, store)
    runtime = get_explorer_registry(request).get(request, kb_id)
    session = require_explorer_graph_session(runtime)
    from basis.domain.explorer.graph_diff import diff_session_at

    return diff_session_at(session, from_time, to_time)


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
    from basis.domain.explorer.graph_staging import graph_staging_at

    return graph_staging_at(session, kb_id, from_time, to_time)


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
    """
Kb Enrich Dedup. Graph enrichment and governance proposals. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
    """
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
    from semantica.explorer.routes.provenance import get_provenance_lineage

    return await invoke_explorer(
        get_provenance_lineage(node_id=node_id, session=session),
        context="provenance",
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
    """
Kb Provenance Report. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
    """
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
    """
Kb Sparql Execute. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
    """
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
    """
Kb Graph Semantic Neighborhood. Projected graph read API (Explorer runtime). Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
    """
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
    from semantica.explorer.routes.graph import distance_matrix
    from semantica.explorer.schemas import DistanceMatrixRequest

    raw = await request.json()
    payload = DistanceMatrixRequest.model_validate(raw)
    return await invoke_explorer(distance_matrix(payload, session=session), context="distance_matrix")


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
    """
Kb Decision Chain. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
    """
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
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> Any:
    """
Kb Reasoning Run. KB-local reasoning rules and runs. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
    """
    from semantica.explorer.routes.enrich import run_reasoning
    from semantica.explorer.schemas import ReasoningRequest

    raw = await request.json()
    payload = ReasoningRequest.model_validate(raw)
    role = "editor" if payload.apply_to_graph else "viewer"
    store.get_kb_for(user, kb_id, role)
    runtime = get_explorer_registry(request).get(request, kb_id)
    session = require_explorer_graph_session(runtime)
    result = await invoke_explorer(run_reasoning(payload, session=session), context="reasoning")
    summary = result.model_dump() if hasattr(result, "model_dump") else dict(result)
    from basis.domain.explorer.forward_reasoning import proof_chains_for_run

    summary["proof_chains"] = proof_chains_for_run(
        list(payload.facts),
        list(payload.rules),
        list(summary.get("inferred_facts") or []),
    )
    if payload.apply_to_graph and summary.get("mutated"):
        from basis.domain.kb.derived_facts_service import persist_reasoning_derived

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
