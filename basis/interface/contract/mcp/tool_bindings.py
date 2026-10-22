"""MCP static tool name → workspace HTTP route (stamped into OpenAPI as x-basis-mcp-tool)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Mapping


@dataclass(frozen=True)
class McpToolBinding:
    name: str
    method: str
    path: str
    param_aliases: Mapping[str, str] | None = None


_WS = "/api/v1/workspaces/{workspace_id}"

MCP_TOOL_BINDINGS: tuple[McpToolBinding, ...] = (
    McpToolBinding("describe_workspace", "get", _WS),
    McpToolBinding("search_chunks", "get", f"{_WS}/search", param_aliases={"q": "query"}),
    McpToolBinding("get_chunk", "get", f"{_WS}/ledger/chunks/{{chunk_id}}"),
    McpToolBinding("find_entities", "get", f"{_WS}/entities/find", param_aliases={"q": "query"}),
    McpToolBinding("neighbors", "get", f"{_WS}/graph/nodes/{{node_id}}/neighbors"),
    McpToolBinding("paths", "get", f"{_WS}/graph/path"),
    McpToolBinding("entity_facts", "get", f"{_WS}/ledger/entities/{{entity_id}}/facts"),
    McpToolBinding("list_derived_facts", "get", f"{_WS}/ledger/derived-facts"),
    McpToolBinding("list_typed_facts", "get", f"{_WS}/ledger/typed-facts"),
    McpToolBinding("list_rules", "get", f"{_WS}/rules"),
    McpToolBinding("get_rule", "get", f"{_WS}/rules/{{rule_id}}"),
    McpToolBinding("list_mappings", "get", f"{_WS}/mappings"),
    McpToolBinding("get_statement", "get", f"{_WS}/ledger/statements/{{statement_id}}"),
    McpToolBinding("get_capabilities", "get", f"{_WS}/capabilities"),
    McpToolBinding("list_reasoning_ground_facts", "get", f"{_WS}/reasoning/ground-facts"),
    McpToolBinding("run_reasoning", "post", f"{_WS}/reasoning/run"),
    McpToolBinding("list_processing_jobs", "get", f"{_WS}/processing/jobs"),
    McpToolBinding("propose_remember", "post", f"{_WS}/remember/proposals"),
    McpToolBinding("graph_search", "post", f"{_WS}/graph/search"),
    McpToolBinding("list_review_items", "get", f"{_WS}/review/items"),
    McpToolBinding("get_review_item", "get", f"{_WS}/review/items/{{item_id}}"),
    McpToolBinding(
        "approve_statement_remember_review",
        "post",
        f"{_WS}/review/items/{{item_id}}/approve",
    ),
    McpToolBinding(
        "reject_statement_remember_review",
        "post",
        f"{_WS}/review/items/{{item_id}}/reject",
    ),
    McpToolBinding("approve_review_item", "post", f"{_WS}/review/items/{{item_id}}/approve"),
    McpToolBinding("reject_review_item", "post", f"{_WS}/review/items/{{item_id}}/reject"),
    McpToolBinding("list_connector_catalog", "get", f"{_WS}/connectors/catalog"),
    McpToolBinding("describe_connector_service", "get", f"{_WS}/connectors/catalog/{{service}}"),
    McpToolBinding("list_connector_connections", "get", f"{_WS}/connectors/connections"),
    McpToolBinding("list_connector_table_mappings", "get", f"{_WS}/connectors/table-mappings"),
    McpToolBinding(
        "sync_connector_table_mapping",
        "post",
        f"{_WS}/connectors/table-mappings/{{mapping_id}}/sync",
    ),
    McpToolBinding(
        "invoke_connector_primitive",
        "post",
        f"{_WS}/connectors/connections/{{service}}/{{connection_name}}/invoke-primitive",
    ),
    McpToolBinding("propose_entity_writeback", "post", f"{_WS}/connectors/outbox/propose"),
    McpToolBinding("execute_connector_tool", "post", f"{_WS}/connectors/tools/execute"),
)
