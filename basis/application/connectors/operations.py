"""Connector application services (static MCP tools and shared use cases)."""

from __future__ import annotations

from typing import Any

from basis.application.connectors import catalog as catalog_uc
from basis.application.connectors import connections as connections_uc
from basis.application.connectors import mappings as mappings_uc
from basis.application.connectors import primitives as primitives_uc
from basis.application.connectors import tools as tools_uc
from basis.application.connectors import writeback as writeback_uc
from basis.application.kernel import WorkspaceCoreContext


def op_list_connector_catalog(ctx: WorkspaceCoreContext, args: dict[str, Any]) -> dict[str, Any]:
    return catalog_uc.list_catalog(ctx, args)


def op_describe_connector_service(ctx: WorkspaceCoreContext, args: dict[str, Any]) -> dict[str, Any]:
    return catalog_uc.describe_service(ctx, args)


def op_list_connector_connections(ctx: WorkspaceCoreContext, args: dict[str, Any]) -> dict[str, Any]:
    return connections_uc.list_connections(ctx, args)


def op_list_connector_table_mappings(ctx: WorkspaceCoreContext, args: dict[str, Any]) -> dict[str, Any]:
    return mappings_uc.list_table_mappings(ctx, args)


def op_sync_connector_table_mapping(ctx: WorkspaceCoreContext, args: dict[str, Any]) -> dict[str, Any]:
    return mappings_uc.sync_table_mapping(ctx, args)


def op_invoke_connector_primitive(ctx: WorkspaceCoreContext, args: dict[str, Any]) -> dict[str, Any]:
    return primitives_uc.invoke(ctx, args)


def op_execute_connector_tool(ctx: WorkspaceCoreContext, args: dict[str, Any]) -> dict[str, Any]:
    return tools_uc.execute_tool(ctx, args)


def op_propose_entity_writeback(ctx: WorkspaceCoreContext, args: dict[str, Any]) -> dict[str, Any]:
    return writeback_uc.propose_entity_writeback(ctx, args)
