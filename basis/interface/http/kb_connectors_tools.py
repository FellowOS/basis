"""BOCP connector routes — standalone tool execution."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Request

from basis.domain.errors import AdminError
from basis.domain.tenancy.admin.store import AdminStore, User
from basis.interface.http.deps import (
    get_current_user,
    get_kb_for_editor,
    get_knowledge_store,
    get_store,
)
from basis.domain.knowledge.store import KnowledgeStore
from basis.interface.http.kb_connectors_models import ExecuteConnectorToolRequest
from basis.interface.http.kb_connectors_support import runtime_for

router = APIRouter(tags=["knowledge-bases"])

@router.post("/{kb_id}/connectors/tools/execute")
async def execute_kb_connector_tool(
    kb_id: str,
    body: ExecuteConnectorToolRequest,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    """Execute a standalone BOCP connector tool (`ToolSpec`) with KB policy enforcement."""
    get_kb_for_editor(request, user, kb_id, store)
    rt = runtime_for(knowledge)
    try:
        res = rt.execute_tool(
            kb_id,
            body.service,
            body.tool_id,
            connection_name=body.connection_name,
            arguments=body.arguments,
        )
        return res
    except LookupError as exc:
        raise AdminError(404, "connection_not_found", str(exc)) from exc
    except PermissionError as exc:
        raise AdminError(403, "connector_policy_blocked", str(exc)) from exc
    except Exception as exc:
        raise AdminError(422, "connector_tool_execution_failed", str(exc)) from exc

