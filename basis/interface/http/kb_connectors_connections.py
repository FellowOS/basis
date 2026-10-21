"""BOCP connector routes — connections, discover, primitives."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query, Request

from basis.domain.integration import get_connector_catalog
from basis.domain.integration.primitive_invoke import execute_connector_primitive
from basis.domain.errors import AdminError
from basis.domain.tenancy.admin.store import AdminStore, User
from basis.interface.http.deps import (
    get_current_user,
    get_workspace_for_editor,
    get_workspace_for_viewer,
    get_knowledge_store,
    get_store,
)
from basis.domain.knowledge.store import KnowledgeStore
from basis.interface.http.kb_connectors_models import (
    InvokeConnectorPrimitiveRequest,
    UpsertConnectorConnectionRequest,
)
from basis.interface.http.kb_connectors_support import runtime_for

router = APIRouter(tags=["knowledge-bases"])

@router.get("/{workspace_id}/connectors/connections")
async def list_kb_connector_connections(
    workspace_id: str,
    request: Request,
    service: str | None = Query(default=None),
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    """List configured BOCP connections for this workspace (credentials redacted)."""
    get_workspace_for_viewer(request, user, workspace_id, store)
    rt = runtime_for(knowledge)
    conns = rt.vault.list_connections(workspace_id, service=service)
    return {"connections": [c.to_public_dict() for c in conns]}


@router.put("/{workspace_id}/connectors/connections/{service}/{connection_name}")
async def upsert_kb_connector_connection(
    workspace_id: str,
    service: str,
    connection_name: str,
    body: UpsertConnectorConnectionRequest,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    """Create or update an encrypted BOCP connection for this workspace."""
    get_workspace_for_editor(request, user, workspace_id, store)
    if not get_connector_catalog().get(service):
        raise AdminError(404, "connector_not_found", f"未知的连接器服务: {service}")
    rt = runtime_for(knowledge)
    stored = rt.vault.upsert_connection(
        workspace_id,
        service,
        connection_name=connection_name,
        auth_type=body.auth_type,
        connection_config=body.connection_config,
        credentials=body.credentials,
    )
    return {"connection": stored.to_public_dict()}


@router.delete("/{workspace_id}/connectors/connections/{service}/{connection_name}")
async def delete_kb_connector_connection(
    workspace_id: str,
    service: str,
    connection_name: str,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    """Delete a configured BOCP connection from this workspace."""
    get_workspace_for_editor(request, user, workspace_id, store)
    rt = runtime_for(knowledge)
    deleted = rt.vault.delete_connection(workspace_id, service, connection_name=connection_name)
    if not deleted:
        raise AdminError(404, "connection_not_found", "连接不存在")
    return {"deleted": True}


@router.post("/{workspace_id}/connectors/connections/{service}/{connection_name}/check")
async def check_kb_connector_connection(
    workspace_id: str,
    service: str,
    connection_name: str,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    """Run the BOCP `CHECK` health check against an upstream connection."""
    get_workspace_for_editor(request, user, workspace_id, store)
    rt = runtime_for(knowledge)
    try:
        profile = rt.check_connection(workspace_id, service, connection_name=connection_name)
        return {"ok": True, "profile": profile}
    except LookupError as exc:
        raise AdminError(404, "connection_not_found", str(exc)) from exc
    except PermissionError as exc:
        raise AdminError(403, "connector_policy_blocked", str(exc)) from exc
    except Exception as exc:
        raise AdminError(422, "connector_check_failed", str(exc)) from exc


@router.get("/{workspace_id}/connectors/connections/{service}/{connection_name}/discover")
async def discover_kb_connector_schema(
    workspace_id: str,
    service: str,
    connection_name: str,
    request: Request,
    stream_name: str | None = Query(default=None),
    external_table: str | None = Query(default=None),
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    """Run the BOCP `DISCOVER` schema introspection for a SQL table or REST stream."""
    get_workspace_for_viewer(request, user, workspace_id, store)
    rt = runtime_for(knowledge)
    try:
        info = rt.discover_schema(
            workspace_id,
            service,
            connection_name=connection_name,
            stream_name=stream_name,
            external_table=external_table,
        )
        return {
            "stream_name": info.stream_name,
            "display_name": info.display_name,
            "external_table": info.external_table,
            "primary_key": info.primary_key,
            "cursor_field": info.cursor_field,
            "fields": [f.model_dump(mode="json") for f in info.fields],
        }
    except LookupError as exc:
        raise AdminError(404, "connection_not_found", str(exc)) from exc
    except PermissionError as exc:
        raise AdminError(403, "connector_policy_blocked", str(exc)) from exc
    except Exception as exc:
        raise AdminError(422, "connector_discover_failed", str(exc)) from exc


@router.post(
    "/{workspace_id}/connectors/connections/{service}/{connection_name}/invoke-primitive"
)
async def invoke_kb_connector_primitive(
    workspace_id: str,
    service: str,
    connection_name: str,
    body: InvokeConnectorPrimitiveRequest,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    """Run a BOCP Section 10 primitive (discover, list, mutate, invoke) without a table mapping."""
    if body.primitive in ("discover", "list"):
        get_workspace_for_viewer(request, user, workspace_id, store)
    else:
        get_workspace_for_editor(request, user, workspace_id, store)
    rt = runtime_for(knowledge)
    try:
        return execute_connector_primitive(
            rt,
            workspace_id,
            service,
            action_id=body.action_id,
            primitive=body.primitive,
            connection_name=connection_name,
            operation=body.operation,
            external_table=body.external_table,
            external_id=body.external_id,
            changes=body.changes or None,
            action_params=body.action_params or None,
            limit=body.limit,
            cursor_watermark=body.cursor_watermark,
            arguments=body.arguments or None,
            primary_key_column=body.primary_key_column,
            cursor_column=body.cursor_column,
        )
    except LookupError as exc:
        raise AdminError(404, "connection_not_found", str(exc)) from exc
    except PermissionError as exc:
        raise AdminError(403, "connector_policy_blocked", str(exc)) from exc
    except ValueError as exc:
        raise AdminError(422, "connector_primitive_invalid", str(exc)) from exc
    except Exception as exc:
        raise AdminError(422, "connector_primitive_failed", str(exc)) from exc
