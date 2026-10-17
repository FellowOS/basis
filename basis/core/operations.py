"""KB integration operations (shared by MCP and OpenAPI handlers)."""

from __future__ import annotations

from typing import Any, Callable

from fastapi import HTTPException

from basis.core.context import KbCoreContext
from basis.core.errors import CoreError
from basis.explorer.graph_read import find_path, list_neighbors, search_nodes
from basis.knowledge.remember_service import propose_remember

OperationHandler = Callable[[KbCoreContext, dict[str, Any]], dict[str, Any]]


def op_describe_kb(ctx: KbCoreContext, _args: dict[str, Any]) -> dict[str, Any]:
    stats = ctx.knowledge.kb_mcp_stats(ctx.kb.id)
    return {
        "kb_id": ctx.kb.id,
        "name": ctx.kb.name,
        "description": ctx.kb.description,
        **stats,
    }


def op_search_chunks(ctx: KbCoreContext, args: dict[str, Any]) -> dict[str, Any]:
    query = str(args.get("query", "")).strip()
    if not query:
        return {"error": "query is required"}
    limit_max = max(1, int(args.get("limit_max", 30)))
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
            ctx.kb.id,
            query=query,
            limit=limit,
            document_id=document_id,
            entity_id=entity_id,
            created_after=created_after,
            created_before=created_before,
            as_of=as_of,
            mode=mode,
        )
    hits = ctx.knowledge.search_chunks(ctx.kb.id, query=query, limit=limit)
    return {"query": query, "mode": "keyword", "chunks": hits}


def op_get_chunk(ctx: KbCoreContext, args: dict[str, Any]) -> dict[str, Any]:
    chunk_id = str(args.get("chunk_id", "")).strip()
    if not chunk_id:
        return {"error": "chunk_id is required"}
    row = ctx.knowledge.get_chunk(ctx.kb.id, chunk_id)
    if row is None:
        return {"error": "chunk not found"}
    return {"chunk": row}


def op_graph_search(ctx: KbCoreContext, args: dict[str, Any]) -> dict[str, Any]:
    query = str(args.get("query", "")).strip()
    if not query:
        return {"error": "query is required"}
    limit = int(args.get("limit", 20))
    max_limit = max(limit, int(args.get("max_limit", limit)))
    at = str(args.get("at") or "").strip() or None
    runtime = ctx.graph_runtime()
    results = search_nodes(
        runtime,
        query=query,
        limit=limit,
        max_limit=max_limit,
        at=at,
    )
    engine = "explorer" if runtime.explorer is not None else "snapshot"
    payload: dict[str, Any] = {"results": results, "engine": engine}
    if at:
        payload["at"] = at
        payload["temporal_filter"] = True
    return payload


def op_find_entities(ctx: KbCoreContext, args: dict[str, Any]) -> dict[str, Any]:
    query = str(args.get("query", "")).strip()
    if not query:
        return {"error": "query is required"}
    limit = int(args.get("limit", 20))
    entities = ctx.knowledge.find_entities(ctx.kb.id, query=query, limit=limit)
    graph_hits = search_nodes(ctx.graph_runtime(), query=query, limit=limit)
    return {
        "query": query,
        "ledger_entities": entities,
        "graph_nodes": graph_hits,
    }


def op_neighbors(ctx: KbCoreContext, args: dict[str, Any]) -> dict[str, Any]:
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


def op_paths(ctx: KbCoreContext, args: dict[str, Any]) -> dict[str, Any]:
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


def op_propose_remember(ctx: KbCoreContext, args: dict[str, Any]) -> dict[str, Any]:
    content = str(args.get("content", "")).strip()
    if not content:
        return {"error": "content is required"}
    try:
        if ctx.assert_kb_editor is not None:
            ctx.assert_kb_editor()
        else:
            ctx.store.get_kb_for(ctx.user, ctx.kb.id, "editor")
    except HTTPException as exc:
        detail = exc.detail if isinstance(exc.detail, dict) else {"message": str(exc.detail)}
        raise CoreError(detail, status_code=exc.status_code) from exc
    source = str(args.get("source") or "mcp")
    payload = propose_remember(
        ctx.knowledge,
        ctx.kb.id,
        ctx.user.id,
        content,
        source=source,
    )
    return {
        **payload,
        "message": "Fact submitted for review; it is not searchable until approved.",
    }


def op_entity_facts(ctx: KbCoreContext, args: dict[str, Any]) -> dict[str, Any]:
    entity_id = str(args.get("entity_id", "")).strip()
    if not entity_id:
        return {"error": "entity_id is required"}
    limit = int(args.get("limit", 50))
    facts = ctx.knowledge.list_entity_facts(ctx.kb.id, entity_id=entity_id, limit=limit)
    return {"entity_id": entity_id, "facts": facts}
