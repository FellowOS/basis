"""MCP-facing connector operations — delegates to ``application.connectors`` use cases."""

from __future__ import annotations

from typing import Any

from basis.application.connectors import catalog as connector_catalog
from basis.application.connectors import connections as connector_connections
from basis.application.connectors import mappings as connector_mappings
from basis.application.connectors import primitives as connector_primitives
from basis.application.connectors import tools as connector_tools
from basis.application.connectors import writeback as connector_writeback
from basis.application.context import WorkspaceCoreContext


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
