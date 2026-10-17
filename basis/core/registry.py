"""Operation registry (MCP tools/list schemas and dispatch)."""

from __future__ import annotations

from typing import Any, NotRequired, TypedDict

from pydantic import ValidationError

from basis.core.context import KbCoreContext
from basis.core.errors import CoreError
from basis.core.mcp_format import mcp_text_result
from basis.core.models import (
    coerce_operation_args,
    validate_operation_response,
    validation_error_payload,
)
from basis.core import operations as ops

OperationHandler = ops.OperationHandler


class _OperationSpec(TypedDict):
    description: str
    input_schema: dict[str, Any]
    handler: OperationHandler
    mcp: NotRequired[bool]


OPERATIONS: dict[str, _OperationSpec] = {
    "describe_kb": {
        "description": "Summary of this knowledge base (name, document/chunk/entity counts).",
        "input_schema": {"type": "object", "properties": {}},
        "handler": ops.op_describe_kb,
    },
    "search_chunks": {
        "description": "Search document chunks using this KB's configured retrieval policy (RAG citations).",
        "input_schema": {
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
        "handler": ops.op_search_chunks,
    },
    "get_chunk": {
        "description": "Fetch one chunk by id (from search_chunks results).",
        "input_schema": {
            "type": "object",
            "properties": {"chunk_id": {"type": "string"}},
            "required": ["chunk_id"],
        },
        "handler": ops.op_get_chunk,
    },
    "find_entities": {
        "description": "Find ledger entities and graph nodes by name or keyword.",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string"},
                "limit": {"type": "integer"},
            },
            "required": ["query"],
        },
        "handler": ops.op_find_entities,
    },
    "neighbors": {
        "description": "Graph neighbors around a node id (1–5 hops).",
        "input_schema": {
            "type": "object",
            "properties": {
                "node_id": {"type": "string"},
                "depth": {"type": "integer"},
            },
            "required": ["node_id"],
        },
        "handler": ops.op_neighbors,
    },
    "paths": {
        "description": "Shortest path between two graph node ids.",
        "input_schema": {
            "type": "object",
            "properties": {
                "source": {"type": "string"},
                "target": {"type": "string"},
                "algorithm": {"type": "string", "enum": ["bfs", "dijkstra"]},
                "directed": {"type": "boolean"},
            },
            "required": ["source", "target"],
        },
        "handler": ops.op_paths,
    },
    "entity_facts": {
        "description": "Statements/facts about a ledger entity id.",
        "input_schema": {
            "type": "object",
            "properties": {
                "entity_id": {"type": "string"},
                "limit": {"type": "integer"},
            },
            "required": ["entity_id"],
        },
        "handler": ops.op_entity_facts,
    },
    "propose_remember": {
        "description": (
            "Propose a new canonical fact for human review (pending statement). "
            "Does not write to the graph until approved in the review queue."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "content": {
                    "type": "string",
                    "description": "Natural-language fact or note to remember",
                },
            },
            "required": ["content"],
        },
        "handler": ops.op_propose_remember,
    },
    "graph_search": {
        "description": "Search graph nodes by keyword (Explorer or snapshot projection).",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string"},
                "limit": {"type": "integer"},
                "at": {"type": "string", "description": "Optional ISO instant for temporal filter"},
            },
            "required": ["query"],
        },
        "handler": ops.op_graph_search,
        "mcp": False,
    },
}


def _mcp_exposed(name: str) -> bool:
    return OPERATIONS[name].get("mcp", True)


TOOL_NAMES: tuple[str, ...] = tuple(name for name in OPERATIONS if _mcp_exposed(name))

def _mcp_input_schema(name: str, fallback: dict[str, Any]) -> dict[str, Any]:
    from basis.core.mcp_openapi import input_schema_for_tool

    if name == "describe_kb":
        return fallback
    derived = input_schema_for_tool(name)
    return derived if derived else fallback


TOOL_DEFINITIONS: list[dict[str, Any]] = [
    {
        "name": name,
        "description": spec["description"],
        "inputSchema": _mcp_input_schema(name, spec["input_schema"]),
    }
    for name, spec in OPERATIONS.items()
    if _mcp_exposed(name)
]

_MCP_TOOL_NAMES = frozenset(TOOL_NAMES)

_HANDLERS: dict[str, OperationHandler] = {
    name: spec["handler"] for name, spec in OPERATIONS.items()
}


def run(ctx: KbCoreContext, name: str, arguments: dict[str, Any] | None) -> dict[str, Any]:
    """Run a registered operation; returns a plain JSON-serializable dict."""
    handler = _HANDLERS.get(name)
    if handler is None:
        return {"error": f"unknown tool: {name}"}
    try:
        args = coerce_operation_args(name, arguments)
    except ValidationError as exc:
        return validation_error_payload(exc)
    result = handler(ctx, args)
    if isinstance(result, dict) and "error" not in result:
        return validate_operation_response(name, result)
    return result


def execute(ctx: KbCoreContext, name: str, arguments: dict[str, Any] | None) -> dict[str, Any]:
    """MCP tools/call envelope."""
    if name not in _MCP_TOOL_NAMES:
        return mcp_text_result({"error": f"unknown tool: {name}"}, is_error=True)
    try:
        payload = run(ctx, name, arguments)
    except CoreError as exc:
        return mcp_text_result(exc.detail, is_error=True)
    return mcp_text_result(payload)
