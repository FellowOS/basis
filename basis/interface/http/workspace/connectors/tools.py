"""BOCP connector routes — standalone tool execution."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Request

from basis.application.connectors.operations import op_execute_connector_tool
from basis.application.kernel import CoreError
from basis.interface.http.shared.operation_http import (
    http_exception_from_core,
    http_response_from_connector_payload,
)
from basis.domain.tenancy.admin.store import AdminStore, User
from basis.interface.http.workspace.connectors.models import ExecuteConnectorToolRequest
from basis.interface.http.shared.core_context import build_workspace_core_context
from basis.interface.http.shared.deps import get_current_user, get_store

router = APIRouter(tags=["workspaces"])


@router.post(
    "/{workspace_id}/connectors/tools/execute",
)
async def execute_connector_tool(
    workspace_id: str,
    body: ExecuteConnectorToolRequest,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> dict[str, Any]:
    """Execute a standalone BOCP connector tool (`ToolSpec`) with workspace policy enforcement."""
    try:
        ctx = build_workspace_core_context(
            request,
            workspace_id=workspace_id,
            user=user,
            store=store,
            require_editor=True,
        )
        payload = op_execute_connector_tool(
            ctx,
            {
                "service": body.service,
                "tool_id": body.tool_id,
                "connection_name": body.connection_name,
                "arguments": body.arguments,
            },
        )
        return http_response_from_connector_payload(payload, kind="tool")
    except CoreError as exc:
        raise http_exception_from_core(exc) from exc
