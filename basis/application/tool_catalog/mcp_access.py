"""Classify static MCP tools as read vs write for API token grants UI."""

from __future__ import annotations

from basis.application.tool_catalog.connector_mcp_tool_name import parse_connector_mcp_tool_name

# Write = requires workspace editor (mutations, approvals, connector vault writes, sync).
MCP_TOOL_ACCESS: dict[str, str] = {
    "describe_workspace": "read",
    "get_capabilities": "read",
    "list_processing_jobs": "read",
    "search_chunks": "read",
    "get_chunk": "read",
    "entity_facts": "read",
    "list_derived_facts": "read",
    "list_typed_facts": "read",
    "list_mappings": "read",
    "get_statement": "read",
    "find_entities": "read",
    "neighbors": "read",
    "paths": "read",
    "graph_search": "read",
    "list_reasoning_ground_facts": "read",
    "list_rules": "read",
    "get_rule": "read",
    "list_review_items": "read",
    "get_review_item": "read",
    "list_connector_catalog": "read",
    "describe_connector_service": "read",
    "list_connector_connections": "read",
    "check_connector_connection": "read",
    "discover_connector_schema": "read",
    "list_connector_table_mappings": "read",
    "propose_remember": "write",
    "run_reasoning": "write",
    "approve_statement_remember_review": "write",
    "reject_statement_remember_review": "write",
    "approve_review_item": "write",
    "reject_review_item": "write",
    "upsert_connector_connection": "write",
    "delete_connector_connection": "write",
    "sync_connector_table_mapping": "write",
    "invoke_connector_primitive": "write",
    "execute_connector_tool": "write",
    "propose_entity_writeback": "write",
}


def mcp_tool_access(tool_name: str) -> str:
    """Return ``read`` or ``write`` for MCP / HTTP grant classification."""
    if tool_name in MCP_TOOL_ACCESS:
        return MCP_TOOL_ACCESS[tool_name]
    binding = parse_connector_mcp_tool_name(tool_name)
    if binding is not None:
        primitive = binding.get("primitive", "")
        if primitive in {"discover", "list"}:
            return "read"
        return "write"
    return "write"
