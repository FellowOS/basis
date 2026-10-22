"""MCP tool catalog, argument models, and dispatch."""

from __future__ import annotations

from functools import lru_cache
from typing import Any, Callable, Literal, NotRequired, TypedDict

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from basis.application.graph import operations as graph_ops
from basis.application.knowledge import operations as knowledge_ops
from basis.application.reasoning import operations as reasoning_ops
from basis.application.review import operations as review_ops
from basis.application.workspace import operations as workspace_ops
from basis.application.connectors import catalog as connector_catalog
from basis.application.connectors import connections as connector_connections
from basis.application.connectors import mappings as connector_mappings
from basis.application.connectors import primitives as connector_primitives
from basis.application.connectors import tools as connector_tools
from basis.application.connectors import writeback as connector_writeback
from basis.application.kernel import CoreError, WorkspaceCoreContext
from basis.domain.errors import AdminError
from basis.interface.contract.mcp.format import mcp_text_result

OperationHandler = Callable[[WorkspaceCoreContext, dict[str, Any]], dict[str, Any]]

def op_list_connector_catalog(ctx: WorkspaceCoreContext, args: dict[str, Any]) -> dict[str, Any]:
    return connector_catalog.list_catalog(ctx, args)


def op_describe_connector_service(ctx: WorkspaceCoreContext, args: dict[str, Any]) -> dict[str, Any]:
    return connector_catalog.describe_service(ctx, args)


def op_list_connector_connections(ctx: WorkspaceCoreContext, args: dict[str, Any]) -> dict[str, Any]:
    return connector_connections.list_connections(ctx, args)


def op_list_connector_table_mappings(ctx: WorkspaceCoreContext, args: dict[str, Any]) -> dict[str, Any]:
    return connector_mappings.list_table_mappings(ctx, args)


def op_sync_connector_table_mapping(ctx: WorkspaceCoreContext, args: dict[str, Any]) -> dict[str, Any]:
    return connector_mappings.sync_table_mapping(ctx, args)


def op_invoke_connector_primitive(ctx: WorkspaceCoreContext, args: dict[str, Any]) -> dict[str, Any]:
    return connector_primitives.invoke(ctx, args)


def op_execute_connector_tool(ctx: WorkspaceCoreContext, args: dict[str, Any]) -> dict[str, Any]:
    return connector_tools.execute_tool(ctx, args)


def op_propose_entity_writeback(ctx: WorkspaceCoreContext, args: dict[str, Any]) -> dict[str, Any]:
    return connector_writeback.propose_entity_writeback(ctx, args)



class _ExtraAllowed(BaseModel):
    model_config = ConfigDict(extra="allow")


class DescribeWorkspaceInput(_ExtraAllowed):
    pass


class SearchChunksInput(_ExtraAllowed):
    query: str = Field(min_length=1)
    limit: int = Field(default=10, ge=1)
    document_id: str | None = None
    entity_id: str | None = None
    as_of: str | None = None
    created_after: str | None = None
    created_before: str | None = None
    mode: Literal["keyword", "semantic", "hybrid"] | None = None
    limit_max: int | None = Field(default=None, ge=1)


class GetChunkInput(_ExtraAllowed):
    chunk_id: str = Field(min_length=1)


class FindEntitiesInput(_ExtraAllowed):
    query: str = Field(min_length=1)
    limit: int = Field(default=20, ge=1)


class NeighborsInput(_ExtraAllowed):
    node_id: str = Field(min_length=1)
    depth: int = Field(default=1, ge=1, le=5)


class PathsInput(_ExtraAllowed):
    source: str = Field(min_length=1)
    target: str = Field(min_length=1)
    algorithm: Literal["bfs", "dijkstra"] = "bfs"
    directed: bool = True


class EntityFactsInput(_ExtraAllowed):
    entity_id: str = Field(min_length=1)
    limit: int = Field(default=50, ge=1, le=100)


class ListDerivedFactsInput(_ExtraAllowed):
    entity_id: str | None = None
    limit: int = Field(default=100, ge=1, le=200)


class ListTypedFactsInput(_ExtraAllowed):
    limit: int = Field(default=100, ge=1, le=200)


class ListReasoningGroundFactsInput(_ExtraAllowed):
    limit: int = Field(default=200, ge=1, le=500)


class ListRulesInput(_ExtraAllowed):
    limit: int = Field(default=100, ge=1, le=200)


class GetRuleInput(_ExtraAllowed):
    rule_id: str = Field(min_length=1)


class ListMappingsInput(_ExtraAllowed):
    status: str | None = None
    limit: int = Field(default=100, ge=1, le=200)


class GetStatementInput(_ExtraAllowed):
    statement_id: str = Field(min_length=1)


class GetCapabilitiesInput(_ExtraAllowed):
    pass


class RunReasoningInput(_ExtraAllowed):
    facts: list[str] | None = None
    rules: list[str] = Field(min_length=1)
    facts_limit: int = Field(default=200, ge=1, le=500)
    apply_to_graph: bool = False
    mode: str = "forward"
    inferred_edge_type: str | None = None


class ProposeRememberInput(_ExtraAllowed):
    content: str = Field(min_length=1)
    source: str | None = None


class GraphSearchInput(_ExtraAllowed):
    query: str = Field(min_length=1)
    limit: int = Field(default=20, ge=1)
    max_limit: int | None = Field(default=None, ge=1)
    at: str | None = None


class ListReviewItemsInput(_ExtraAllowed):
    status: str | None = None
    kind: str | None = None
    limit: int = Field(default=50, ge=1, le=200)


class GetReviewItemInput(_ExtraAllowed):
    item_id: str = Field(min_length=1)


class ListProcessingJobsInput(_ExtraAllowed):
    status: Literal["queued", "running", "succeeded", "failed", "cancelled"] | None = None
    limit: int = Field(default=100, ge=1, le=200)


class ResolveStatementRememberReviewInput(_ExtraAllowed):
    item_id: str = Field(min_length=1)
    rationale: str | None = None


class ResolveReviewItemInput(_ExtraAllowed):
    item_id: str = Field(min_length=1)
    rationale: str | None = None
    keeper_statement_id: str | None = None
    primary_id: str | None = None


class ProposeEntityWritebackInput(_ExtraAllowed):
    entity_id: str = Field(min_length=1)
    field_updates: dict[str, Any] = Field(min_length=1)


class DescribeWorkspaceResponse(_ExtraAllowed):
    workspace_id: str
    name: str


class SearchChunksResponse(_ExtraAllowed):
    query: str | None = None
    mode: str | None = None
    chunks: list[Any] = Field(default_factory=list)


class GetChunkResponse(_ExtraAllowed):
    chunk: dict[str, Any]


class FindEntitiesResponse(_ExtraAllowed):
    query: str
    ledger_entities: list[Any] = Field(default_factory=list)
    graph_nodes: list[Any] = Field(default_factory=list)


class NeighborsResponse(_ExtraAllowed):
    node_id: str
    depth: int
    neighbors: list[Any] = Field(default_factory=list)


class PathsResponse(_ExtraAllowed):
    pass


class EntityFactsResponse(_ExtraAllowed):
    entity_id: str
    facts: list[Any] = Field(default_factory=list)
    derived_facts: list[Any] = Field(default_factory=list)


class ListDerivedFactsResponse(_ExtraAllowed):
    entity_id: str | None = None
    derived_facts: list[Any] = Field(default_factory=list)


class ListTypedFactsResponse(_ExtraAllowed):
    facts: list[Any] = Field(default_factory=list)


class ListReasoningGroundFactsResponse(_ExtraAllowed):
    facts: list[str] = Field(default_factory=list)


class RunReasoningResponse(_ExtraAllowed):
    inferred_facts: list[str] = Field(default_factory=list)
    rules_fired: int | None = None
    added_edges: int | None = None
    mutated: bool | None = None
    proof_chains: list[Any] = Field(default_factory=list)
    facts_source: str | None = None
    ground_facts: list[str] = Field(default_factory=list)


class ListRulesResponse(_ExtraAllowed):
    rules: list[Any] = Field(default_factory=list)


class GetRuleResponse(_ExtraAllowed):
    rule: dict[str, Any]


class ListMappingsResponse(_ExtraAllowed):
    mappings: list[Any] = Field(default_factory=list)


class GetStatementResponse(_ExtraAllowed):
    statement: dict[str, Any]


class GraphSearchResponse(_ExtraAllowed):
    results: list[Any] = Field(default_factory=list)
    engine: str | None = None


class ListReviewItemsResponse(_ExtraAllowed):
    items: list[Any] = Field(default_factory=list)


class GetReviewItemResponse(_ExtraAllowed):
    item: dict[str, Any]


class ListProcessingJobsResponse(_ExtraAllowed):
    jobs: list[Any] = Field(default_factory=list)


class ResolveStatementRememberReviewResponse(_ExtraAllowed):
    item: dict[str, Any]
    decision_id: str | None = None


class ApproveReviewItemResponse(_ExtraAllowed):
    item: dict[str, Any]
    decision_id: str | None = None


OPERATION_INPUT_MODELS: dict[str, type[BaseModel]] = {
    "describe_workspace": DescribeWorkspaceInput,
    "search_chunks": SearchChunksInput,
    "get_chunk": GetChunkInput,
    "find_entities": FindEntitiesInput,
    "neighbors": NeighborsInput,
    "paths": PathsInput,
    "entity_facts": EntityFactsInput,
    "list_derived_facts": ListDerivedFactsInput,
    "list_typed_facts": ListTypedFactsInput,
    "list_reasoning_ground_facts": ListReasoningGroundFactsInput,
    "list_rules": ListRulesInput,
    "get_rule": GetRuleInput,
    "list_mappings": ListMappingsInput,
    "get_statement": GetStatementInput,
    "get_capabilities": GetCapabilitiesInput,
    "run_reasoning": RunReasoningInput,
    "list_processing_jobs": ListProcessingJobsInput,
    "propose_remember": ProposeRememberInput,
    "graph_search": GraphSearchInput,
    "list_review_items": ListReviewItemsInput,
    "get_review_item": GetReviewItemInput,
    "approve_statement_remember_review": ResolveStatementRememberReviewInput,
    "reject_statement_remember_review": ResolveStatementRememberReviewInput,
    "approve_review_item": ResolveReviewItemInput,
    "reject_review_item": ResolveStatementRememberReviewInput,
    "propose_entity_writeback": ProposeEntityWritebackInput,
}


def validation_error_payload(exc: ValidationError) -> dict[str, Any]:
    first = exc.errors()[0] if exc.errors() else {}
    loc = first.get("loc", ())
    field = str(loc[0]) if loc else "arguments"
    return {"error": f"invalid {field}: {first.get('msg', 'validation failed')}"}


def coerce_operation_args(name: str, arguments: dict[str, Any] | None) -> dict[str, Any]:
    """Validate and normalize args; raises ValidationError on failure."""
    model_cls = OPERATION_INPUT_MODELS.get(name)
    raw = arguments or {}
    if model_cls is None:
        return raw
    if name == "describe_workspace" and not raw:
        return {}
    validated = model_cls.model_validate(raw)
    return validated.model_dump(exclude_none=True)


OPERATION_RESPONSE_MODELS: dict[str, type[BaseModel]] = {
    "describe_workspace": DescribeWorkspaceResponse,
    "search_chunks": SearchChunksResponse,
    "get_chunk": GetChunkResponse,
    "find_entities": FindEntitiesResponse,
    "neighbors": NeighborsResponse,
    "paths": PathsResponse,
    "entity_facts": EntityFactsResponse,
    "list_derived_facts": ListDerivedFactsResponse,
    "list_typed_facts": ListTypedFactsResponse,
    "list_reasoning_ground_facts": ListReasoningGroundFactsResponse,
    "run_reasoning": RunReasoningResponse,
    "list_rules": ListRulesResponse,
    "get_rule": GetRuleResponse,
    "list_mappings": ListMappingsResponse,
    "get_statement": GetStatementResponse,
    "graph_search": GraphSearchResponse,
    "list_review_items": ListReviewItemsResponse,
    "get_review_item": GetReviewItemResponse,
    "list_processing_jobs": ListProcessingJobsResponse,
    "approve_statement_remember_review": ResolveStatementRememberReviewResponse,
    "reject_statement_remember_review": ResolveStatementRememberReviewResponse,
    "approve_review_item": ApproveReviewItemResponse,
    "reject_review_item": ResolveStatementRememberReviewResponse,
}


def validate_operation_response(name: str, payload: dict[str, Any]) -> dict[str, Any]:
    """Best-effort response shape check (extra fields allowed)."""
    model_cls = OPERATION_RESPONSE_MODELS.get(name)
    if model_cls is None:
        return payload
    try:
        return model_cls.model_validate(payload).model_dump()
    except ValidationError:
        return payload
class OperationSpec(TypedDict):
    description: str
    input_schema: dict[str, Any]
    handler: OperationHandler
    mcp: NotRequired[bool]


OPERATIONS: dict[str, OperationSpec] = {
    "describe_workspace": {
        "description": "Summary of this workspace (name, document/chunk/entity counts).",
        "input_schema": {"type": "object", "properties": {}},
        "handler": workspace_ops.op_describe_workspace,
    },
    "search_chunks": {
        "description": "Search document chunks using this workspace's configured retrieval policy (RAG citations).",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search text"},
                "limit": {
                    "type": "integer",
                    "description": "Max chunks (default 10; capped by chunk_search_max_limit from get_capabilities)",
                },
                "limit_max": {
                    "type": "integer",
                    "description": "Optional override of server chunk search cap (HTTP passes this automatically)",
                },
                "mode": {
                    "type": "string",
                    "enum": ["keyword", "semantic", "hybrid"],
                    "description": "Retrieval mode when workspace search supports it",
                },
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
        "handler": knowledge_ops.op_search_chunks,
    },
    "get_chunk": {
        "description": "Fetch one chunk by id (from search_chunks results).",
        "input_schema": {
            "type": "object",
            "properties": {"chunk_id": {"type": "string"}},
            "required": ["chunk_id"],
        },
        "handler": knowledge_ops.op_get_chunk,
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
        "handler": graph_ops.op_find_entities,
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
        "handler": graph_ops.op_neighbors,
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
        "handler": graph_ops.op_paths,
    },
    "entity_facts": {
        "description": (
            "Open statements and inference-derived facts for a ledger entity id "
            "(derived_facts include proof-chain premises)."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "entity_id": {"type": "string"},
                "limit": {"type": "integer"},
            },
            "required": ["entity_id"],
        },
        "handler": knowledge_ops.op_entity_facts,
    },
    "list_derived_facts": {
        "description": (
            "List reasoning-derived facts in the ledger (optionally scoped to one entity). "
            "Use after rules/inference to read conclusions not present in source documents."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "entity_id": {
                    "type": "string",
                    "description": "Optional ledger entity id (e.g. from find_entities)",
                },
                "limit": {"type": "integer", "description": "Max rows (default 100, max 200)"},
            },
        },
        "handler": knowledge_ops.op_list_derived_facts,
    },
    "list_typed_facts": {
        "description": (
            "List ontology-typed facts materialized from confirmed mappings "
            "(predicate URIs such as commercialContact, not raw document text)."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "limit": {"type": "integer", "description": "Max rows (default 100, max 200)"},
            },
        },
        "handler": knowledge_ops.op_list_typed_facts,
    },
    "list_reasoning_ground_facts": {
        "description": (
            "Derive forward-chaining fact strings from ontology typed_facts "
            "(use as the facts array for run_reasoning)."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "limit": {"type": "integer", "description": "Max typed_facts rows to scan (default 200, max 500)"},
            },
        },
        "handler": reasoning_ops.op_list_reasoning_ground_facts,
    },
    "list_rules": {
        "description": (
            "List forward-chaining reasoning rules in the workspace rule library "
            "(name, body, enabled)."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "limit": {"type": "integer", "description": "Max rows (default 100, max 200)"},
            },
        },
        "handler": reasoning_ops.op_list_rules,
    },
    "get_rule": {
        "description": "Fetch one reasoning rule by id (from list_rules).",
        "input_schema": {
            "type": "object",
            "properties": {"rule_id": {"type": "string"}},
            "required": ["rule_id"],
        },
        "handler": reasoning_ops.op_get_rule,
    },
    "list_mappings": {
        "description": (
            "List statement-to-ontology mapping proposals (signature, target_uri, status)."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "status": {
                    "type": "string",
                    "description": "Optional filter: proposed, confirmed, rejected, superseded",
                },
                "limit": {"type": "integer", "description": "Max rows (default 100, max 200)"},
            },
        },
        "handler": knowledge_ops.op_list_mappings,
    },
    "get_statement": {
        "description": (
            "Resolve a ledger statement id to subject/object, predicate, and evidence "
            "(for tracing premises behind derived facts)."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "statement_id": {"type": "string"},
            },
            "required": ["statement_id"],
        },
        "handler": knowledge_ops.op_get_statement,
    },
    "get_capabilities": {
        "description": (
            "Workspace feature flags for this caller's role plus static MCP tool names "
            "available on this deployment."
        ),
        "input_schema": {"type": "object", "properties": {}},
        "handler": workspace_ops.op_get_capabilities,
    },
    "run_reasoning": {
        "description": (
            "Run forward-chaining reasoning. Omit facts to use ontology typed_facts "
            "(same as list_reasoning_ground_facts). Set apply_to_graph true (editor) to "
            "persist derived facts; false for dry-run inferred_facts and proof_chains."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "facts": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Optional ground facts; omitted → derived from typed_facts",
                },
                "facts_limit": {
                    "type": "integer",
                    "description": "When facts omitted, max typed_facts rows to scan (default 200)",
                },
                "rules": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Rule bodies in the workspace rule language",
                },
                "apply_to_graph": {
                    "type": "boolean",
                    "description": "Persist derived facts and graph edges when true",
                },
                "mode": {"type": "string", "description": "Reasoning mode (default forward)"},
                "inferred_edge_type": {
                    "type": "string",
                    "description": "Optional graph edge label for inferred relations",
                },
            },
            "required": ["rules"],
        },
        "handler": reasoning_ops.op_run_reasoning,
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
        "handler": knowledge_ops.op_propose_remember,
    },
    "graph_search": {
        "description": "Search graph nodes by keyword (Explorer or snapshot projection).",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string"},
                "limit": {"type": "integer"},
                "max_limit": {
                    "type": "integer",
                    "description": "Server cap (defaults to graph_node_search_max_limit from get_capabilities)",
                },
                "at": {"type": "string", "description": "Optional ISO instant for temporal filter"},
            },
            "required": ["query"],
        },
        "handler": graph_ops.op_graph_search,
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
        "handler": review_ops.op_list_review_items,
    },
    "get_review_item": {
        "description": "Fetch one review queue item by id.",
        "input_schema": {
            "type": "object",
            "properties": {"item_id": {"type": "string"}},
            "required": ["item_id"],
        },
        "handler": review_ops.op_get_review_item,
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
        "handler": workspace_ops.op_list_processing_jobs,
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
        "handler": review_ops.op_approve_statement_remember_review,
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
        "handler": review_ops.op_reject_statement_remember_review,
    },
    "approve_review_item": {
        "description": (
            "Approve any open review queue item (merges, imports, remember, conflicts, writeback, …). "
            "Same semantics as HTTP POST .../review/items/{item_id}/approve."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "item_id": {"type": "string"},
                "rationale": {"type": "string", "description": "Optional reviewer note"},
                "keeper_statement_id": {
                    "type": "string",
                    "description": "For statement_conflict: statement id to keep",
                },
                "primary_id": {
                    "type": "string",
                    "description": "For entity_cluster: ledger entity id to keep as primary",
                },
            },
            "required": ["item_id"],
        },
        "handler": review_ops.op_approve_review_item,
    },
    "reject_review_item": {
        "description": (
            "Reject any open review queue item. Same semantics as HTTP POST .../review/items/{item_id}/reject."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "item_id": {"type": "string"},
                "rationale": {"type": "string", "description": "Optional reviewer note"},
            },
            "required": ["item_id"],
        },
        "handler": review_ops.op_reject_review_item,
    },
    "list_connector_catalog": {
        "description": "List BOCP connector services allowed for this workspace (catalog summary).",
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
        "handler": op_list_connector_catalog,
    },
    "describe_connector_service": {
        "description": "Describe one BOCP connector manifest (entities and procedures summary).",
        "input_schema": {
            "type": "object",
            "properties": {
                "service": {"type": "string", "description": "Connector service key (e.g. postgres, github)"},
            },
            "required": ["service"],
        },
        "handler": op_describe_connector_service,
    },
    "list_connector_connections": {
        "description": "List saved BOCP connections for this workspace (no credential secrets).",
        "input_schema": {
            "type": "object",
            "properties": {
                "service": {"type": "string", "description": "Optional filter by connector service key"},
                "connection_scope": {"type": "string", "enum": ["workspace", "end_user"]},
                "subject_id": {"type": "string"},
            },
        },
        "handler": op_list_connector_connections,
    },
    "list_connector_table_mappings": {
        "description": "List stream-to-ontology table mappings configured for connector sync.",
        "input_schema": {
            "type": "object",
            "properties": {
                "limit": {"type": "integer", "description": "Max mappings (default 50, max 200)"},
            },
        },
        "handler": op_list_connector_table_mappings,
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
        "handler": op_sync_connector_table_mapping,
    },
    "invoke_connector_primitive": {
        "description": (
            "Invoke a BOCP Section 10 primitive for an entity or procedure action "
            "(discover, list, mutate, invoke) using manifest operations — no table mapping required."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "service": {"type": "string", "description": "Connector service key (e.g. github, postgres)"},
                "action_id": {
                    "type": "string",
                    "description": "Entity or procedure action id from manifest actions[]",
                },
                "primitive": {
                    "type": "string",
                    "enum": ["discover", "list", "mutate", "invoke"],
                },
                "connection_name": {
                    "type": "string",
                    "description": "Saved connection name (default: default)",
                },
                "connection_scope": {
                    "type": "string",
                    "enum": ["workspace", "end_user"],
                },
                "subject_id": {
                    "type": "string",
                    "description": "End-user id when connection_scope is end_user",
                },
                "operation": {
                    "type": "string",
                    "description": "For mutate: create, update, upsert, or delete",
                },
                "external_table": {
                    "type": "string",
                    "description": "SQL table name when required by the action",
                },
                "external_id": {
                    "description": "External primary key for mutate (omit for create)",
                },
                "changes": {
                    "type": "object",
                    "description": "Field patch for mutate, or procedure payload when primitive is invoke",
                },
                "action_params": {
                    "type": "object",
                    "description": "Scope params (e.g. owner, repo) merged into {{config.*}} templates",
                },
                "arguments": {
                    "type": "object",
                    "description": "Alias for procedure invoke payload",
                },
                "limit": {"type": "integer", "description": "Max records for list (default 500, max 5000)"},
                "cursor_watermark": {"description": "Incremental cursor for list"},
                "primary_key_column": {"type": "string"},
                "cursor_column": {"type": "string"},
            },
            "required": ["service", "action_id", "primitive"],
        },
        "handler": op_invoke_connector_primitive,
    },
    "execute_connector_tool": {
        "description": (
            "Execute a standalone BOCP ToolSpec RPC for an allowed provider (subject to workspace action_policy_json)."
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
                "connection_scope": {
                    "type": "string",
                    "enum": ["workspace", "end_user"],
                },
                "subject_id": {"type": "string"},
                "arguments": {
                    "type": "object",
                    "description": "Tool input payload per manifest input_schema",
                },
            },
            "required": ["service", "tool_id"],
        },
        "handler": op_execute_connector_tool,
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
        "handler": op_propose_entity_writeback,
    },
}


def _mcp_exposed(name: str) -> bool:
    return OPERATIONS[name].get("mcp", True)


TOOL_NAMES: tuple[str, ...] = tuple(name for name in OPERATIONS if _mcp_exposed(name))

def _mcp_input_schema(name: str, fallback: dict[str, Any]) -> dict[str, Any]:
    from basis.interface.contract.mcp.openapi import input_schema_for_tool

    derived = input_schema_for_tool(name)
    return derived if derived else fallback


@lru_cache(maxsize=1)
def get_static_tool_definitions() -> list[dict[str, Any]]:
    return [
        {
            "name": name,
            "description": spec["description"],
            "inputSchema": _mcp_input_schema(name, spec["input_schema"]),
        }
        for name, spec in OPERATIONS.items()
        if _mcp_exposed(name)
    ]


def get_tool_definitions(ctx: WorkspaceCoreContext | None = None) -> list[dict[str, Any]]:
    """MCP tools/list payload; includes manifest-derived connector tools when ``ctx`` is set."""
    tools = list(get_static_tool_definitions())
    if ctx is not None:
        from basis.interface.contract.mcp.connector_tools import connector_tool_definitions_for_workspace

        tools.extend(connector_tool_definitions_for_workspace(ctx))
    return tools


def __getattr__(name: str) -> Any:
    if name == "TOOL_DEFINITIONS":
        return get_tool_definitions()
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


_MCP_TOOL_NAMES = frozenset(TOOL_NAMES)

_HANDLERS: dict[str, OperationHandler] = {
    name: spec["handler"] for name, spec in OPERATIONS.items()
}


def _resolve_mcp_tool_handler(name: str) -> OperationHandler | None:
    if name in _HANDLERS:
        return _HANDLERS[name]
    from basis.interface.contract.mcp.connector_tools import parse_connector_mcp_tool_name

    if parse_connector_mcp_tool_name(name) is not None:
        return op_invoke_connector_primitive
    return None


def _is_known_mcp_tool(name: str) -> bool:
    return _resolve_mcp_tool_handler(name) is not None


def run(ctx: WorkspaceCoreContext, name: str, arguments: dict[str, Any] | None) -> dict[str, Any]:
    """Run a registered operation; returns a plain JSON-serializable dict."""
    handler = _resolve_mcp_tool_handler(name)
    if handler is None:
        return {"error": f"unknown tool: {name}"}
    binding: dict[str, Any] | None = None
    if name not in _HANDLERS:
        from basis.interface.contract.mcp.connector_tools import parse_connector_mcp_tool_name

        binding = parse_connector_mcp_tool_name(name)
    try:
        args = coerce_operation_args(name, arguments)
    except ValidationError as exc:
        return validation_error_payload(exc)
    if binding:
        args = {**binding, **args}
    result = handler(ctx, args)
    if isinstance(result, dict) and "error" not in result:
        return validate_operation_response(name, result)
    return result


def execute(ctx: WorkspaceCoreContext, name: str, arguments: dict[str, Any] | None) -> dict[str, Any]:
    """MCP tools/call envelope."""
    if not _is_known_mcp_tool(name):
        return mcp_text_result({"error": f"unknown tool: {name}"}, is_error=True)
    try:
        payload = run(ctx, name, arguments)
    except CoreError as exc:
        return mcp_text_result(exc.detail, is_error=True)
    except AdminError as exc:
        return mcp_text_result({"code": exc.code, "message": exc.message}, is_error=True)
    return mcp_text_result(payload)
