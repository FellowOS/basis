"""Static MCP / core operation catalog (handlers in ``operations`` / ``operations_connectors``)."""

from __future__ import annotations

from typing import Any, NotRequired, TypedDict

import basis.application.operations as ops
import basis.application.operations_connectors as conn_ops

OperationHandler = ops.OperationHandler


class OperationSpec(TypedDict):
    description: str
    input_schema: dict[str, Any]
    handler: OperationHandler
    mcp: NotRequired[bool]


OPERATIONS: dict[str, OperationSpec] = {
    "describe_workspace": {
        "description": "Summary of this workspace (name, document/chunk/entity counts).",
        "input_schema": {"type": "object", "properties": {}},
        "handler": ops.op_describe_workspace,
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
        "handler": ops.op_entity_facts,
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
        "handler": ops.op_list_derived_facts,
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
        "handler": ops.op_list_typed_facts,
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
        "handler": ops.op_list_reasoning_ground_facts,
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
        "handler": ops.op_list_rules,
    },
    "get_rule": {
        "description": "Fetch one reasoning rule by id (from list_rules).",
        "input_schema": {
            "type": "object",
            "properties": {"rule_id": {"type": "string"}},
            "required": ["rule_id"],
        },
        "handler": ops.op_get_rule,
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
        "handler": ops.op_list_mappings,
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
        "handler": ops.op_get_statement,
    },
    "get_capabilities": {
        "description": (
            "Workspace feature flags for this caller's role plus static MCP tool names "
            "available on this deployment."
        ),
        "input_schema": {"type": "object", "properties": {}},
        "handler": ops.op_get_capabilities,
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
        "handler": ops.op_run_reasoning,
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
                "max_limit": {
                    "type": "integer",
                    "description": "Server cap (defaults to graph_node_search_max_limit from get_capabilities)",
                },
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
        "handler": ops.op_approve_review_item,
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
        "handler": ops.op_reject_review_item,
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
        "handler": conn_ops.op_list_connector_catalog,
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
        "handler": conn_ops.op_describe_connector_service,
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
        "handler": conn_ops.op_invoke_connector_primitive,
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
