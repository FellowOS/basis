"""Workspace integration operations (shared by MCP and OpenAPI handlers)."""

from __future__ import annotations

import asyncio
from typing import Any, Callable

from fastapi import HTTPException

from basis.application.context import WorkspaceCoreContext
from basis.application.errors import CoreError
from basis.domain.graph.reads.read import find_path, list_neighbors, search_nodes
from basis.application.governance_hooks import record_governance_decision_from_context
from basis.domain.knowledge.services.remember_service import propose_remember
from basis.domain.knowledge.services.review_resolve import (
    approve_statement_remember_review,
    reject_review_item as reject_review_item_domain,
    reject_statement_remember_review,
)
from basis.domain.knowledge.services.review_resolve_approve import (
    approve_review_item as approve_review_item_domain,
)
from basis.application.review_deps import review_approve_deps
from basis.domain.errors import AdminError

OperationHandler = Callable[[WorkspaceCoreContext, dict[str, Any]], dict[str, Any]]


def _chunk_search_limit_max(ctx: WorkspaceCoreContext, args: dict[str, Any]) -> int:
    if args.get("limit_max") is not None:
        return max(1, int(args["limit_max"]))
    if ctx.runtime_limits is not None:
        return ctx.runtime_limits.chunk_search_max_limit
    return 30


def _graph_search_max_limit(ctx: WorkspaceCoreContext, args: dict[str, Any], limit: int) -> int:
    if args.get("max_limit") is not None:
        return max(limit, int(args["max_limit"]))
    if ctx.runtime_limits is not None:
        return max(limit, ctx.runtime_limits.graph_node_search_max_limit)
    return limit


def _require_workspace_editor(ctx: WorkspaceCoreContext) -> None:
    try:
        if ctx.assert_workspace_editor is not None:
            ctx.assert_workspace_editor()
        else:
            ctx.store.get_workspace_for(ctx.user, ctx.workspace.id, "editor")
    except AdminError as exc:
        raise CoreError(
            {"code": exc.code, "message": exc.message},
            status_code=exc.status,
        ) from exc
    except HTTPException as exc:
        detail = exc.detail if isinstance(exc.detail, dict) else {"message": str(exc.detail)}
        raise CoreError(detail, status_code=exc.status_code) from exc


def op_describe_workspace(ctx: WorkspaceCoreContext, _args: dict[str, Any]) -> dict[str, Any]:
    stats = ctx.knowledge.workspace_mcp_stats(ctx.workspace.id)
    return {
        "workspace_id": ctx.workspace.id,
        "name": ctx.workspace.name,
        "description": ctx.workspace.description,
        **stats,
    }


def op_search_chunks(ctx: WorkspaceCoreContext, args: dict[str, Any]) -> dict[str, Any]:
    query = str(args.get("query", "")).strip()
    if not query:
        return {"error": "query is required"}
    limit_max = _chunk_search_limit_max(ctx, args)
    limit = min(max(1, int(args.get("limit", 10))), limit_max)
    document_id = str(args.get("document_id") or "").strip() or None
    entity_id = str(args.get("entity_id") or "").strip() or None
    as_of = str(args.get("as_of") or "").strip() or None
    created_after = str(args.get("created_after") or "").strip() or None
    created_before = str(args.get("created_before") or "").strip() or None
    mode = args.get("mode")
    if as_of and not created_before:
        created_before = as_of
    if ctx.chunk_search is not None:
        return ctx.chunk_search.search(
            ctx.workspace.id,
            query=query,
            limit=limit,
            document_id=document_id,
            entity_id=entity_id,
            created_after=created_after,
            created_before=created_before,
            as_of=as_of,
            mode=mode,
        )
    hits = ctx.knowledge.search_chunks(ctx.workspace.id, query=query, limit=limit)
    return {"query": query, "mode": "keyword", "chunks": hits}


def op_get_chunk(ctx: WorkspaceCoreContext, args: dict[str, Any]) -> dict[str, Any]:
    chunk_id = str(args.get("chunk_id", "")).strip()
    if not chunk_id:
        return {"error": "chunk_id is required"}
    row = ctx.knowledge.get_chunk(ctx.workspace.id, chunk_id)
    if row is None:
        return {"error": "chunk not found"}
    return {"chunk": row}


def op_graph_search(ctx: WorkspaceCoreContext, args: dict[str, Any]) -> dict[str, Any]:
    query = str(args.get("query", "")).strip()
    if not query:
        return {"error": "query is required"}
    limit = int(args.get("limit", 20))
    max_limit = _graph_search_max_limit(ctx, args, limit)
    at = str(args.get("at") or "").strip() or None
    runtime = ctx.graph_runtime()
    results = search_nodes(
        runtime,
        query=query,
        limit=limit,
        max_limit=max_limit,
        at=at,
    )
    engine = "explorer" if runtime.adapter is not None else "snapshot"
    payload: dict[str, Any] = {"results": results, "engine": engine}
    if at:
        payload["at"] = at
        payload["temporal_filter"] = True
    return payload


def op_find_entities(ctx: WorkspaceCoreContext, args: dict[str, Any]) -> dict[str, Any]:
    query = str(args.get("query", "")).strip()
    if not query:
        return {"error": "query is required"}
    limit = int(args.get("limit", 20))
    entities = ctx.knowledge.find_entities(ctx.workspace.id, query=query, limit=limit)
    graph_hits = search_nodes(ctx.graph_runtime(), query=query, limit=limit)
    return {
        "query": query,
        "ledger_entities": entities,
        "graph_nodes": graph_hits,
    }


def op_neighbors(ctx: WorkspaceCoreContext, args: dict[str, Any]) -> dict[str, Any]:
    node_id = str(args.get("node_id", "")).strip()
    if not node_id:
        return {"error": "node_id is required"}
    depth = int(args.get("depth", 1))
    neighbors = list_neighbors(ctx.graph_runtime(), node_id, depth=depth)
    return {
        "node_id": node_id,
        "depth": min(max(1, depth), 5),
        "neighbors": neighbors,
    }


def op_paths(ctx: WorkspaceCoreContext, args: dict[str, Any]) -> dict[str, Any]:
    source = str(args.get("source", "")).strip()
    target = str(args.get("target", "")).strip()
    if not source or not target:
        return {"error": "source and target are required"}
    algorithm = str(args.get("algorithm", "bfs"))
    directed = bool(args.get("directed", True))
    if algorithm not in {"bfs", "dijkstra"}:
        algorithm = "bfs"
    return find_path(
        ctx.graph_runtime(),
        source=source,
        target=target,
        algorithm=algorithm,
        directed=directed,
    )


def op_propose_remember(ctx: WorkspaceCoreContext, args: dict[str, Any]) -> dict[str, Any]:
    content = str(args.get("content", "")).strip()
    if not content:
        return {"error": "content is required"}
    _require_workspace_editor(ctx)
    source = str(args.get("source") or "mcp")
    payload = propose_remember(
        ctx.knowledge,
        ctx.workspace.id,
        ctx.user.id,
        content,
        source=source,
    )
    return {
        **payload,
        "message": "Fact submitted for review; it is not searchable until approved.",
    }


def op_entity_facts(ctx: WorkspaceCoreContext, args: dict[str, Any]) -> dict[str, Any]:
    entity_id = str(args.get("entity_id", "")).strip()
    if not entity_id:
        return {"error": "entity_id is required"}
    limit = int(args.get("limit", 50))
    wid = ctx.workspace.id
    facts = ctx.knowledge.list_entity_facts(wid, entity_id=entity_id, limit=limit)
    derived_facts = ctx.knowledge.list_derived_facts_for_entity(wid, entity_id, limit=limit)
    return {"entity_id": entity_id, "facts": facts, "derived_facts": derived_facts}


def op_list_derived_facts(ctx: WorkspaceCoreContext, args: dict[str, Any]) -> dict[str, Any]:
    entity_id = str(args.get("entity_id") or "").strip() or None
    limit = min(max(1, int(args.get("limit", 100))), 200)
    wid = ctx.workspace.id
    if entity_id:
        derived_facts = ctx.knowledge.list_derived_facts_for_entity(wid, entity_id, limit=limit)
    else:
        derived_facts = ctx.knowledge.list_derived_facts(wid, limit=limit)
    return {"entity_id": entity_id, "derived_facts": derived_facts}


def op_list_reasoning_ground_facts(ctx: WorkspaceCoreContext, args: dict[str, Any]) -> dict[str, Any]:
    from basis.domain.knowledge.reasoning_ground_facts import ground_fact_strings_from_typed_facts

    limit = min(max(1, int(args.get("limit", 200))), 500)
    facts = ground_fact_strings_from_typed_facts(ctx.knowledge, ctx.workspace.id, limit=limit)
    return {"facts": facts}


def op_list_typed_facts(ctx: WorkspaceCoreContext, args: dict[str, Any]) -> dict[str, Any]:
    limit = min(max(1, int(args.get("limit", 100))), 200)
    facts = ctx.knowledge.list_typed_facts(ctx.workspace.id, limit=limit)
    return {"facts": facts}


def op_list_rules(ctx: WorkspaceCoreContext, args: dict[str, Any]) -> dict[str, Any]:
    limit = min(max(1, int(args.get("limit", 100))), 200)
    rules = ctx.knowledge.list_reasoning_rules(ctx.workspace.id, limit=limit)
    return {"rules": rules}


def op_get_rule(ctx: WorkspaceCoreContext, args: dict[str, Any]) -> dict[str, Any]:
    rule_id = str(args.get("rule_id", "")).strip()
    if not rule_id:
        return {"error": "rule_id is required"}
    try:
        rule = ctx.knowledge.get_reasoning_rule(ctx.workspace.id, rule_id)
    except AdminError as exc:
        if exc.code == "not_found":
            return {"error": "rule not found"}
        raise
    return {"rule": rule}


def op_list_mappings(ctx: WorkspaceCoreContext, args: dict[str, Any]) -> dict[str, Any]:
    status = str(args.get("status") or "").strip() or None
    limit = min(max(1, int(args.get("limit", 100))), 200)
    mappings = ctx.knowledge.list_mappings(ctx.workspace.id, status=status, limit=limit)
    return {"mappings": mappings}


def op_get_statement(ctx: WorkspaceCoreContext, args: dict[str, Any]) -> dict[str, Any]:
    statement_id = str(args.get("statement_id", "")).strip()
    if not statement_id:
        return {"error": "statement_id is required"}
    summary = ctx.knowledge.get_statement_browse(ctx.workspace.id, statement_id=statement_id)
    if summary is None:
        return {"error": "statement not found"}
    return {"statement": summary}


def op_get_capabilities(ctx: WorkspaceCoreContext, _args: dict[str, Any]) -> dict[str, Any]:
    from basis.application.registry import TOOL_NAMES
    from basis.infra.runtime.capabilities import workspace_capabilities

    _, role = ctx.store.get_workspace_for(ctx.user, ctx.workspace.id, "viewer")
    payload: dict[str, Any] = {
        "workspace_id": ctx.workspace.id,
        "role": role,
        **workspace_capabilities(role),
        "mcp_tools": list(TOOL_NAMES),
    }
    limits = ctx.runtime_limits
    if limits is not None:
        payload.update(
            {
                "graph_page_max_nodes": limits.graph_page_max_nodes,
                "graph_page_max_edges": limits.graph_page_max_edges,
                "chunk_search_max_limit": limits.chunk_search_max_limit,
                "graph_node_search_max_limit": limits.graph_node_search_max_limit,
                "upload_max_bytes": limits.upload_max_bytes,
                "import_max_bytes": limits.import_max_bytes,
                "ingest_max_inflight": limits.ingest_max_inflight,
                "ingest_max_pending": limits.ingest_max_pending,
                "processing_job_timeout_seconds": limits.processing_job_timeout_seconds,
                "ingest_max_extract_chars": limits.ingest_max_extract_chars,
            }
        )
    return payload


def op_run_reasoning(ctx: WorkspaceCoreContext, args: dict[str, Any]) -> dict[str, Any]:
    from basis.domain.graph.reasoning.forward import proof_chains_for_run
    from basis.domain.graph.reasoning.run import run_reasoning
    from basis.domain.graph.session.guard import require_graph_session
    from basis.domain.knowledge.services.derived_facts_service import persist_reasoning_derived
    from basis.domain.knowledge.services.graph_audit import audit_graph

    from basis.domain.knowledge.reasoning_ground_facts import ground_fact_strings_from_typed_facts

    facts = args.get("facts")
    rules = args.get("rules")
    if not isinstance(rules, list) or not rules:
        return {"error": "rules is required (non-empty array of rule strings)"}
    rules_s = [str(r) for r in rules]
    facts_limit = min(max(1, int(args.get("facts_limit", 200))), 500)
    facts_source = "request"
    if facts is None or (isinstance(facts, list) and len(facts) == 0):
        facts_s = ground_fact_strings_from_typed_facts(
            ctx.knowledge,
            ctx.workspace.id,
            limit=facts_limit,
        )
        facts_source = "typed_facts"
    elif isinstance(facts, list):
        facts_s = [str(f) for f in facts]
    else:
        return {"error": "facts must be an array of strings when provided"}
    if not facts_s:
        return {
            "error": "no ground facts: pass facts[] or materialize typed_facts in the workspace",
        }
    apply_to_graph = bool(args.get("apply_to_graph", False))
    mode = str(args.get("mode") or "forward")
    inferred_edge_type = args.get("inferred_edge_type")

    if apply_to_graph:
        _require_workspace_editor(ctx)
    else:
        ctx.store.get_workspace_for(ctx.user, ctx.workspace.id, "viewer")

    runtime = ctx.graph_runtime()
    session = require_graph_session(runtime)
    summary = run_reasoning(
        session,
        facts=facts_s,
        rules=rules_s,
        mode=mode,
        apply_to_graph=apply_to_graph,
        inferred_edge_type=inferred_edge_type,
    )
    summary["proof_chains"] = proof_chains_for_run(
        facts_s,
        rules_s,
        list(summary.get("inferred_facts") or []),
    )
    summary["facts_source"] = facts_source
    summary["ground_facts"] = facts_s
    if apply_to_graph and summary.get("mutated"):
        summary["derived_facts_persisted"] = persist_reasoning_derived(
            ctx.knowledge,
            ctx.workspace.id,
            list(summary.get("proof_chains") or []),
        )
        created = int(summary["derived_facts_persisted"].get("created") or 0)
        if created > 0:
            if ctx.rebuild_projection is None:
                return {"error": "graph projection rebuild is unavailable"}
            summary["projection"] = ctx.rebuild_projection()
        elif ctx.persist_graph is not None:
            ctx.persist_graph(ctx.workspace.id)
        audit_graph(
            ctx.store,
            ctx.user,
            ctx.workspace.id,
            "workspace.graph.reasoning_apply",
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


def op_list_review_items(ctx: WorkspaceCoreContext, args: dict[str, Any]) -> dict[str, Any]:
    status = str(args.get("status") or "open").strip() or None
    kind = str(args.get("kind") or "").strip() or None
    limit = min(max(1, int(args.get("limit", 50))), 200)
    items = ctx.knowledge.list_review_items(
        ctx.workspace.id,
        status=status,
        kind=kind,
        limit=limit,
    )
    return {"items": items}


def op_get_review_item(ctx: WorkspaceCoreContext, args: dict[str, Any]) -> dict[str, Any]:
    item_id = str(args.get("item_id", "")).strip()
    if not item_id:
        return {"error": "item_id is required"}
    try:
        item = ctx.knowledge.get_review_item(ctx.workspace.id, item_id)
    except AdminError as exc:
        if exc.code == "not_found":
            return {"error": "review item not found"}
        raise
    return {"item": item}


def op_list_processing_jobs(ctx: WorkspaceCoreContext, args: dict[str, Any]) -> dict[str, Any]:
    status = str(args.get("status") or "").strip() or None
    if status and status not in {"queued", "running", "succeeded", "failed", "cancelled"}:
        return {"error": "invalid status"}
    limit = min(max(1, int(args.get("limit", 100))), 200)
    jobs = ctx.knowledge.list_processing_jobs(ctx.workspace.id, status=status, limit=limit)
    return {"jobs": jobs}


def op_approve_statement_remember_review(
    ctx: WorkspaceCoreContext,
    args: dict[str, Any],
) -> dict[str, Any]:
    item_id = str(args.get("item_id", "")).strip()
    if not item_id:
        return {"error": "item_id is required"}
    _require_workspace_editor(ctx)
    rationale = str(args.get("rationale") or "").strip() or None
    rebuild = ctx.rebuild_projection
    decision_id = record_governance_decision_from_context(
        ctx,
        message="Review approve: statement_remember",
        detail={"item_id": item_id, "source": "mcp"},
    )
    audit_extra = {"decision_id": decision_id} if decision_id else None
    result = approve_statement_remember_review(
        knowledge=ctx.knowledge,
        store=ctx.store,
        user=ctx.user,
        workspace_id=ctx.workspace.id,
        item_id=item_id,
        rationale=rationale,
        rebuild_projection=rebuild,
        audit_extra=audit_extra,
    )
    return {**result, "decision_id": decision_id}


def op_reject_statement_remember_review(
    ctx: WorkspaceCoreContext,
    args: dict[str, Any],
) -> dict[str, Any]:
    item_id = str(args.get("item_id", "")).strip()
    if not item_id:
        return {"error": "item_id is required"}
    _require_workspace_editor(ctx)
    rationale = str(args.get("rationale") or "").strip() or None
    return reject_statement_remember_review(
        knowledge=ctx.knowledge,
        store=ctx.store,
        user=ctx.user,
        workspace_id=ctx.workspace.id,
        item_id=item_id,
        rationale=rationale,
    )


def op_approve_review_item(ctx: WorkspaceCoreContext, args: dict[str, Any]) -> dict[str, Any]:
    item_id = str(args.get("item_id", "")).strip()
    if not item_id:
        return {"error": "item_id is required"}
    _require_workspace_editor(ctx)
    rationale = str(args.get("rationale") or "").strip() or None
    keeper = str(args.get("keeper_statement_id") or "").strip() or None
    primary_id = str(args.get("primary_id") or "").strip() or None
    try:
        deps = review_approve_deps(ctx)
        return asyncio.run(
            approve_review_item_domain(
                knowledge=ctx.knowledge,
                store=ctx.store,
                user=ctx.user,
                workspace_id=ctx.workspace.id,
                item_id=item_id,
                rationale=rationale,
                keeper_statement_id=keeper,
                primary_id_override=primary_id,
                deps=deps,
            )
        )
    except HTTPException as exc:
        detail = exc.detail if isinstance(exc.detail, dict) else {"message": str(exc.detail)}
        raise CoreError(detail, status_code=exc.status_code) from exc


def op_reject_review_item(ctx: WorkspaceCoreContext, args: dict[str, Any]) -> dict[str, Any]:
    item_id = str(args.get("item_id", "")).strip()
    if not item_id:
        return {"error": "item_id is required"}
    _require_workspace_editor(ctx)
    rationale = str(args.get("rationale") or "").strip() or None
    return reject_review_item_domain(
        knowledge=ctx.knowledge,
        store=ctx.store,
        user=ctx.user,
        workspace_id=ctx.workspace.id,
        item_id=item_id,
        rationale=rationale,
        blob_store=ctx.blob_store,
        projection_bindings=ctx.projection_bindings,
    )
