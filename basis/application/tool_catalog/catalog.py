"""Static tool name → handler registry."""

from __future__ import annotations

from basis.application.connectors import catalog as connector_catalog
from basis.application.connectors import connections as connector_connections
from basis.application.connectors import mappings as connector_mappings
from basis.application.connectors import primitives as connector_primitives
from basis.application.connectors import tools as connector_tools
from basis.application.connectors import writeback as connector_writeback
from basis.application.graph import operations as graph_ops
from basis.application.knowledge import operations as knowledge_ops
from basis.application.reasoning import operations as reasoning_ops
from basis.application.review import operations as review_ops
from basis.application.tool_catalog.types import OperationSpec
from basis.application.workspace import operations as workspace_ops

OPERATIONS: dict[str, OperationSpec] = {
    "describe_workspace": {"handler": workspace_ops.op_describe_workspace},
    "get_capabilities": {"handler": workspace_ops.op_get_capabilities},
    "list_processing_jobs": {"handler": workspace_ops.op_list_processing_jobs},
    "search_chunks": {"handler": knowledge_ops.op_search_chunks},
    "get_chunk": {"handler": knowledge_ops.op_get_chunk},
    "entity_facts": {"handler": knowledge_ops.op_entity_facts},
    "list_derived_facts": {"handler": knowledge_ops.op_list_derived_facts},
    "list_typed_facts": {"handler": knowledge_ops.op_list_typed_facts},
    "list_mappings": {"handler": knowledge_ops.op_list_mappings},
    "get_statement": {"handler": knowledge_ops.op_get_statement},
    "propose_remember": {"handler": knowledge_ops.op_propose_remember},
    "find_entities": {"handler": graph_ops.op_find_entities},
    "neighbors": {"handler": graph_ops.op_neighbors},
    "paths": {"handler": graph_ops.op_paths},
    "graph_search": {"handler": graph_ops.op_graph_search},
    "list_reasoning_ground_facts": {"handler": reasoning_ops.op_list_reasoning_ground_facts},
    "list_rules": {"handler": reasoning_ops.op_list_rules},
    "get_rule": {"handler": reasoning_ops.op_get_rule},
    "run_reasoning": {"handler": reasoning_ops.op_run_reasoning},
    "list_review_items": {"handler": review_ops.op_list_review_items},
    "get_review_item": {"handler": review_ops.op_get_review_item},
    "approve_statement_remember_review": {
        "handler": review_ops.op_approve_statement_remember_review
    },
    "reject_statement_remember_review": {
        "handler": review_ops.op_reject_statement_remember_review
    },
    "approve_review_item": {"handler": review_ops.op_approve_review_item},
    "reject_review_item": {"handler": review_ops.op_reject_review_item},
    "list_connector_catalog": {"handler": connector_catalog.list_catalog},
    "describe_connector_service": {"handler": connector_catalog.describe_service},
    "list_connector_connections": {"handler": connector_connections.list_connections},
    "list_connector_table_mappings": {"handler": connector_mappings.list_table_mappings},
    "sync_connector_table_mapping": {"handler": connector_mappings.sync_table_mapping},
    "invoke_connector_primitive": {"handler": connector_primitives.invoke},
    "execute_connector_tool": {"handler": connector_tools.execute_tool},
    "propose_entity_writeback": {"handler": connector_writeback.propose_entity_writeback},
}


def mcp_exposed(tool_name: str) -> bool:
    """Whether the tool appears on MCP tools/list (default true)."""
    return OPERATIONS[tool_name].get("mcp", True)
