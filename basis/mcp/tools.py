"""MCP tool schemas and KB-scoped handlers (F-CHAT-03)."""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, Callable

from fastapi import HTTPException

from basis.admin.store import AdminStore, KnowledgeBase, User
from basis.explorer.graph_read import find_path, list_neighbors, search_nodes
from basis.explorer.registry import KbExplorerRuntime
from basis.knowledge.chunk_search import ChunkSearchService
from basis.knowledge.remember_service import propose_remember
from basis.knowledge.store import KnowledgeStore

TOOL_NAMES = (
    "describe_kb",
    "search_chunks",
    "get_chunk",
    "find_entities",
    "neighbors",
    "paths",
    "entity_facts",
    "propose_remember",
)

SERVER_INFO = {"name": "basis-kb-mcp", "version": "0.1.0"}
CAPABILITIES = {"tools": {"listChanged": False}}
PROTOCOL_VERSION = "2024-11-05"


@dataclass(frozen=True)
class KbToolContext:
    kb: KnowledgeBase
    user: User
    knowledge: KnowledgeStore
    store: AdminStore
    chunk_search: ChunkSearchService | None = None
    runtime: KbExplorerRuntime | None = None
    runtime_loader: Callable[[], KbExplorerRuntime] | None = None
    assert_kb_editor: Callable[[], None] | None = None

    def graph_runtime(self) -> KbExplorerRuntime:
        if self.runtime is not None:
            return self.runtime
        if self.runtime_loader is None:
            raise RuntimeError("graph runtime is unavailable")
        return self.runtime_loader()


def _text_result(payload: Any) -> dict[str, Any]:
    return {
        "content": [{"type": "text", "text": json.dumps(payload, ensure_ascii=False, indent=2)}],
        "isError": False,
    }


def _tool_describe_kb(ctx: KbToolContext, _args: dict[str, Any]) -> dict[str, Any]:
    stats = ctx.knowledge.kb_mcp_stats(ctx.kb.id)
    return _text_result(
        {
            "kb_id": ctx.kb.id,
            "name": ctx.kb.name,
            "description": ctx.kb.description,
            **stats,
        }
    )


def _tool_search_chunks(ctx: KbToolContext, args: dict[str, Any]) -> dict[str, Any]:
    query = str(args.get("query", "")).strip()
    if not query:
        return _text_result({"error": "query is required"})
    limit = min(max(1, int(args.get("limit", 10))), 30)
    document_id = str(args.get("document_id") or "").strip() or None
    entity_id = str(args.get("entity_id") or "").strip() or None
    as_of = str(args.get("as_of") or "").strip() or None
    created_after = str(args.get("created_after") or "").strip() or None
    created_before = str(args.get("created_before") or "").strip() or None
    if as_of and not created_before:
        created_before = as_of
    if ctx.chunk_search is not None:
        payload = ctx.chunk_search.search(
            ctx.kb.id,
            query=query,
            limit=limit,
            document_id=document_id,
            entity_id=entity_id,
            created_after=created_after,
            created_before=created_before,
            as_of=as_of,
        )
        return _text_result(payload)
    hits = ctx.knowledge.search_chunks(ctx.kb.id, query=query, limit=limit)
    return _text_result({"query": query, "mode": "keyword", "chunks": hits})


def _tool_get_chunk(ctx: KbToolContext, args: dict[str, Any]) -> dict[str, Any]:
    chunk_id = str(args.get("chunk_id", "")).strip()
    if not chunk_id:
        return _text_result({"error": "chunk_id is required"})
    row = ctx.knowledge.get_chunk(ctx.kb.id, chunk_id)
    if row is None:
        return _text_result({"error": "chunk not found"})
    return _text_result({"chunk": row})


def _tool_find_entities(ctx: KbToolContext, args: dict[str, Any]) -> dict[str, Any]:
    query = str(args.get("query", "")).strip()
    if not query:
        return _text_result({"error": "query is required"})
    limit = int(args.get("limit", 20))
    entities = ctx.knowledge.find_entities(ctx.kb.id, query=query, limit=limit)
    graph_hits = search_nodes(ctx.graph_runtime(), query=query, limit=limit)
    return _text_result(
        {
            "query": query,
            "ledger_entities": entities,
            "graph_nodes": graph_hits,
        }
    )


def _tool_neighbors(ctx: KbToolContext, args: dict[str, Any]) -> dict[str, Any]:
    node_id = str(args.get("node_id", "")).strip()
    if not node_id:
        return _text_result({"error": "node_id is required"})
    depth = int(args.get("depth", 1))
    neighbors = list_neighbors(ctx.graph_runtime(), node_id, depth=depth)
    return _text_result(
        {
            "node_id": node_id,
            "depth": min(max(1, depth), 5),
            "neighbors": neighbors,
        }
    )


def _tool_paths(ctx: KbToolContext, args: dict[str, Any]) -> dict[str, Any]:
    source = str(args.get("source", "")).strip()
    target = str(args.get("target", "")).strip()
    if not source or not target:
        return _text_result({"error": "source and target are required"})
    algorithm = str(args.get("algorithm", "bfs"))
    directed = bool(args.get("directed", True))
    if algorithm not in {"bfs", "dijkstra"}:
        algorithm = "bfs"
    path = find_path(
        ctx.graph_runtime(),
        source=source,
        target=target,
        algorithm=algorithm,
        directed=directed,
    )
    return _text_result(path)


def _tool_propose_remember(ctx: KbToolContext, args: dict[str, Any]) -> dict[str, Any]:
    content = str(args.get("content", "")).strip()
    if not content:
        return _text_result({"error": "content is required"})
    try:
        if ctx.assert_kb_editor is not None:
            ctx.assert_kb_editor()
        else:
            ctx.store.get_kb_for(ctx.user, ctx.kb.id, "editor")
    except HTTPException as exc:
        detail = exc.detail if isinstance(exc.detail, dict) else {"message": str(exc.detail)}
        return {
            "content": [{"type": "text", "text": json.dumps(detail, ensure_ascii=False)}],
            "isError": True,
        }
    payload = propose_remember(
        ctx.knowledge,
        ctx.kb.id,
        ctx.user.id,
        content,
        source="mcp",
    )
    return _text_result(
        {
            **payload,
            "message": "Fact submitted for review; it is not searchable until approved.",
        }
    )


def _tool_entity_facts(ctx: KbToolContext, args: dict[str, Any]) -> dict[str, Any]:
    entity_id = str(args.get("entity_id", "")).strip()
    if not entity_id:
        return _text_result({"error": "entity_id is required"})
    limit = int(args.get("limit", 50))
    facts = ctx.knowledge.list_entity_facts(ctx.kb.id, entity_id=entity_id, limit=limit)
    return _text_result({"entity_id": entity_id, "facts": facts})


_HANDLERS: dict[str, Callable[[KbToolContext, dict[str, Any]], dict[str, Any]]] = {
    "describe_kb": _tool_describe_kb,
    "search_chunks": _tool_search_chunks,
    "get_chunk": _tool_get_chunk,
    "find_entities": _tool_find_entities,
    "neighbors": _tool_neighbors,
    "paths": _tool_paths,
    "entity_facts": _tool_entity_facts,
    "propose_remember": _tool_propose_remember,
}


TOOL_DEFINITIONS: list[dict[str, Any]] = [
    {
        "name": "describe_kb",
        "description": "Summary of this knowledge base (name, document/chunk/entity counts).",
        "inputSchema": {"type": "object", "properties": {}},
    },
    {
        "name": "search_chunks",
        "description": "Search document chunks using this KB's configured retrieval policy (RAG citations).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search text"},
                "limit": {"type": "integer", "description": "Max chunks (default 10, max 30)"},
                "document_id": {"type": "string", "description": "Limit to one document id"},
                "entity_id": {"type": "string", "description": "Limit to chunks linked to entity id"},
                "as_of": {
                    "type": "string",
                    "description": "ISO ingest-time upper bound (alias for created_before)",
                },
                "created_after": {"type": "string", "description": "ISO document ingest lower bound"},
                "created_before": {"type": "string", "description": "ISO document ingest upper bound"},
            },
            "required": ["query"],
        },
    },
    {
        "name": "get_chunk",
        "description": "Fetch one chunk by id (from search_chunks results).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "chunk_id": {"type": "string"},
            },
            "required": ["chunk_id"],
        },
    },
    {
        "name": "find_entities",
        "description": "Find ledger entities and graph nodes by name or keyword.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "query": {"type": "string"},
                "limit": {"type": "integer"},
            },
            "required": ["query"],
        },
    },
    {
        "name": "neighbors",
        "description": "Graph neighbors around a node id (1–5 hops).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node_id": {"type": "string"},
                "depth": {"type": "integer"},
            },
            "required": ["node_id"],
        },
    },
    {
        "name": "paths",
        "description": "Shortest path between two graph node ids.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "source": {"type": "string"},
                "target": {"type": "string"},
                "algorithm": {"type": "string", "enum": ["bfs", "dijkstra"]},
                "directed": {"type": "boolean"},
            },
            "required": ["source", "target"],
        },
    },
    {
        "name": "entity_facts",
        "description": "Statements/facts about a ledger entity id.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "entity_id": {"type": "string"},
                "limit": {"type": "integer"},
            },
            "required": ["entity_id"],
        },
    },
    {
        "name": "propose_remember",
        "description": (
            "Propose a new canonical fact for human review (pending statement). "
            "Does not write to the graph until approved in the review queue."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "content": {
                    "type": "string",
                    "description": "Natural-language fact or note to remember",
                },
            },
            "required": ["content"],
        },
    },
]


def call_tool(ctx: KbToolContext, name: str, arguments: dict[str, Any]) -> dict[str, Any]:
    handler = _HANDLERS.get(name)
    if handler is None:
        return {
            "content": [{"type": "text", "text": json.dumps({"error": f"unknown tool: {name}"})}],
            "isError": True,
        }
    return handler(ctx, arguments or {})
