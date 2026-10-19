"""Operation registry (MCP tools/list schemas and dispatch)."""

from __future__ import annotations

from functools import lru_cache
from typing import Any, NotRequired, TypedDict

from pydantic import ValidationError

from basis.integration.context import KbCoreContext
from basis.integration.errors import CoreError
from basis.platform.admin.errors import AdminError
from basis.integration.mcp_format import mcp_text_result
from basis.integration.models import (
    coerce_operation_args,
    validate_operation_response,
    validation_error_payload,
)
from . import operations as ops
from . import ops_connectors as conn_ops

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
    },
    "list_review_items": {
        "description": "List human review queue items (merges, imports, remember proposals, conflicts).",
        "input_schema": {
            "type": "object",
            "properties": {
                "status": {
                    "type": "string",
                    "description": "Filter by status (default open)",
                },
                "kind": {"type": "string", "description": "Filter by review kind"},
                "limit": {"type": "integer", "description": "Max items (default 50, max 200)"},
            },
        },
        "handler": ops.op_list_review_items,
    },
    "get_review_item": {
        "description": "Fetch one review queue item by id.",
        "input_schema": {
            "type": "object",
            "properties": {"item_id": {"type": "string"}},
            "required": ["item_id"],
        },
        "handler": ops.op_get_review_item,
    },
    "list_processing_jobs": {
        "description": "List document processing jobs (extract, chunk, project).",
        "input_schema": {
            "type": "object",
            "properties": {
                "status": {
                    "type": "string",
                    "enum": ["queued", "running", "succeeded", "failed", "cancelled"],
                },
                "limit": {"type": "integer", "description": "Max jobs (default 100, max 200)"},
            },
        },
        "handler": ops.op_list_processing_jobs,
        "mcp": False,
    },
    "approve_statement_remember_review": {
        "description": (
            "Approve an open statement_remember review item (confirms pending fact from propose_remember)."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "item_id": {"type": "string"},
                "rationale": {"type": "string", "description": "Optional reviewer note"},
            },
            "required": ["item_id"],
        },
        "handler": ops.op_approve_statement_remember_review,
    },
    "reject_statement_remember_review": {
        "description": "Reject an open statement_remember review item.",
        "input_schema": {
            "type": "object",
            "properties": {
                "item_id": {"type": "string"},
                "rationale": {"type": "string", "description": "Optional reviewer note"},
            },
            "required": ["item_id"],
        },
        "handler": ops.op_reject_statement_remember_review,
    },
    "list_connector_catalog": {
        "description": "List BOCP connector services allowed for this KB (catalog summary).",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Filter by service key or display name"},
                "limit": {"type": "integer", "description": "Max rows (default 25, max 100)"},
                "has_streams_only": {
                    "type": "boolean",
                    "description": "Only providers with structured inbound streams",
                },
            },
        },
        "handler": conn_ops.op_list_connector_catalog,
    },
    "describe_connector_service": {
        "description": "Describe one BOCP connector manifest (streams and tools summary).",
        "input_schema": {
            "type": "object",
            "properties": {
                "service": {"type": "string", "description": "Connector service key (e.g. postgres, github)"},
            },
            "required": ["service"],
        },
        "handler": conn_ops.op_describe_connector_service,
    },
    "list_connector_connections": {
        "description": "List saved BOCP connections for this KB (no credential secrets).",
        "input_schema": {
            "type": "object",
            "properties": {
                "service": {"type": "string", "description": "Optional filter by connector service key"},
            },
        },
        "handler": conn_ops.op_list_connector_connections,
    },
    "list_connector_table_mappings": {
        "description": "List stream-to-ontology table mappings configured for connector sync.",
        "input_schema": {
            "type": "object",
            "properties": {
                "limit": {"type": "integer", "description": "Max mappings (default 50, max 200)"},
            },
        },
        "handler": conn_ops.op_list_connector_table_mappings,
    },
    "sync_connector_table_mapping": {
        "description": (
            "Run inbound BOCP sync for one table mapping (pull external rows into the Evidence Ledger)."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "mapping_id": {"type": "string", "description": "source_table_mappings id"},
            },
            "required": ["mapping_id"],
        },
        "handler": conn_ops.op_sync_connector_table_mapping,
    },
    "execute_connector_tool": {
        "description": (
            "Execute a standalone BOCP ToolSpec RPC for an allowed provider (subject to KB action_policy_json)."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "service": {"type": "string", "description": "Connector service key"},
                "tool_id": {"type": "string", "description": "Tool id from manifest tools[]"},
                "connection_name": {
                    "type": "string",
                    "description": "Saved connection name (default: default)",
                },
                "arguments": {
                    "type": "object",
                    "description": "Tool input payload per manifest input_schema",
                },
            },
            "required": ["service", "tool_id"],
        },
        "handler": conn_ops.op_execute_connector_tool,
    },
    "propose_entity_writeback": {
        "description": (
            "Propose an outbound writeback of ledger entity attributes to its external BOCP connector stream "
            "(creates an entity_sync_outbox record and a human review gate when writeback_mode is 'review')."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "entity_id": {"type": "string", "description": "Ledger entity id linked to an external connector row"},
                "field_updates": {
                    "type": "object",
                    "description": "Map of writable external column names to new values",
                },
            },
            "required": ["entity_id", "field_updates"],
        },
        "handler": conn_ops.op_propose_entity_writeback,
    },
}


def _mcp_exposed(name: str) -> bool:
    return OPERATIONS[name].get("mcp", True)


TOOL_NAMES: tuple[str, ...] = tuple(name for name in OPERATIONS if _mcp_exposed(name))

def _mcp_input_schema(name: str, fallback: dict[str, Any]) -> dict[str, Any]:
    from basis.integration.mcp_openapi import input_schema_for_tool

    derived = input_schema_for_tool(name)
    return derived if derived else fallback


@lru_cache(maxsize=1)
def get_tool_definitions() -> list[dict[str, Any]]:
    return [
        {
            "name": name,
            "description": spec["description"],
            "inputSchema": _mcp_input_schema(name, spec["input_schema"]),
        }
        for name, spec in OPERATIONS.items()
        if _mcp_exposed(name)
    ]


def __getattr__(name: str) -> Any:
    if name == "TOOL_DEFINITIONS":
        return get_tool_definitions()
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


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
    except AdminError as exc:
        return mcp_text_result({"code": exc.code, "message": exc.message}, is_error=True)
    return mcp_text_result(payload)
