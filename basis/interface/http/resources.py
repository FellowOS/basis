"""Workspace CRUD, members, and capabilities (HTTP `/api/v1/workspaces`)."""

import asyncio
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from basis.domain.tenancy.admin.store import AdminStore, User
from basis.interface.http.deps import (
    drop_graph,
    get_current_user,
    get_workspace_for_viewer,
    get_store,
)
from basis.interface.http.core_context import build_workspace_core_context
from basis.application.registry import run
from basis.domain.tenancy.realtime.access import revoke_workspace_member_realtime

router = APIRouter(tags=["workspaces"])


class CreateWorkspaceRequest(BaseModel):
    name: str
    description: str | None = None
    visibility: str = "restricted"
    import_demo_data: bool = Field(
        default=False,
        description="When true, seed the workspace with the built-in demo pack (documents, mappings, reasoning).",
    )


class UpdateWorkspaceRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    visibility: str | None = None


class MemberRoleRequest(BaseModel):
    role: str


@router.get("")
async def list_workspaces(
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> dict:
    """List workspaces visible to the current user with role hints."""
    workspaces = []
    for ws in store.list_visible_workspaces(user):
        _, role = store.get_workspace_for(user, ws.id, "viewer")
        item = ws.public()
        item["my_role"] = role
        workspaces.append(item)
    return {"workspaces": workspaces}


@router.post("")
async def create_workspace(
    body: CreateWorkspaceRequest,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> dict:
    """Create a workspace owned by the current user."""
    if body.import_demo_data and not request.app.state.settings.demo_workspace_enabled:
        raise HTTPException(
            status_code=403,
            detail={
                "code": "demo_import_disabled",
                "message": "当前环境未启用演示数据导入",
            },
        )
    workspace = store.create_workspace(user, body.name, body.description, body.visibility)
    if body.import_demo_data:
        from basis.domain.knowledge.demo import load_demo_pack_from_request

        await asyncio.to_thread(load_demo_pack_from_request, request, workspace.id, user.id)
    item = workspace.public()
    item["my_role"] = "owner"
    return item


@router.get("/{workspace_id}")
async def get_workspace(
    workspace_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> dict:
    """Fetch workspace metadata, membership role, and high-level ledger counts."""
    workspace, role = get_workspace_for_viewer(request, user, workspace_id, store)
    item = workspace.public()
    item["my_role"] = role
    ctx = build_workspace_core_context(request, workspace_id=workspace_id, user=user, store=store)
    describe = await asyncio.to_thread(run, ctx, "describe_workspace", {})
    for key in (
        "document_count",
        "chunk_count",
        "entity_count",
        "statement_count",
    ):
        if key in describe:
            item[key] = describe[key]
    return item


@router.get("/{workspace_id}/capabilities")
async def get_capabilities(
    workspace_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> dict[str, Any]:
    """Feature flags for graph runtime, ingest, mappings, and diagnostics for this workspace and role."""
    get_workspace_for_viewer(request, user, workspace_id, store)
    ctx = build_workspace_core_context(request, workspace_id=workspace_id, user=user, store=store)
    return await asyncio.to_thread(run, ctx, "get_capabilities", {})


@router.patch("/{workspace_id}")
async def update_workspace(
    workspace_id: str,
    body: UpdateWorkspaceRequest,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> dict:
    """
Update workspace metadata. Requires workspace membership (session) or workspace API token with read/write scope. All paths are scoped to `{workspace_id}`.
    """
    workspace = store.update_workspace(
        user,
        workspace_id,
        name=body.name,
        description=body.description,
        visibility=body.visibility,
    )
    _, role = store.get_workspace_for(user, workspace.id, "viewer")
    item = workspace.public()
    item["my_role"] = role
    return item


@router.delete("/{workspace_id}")
async def delete_workspace(
    workspace_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> dict:
    """
Delete workspace. Requires workspace membership (session) or workspace API token with read/write scope. All paths are scoped to `{workspace_id}`.
    """
    store.delete_workspace(user, workspace_id)
    drop_graph(request, workspace_id)
    return {"ok": True}


@router.get("/{workspace_id}/members")
async def list_members(
    workspace_id: str,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> dict:
    """
List members. Workspace membership and roles (session only). Requires session JWT (`sessionAuth`).
    """
    return {"members": store.list_members(user, workspace_id)}


@router.put("/{workspace_id}/members/{user_id}")
async def set_member_role(
    workspace_id: str,
    user_id: str,
    body: MemberRoleRequest,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> dict:
    """
Set member role. Workspace membership and roles (session only). Requires session JWT (`sessionAuth`).
    """
    store.set_member_role(user, workspace_id, user_id, body.role)
    revoke_workspace_member_realtime(request, workspace_id, user_id)
    return {"ok": True}


@router.delete("/{workspace_id}/members/{user_id}")
async def remove_member(
    workspace_id: str,
    user_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> dict:
    """
Remove member. Workspace membership and roles (session only). Requires session JWT (`sessionAuth`).
    """
    store.remove_member(user, workspace_id, user_id)
    revoke_workspace_member_realtime(request, workspace_id, user_id)
    return {"ok": True}
