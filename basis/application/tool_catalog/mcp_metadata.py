"""MCP tools/list descriptions (inputSchema from Pydantic via tool_catalog.mcp_list)."""

from __future__ import annotations

from typing import Any

MCP_TOOL_METADATA: dict[str, dict[str, Any]] = {
    "describe_workspace": {"description": "Summary of this workspace (name, document/chunk/entity counts)."},
    "get_capabilities": {"description": "Workspace feature flags for this caller's role plus static MCP tool names available on this deployment."},
    "list_processing_jobs": {"description": "List document processing jobs (extract, chunk, project)."},
    "search_chunks": {"description": "Search document chunks using this workspace's configured retrieval policy (RAG citations)."},
    "get_chunk": {"description": "Fetch one chunk by id (from search_chunks results)."},
    "entity_facts": {"description": "Open statements and inference-derived facts for a ledger entity id (derived_facts include proof-chain premises)."},
    "list_derived_facts": {"description": "List reasoning-derived facts in the ledger (optionally scoped to one entity). Use after rules/inference to read conclusions not present in source documents."},
    "list_typed_facts": {"description": "List ontology-typed facts materialized from confirmed mappings (predicate URIs such as commercialContact, not raw document text)."},
    "list_mappings": {"description": "List statement-to-ontology mapping proposals (signature, target_uri, status)."},
    "get_statement": {"description": "Resolve a ledger statement id to subject/object, predicate, and evidence (for tracing premises behind derived facts)."},
    "propose_remember": {"description": "Propose a new canonical fact for human review (pending statement). Does not write to the graph until approved in the review queue."},
    "find_entities": {"description": "Find ledger entities and graph nodes by name or keyword."},
    "neighbors": {"description": "Graph neighbors around a node id (1–5 hops)."},
    "paths": {"description": "Shortest path between two graph node ids."},
    "graph_search": {"description": "Search graph nodes by keyword (Explorer or snapshot projection)."},
    "list_reasoning_ground_facts": {"description": "Derive forward-chaining fact strings from ontology typed_facts (use as the facts array for run_reasoning)."},
    "list_rules": {"description": "List forward-chaining reasoning rules in the workspace rule library (name, body, enabled)."},
    "get_rule": {"description": "Fetch one reasoning rule by id (from list_rules)."},
    "run_reasoning": {"description": "Run forward-chaining reasoning. Omit facts to use ontology typed_facts (same as list_reasoning_ground_facts). Set apply_to_graph true (editor) to persist derived facts; false for dry-run inferred_facts and proof_chains."},
    "list_review_items": {"description": "List human review queue items (merges, imports, remember proposals, conflicts)."},
    "get_review_item": {"description": "Fetch one review queue item by id."},
    "approve_statement_remember_review": {"description": "Approve an open statement_remember review item (confirms pending fact from propose_remember)."},
    "reject_statement_remember_review": {"description": "Reject an open statement_remember review item."},
    "approve_review_item": {"description": "Approve any open review queue item (merges, imports, remember, conflicts, writeback, …). Same semantics as HTTP POST .../review/items/{item_id}/approve."},
    "reject_review_item": {"description": "Reject any open review queue item. Same semantics as HTTP POST .../review/items/{item_id}/reject."},
    "list_connector_catalog": {
        "description": (
            "List BOCP connector services allowed for this workspace (summary rows; same filters as "
            "HTTP GET …/connectors/catalog for query/limit/has_streams_only — HTTP may return full manifests)."
        )
    },
    "describe_connector_service": {"description": "Describe one BOCP connector manifest (entities and procedures summary)."},
    "list_connector_connections": {"description": "List saved BOCP connections for this workspace (no credential secrets)."},
    "list_connector_table_mappings": {"description": "List stream-to-ontology table mappings configured for connector sync."},
    "sync_connector_table_mapping": {"description": "Run inbound BOCP sync for one table mapping (pull external rows into the Evidence Ledger)."},
    "invoke_connector_primitive": {"description": "Invoke a BOCP Section 10 primitive for an entity or procedure action (discover, list, mutate, invoke) using manifest operations — no table mapping required."},
    "execute_connector_tool": {"description": "Execute a standalone BOCP ToolSpec RPC for an allowed provider (subject to workspace action_policy_json)."},
    "propose_entity_writeback": {"description": "Propose an outbound writeback of ledger entity attributes to its external BOCP connector stream (creates an entity_sync_outbox record and a human review gate when writeback_mode is 'review')."},
}
