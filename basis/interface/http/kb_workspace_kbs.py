"""KB CRUD, members, and capabilities."""

import asyncio
from typing import Any

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel

from basis.domain.tenancy.admin.store import AdminStore, User
from basis.interface.http.deps import (
    drop_graph,
    get_current_user,
    get_kb_for_viewer,
    get_runtime_limits,
    get_store,
)
from basis.interface.http.kb_core_context import build_kb_core_context
from basis.application.registry import TOOL_NAMES, run
from basis.infra.runtime.capabilities import kb_capabilities
from basis.infra.runtime.limits import RuntimeLimits
from basis.domain.tenancy.realtime.access import revoke_kb_member_realtime

router = APIRouter(tags=["knowledge-bases"])


class CreateKbRequest(BaseModel):
    name: str
    description: str | None = None
    visibility: str = "restricted"


class UpdateKbRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    visibility: str | None = None


class MemberRoleRequest(BaseModel):
    role: str


@router.get("")
async def list_kbs(
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> dict:
    """List knowledge bases visible to the current user with role hints."""
    kbs = []
    for kb in store.list_visible_kbs(user):
        _, role = store.get_kb_for(user, kb.id, "viewer")
        item = kb.public()
        item["my_role"] = role
        kbs.append(item)
    return {"kbs": kbs}


@router.post("")
async def create_kb(
    body: CreateKbRequest,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> dict:
    """Create a knowledge base owned by the current user."""
    kb = store.create_kb(user, body.name, body.description, body.visibility)
    item = kb.public()
    item["my_role"] = "owner"
    return item


@router.get("/{kb_id}")
async def get_kb(
    kb_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> dict:
    """Fetch KB metadata, membership role, and high-level ledger counts."""
    kb, role = get_kb_for_viewer(request, user, kb_id, store)
    item = kb.public()
    item["my_role"] = role
    ctx = build_kb_core_context(request, kb_id=kb_id, user=user, store=store)
    describe = await asyncio.to_thread(run, ctx, "describe_kb", {})
    for key in ("document_count", "chunk_count", "entity_count", "statement_count"):
        if key in describe:
            item[key] = describe[key]
    return item


@router.get("/{kb_id}/capabilities")
async def get_kb_capabilities(
    kb_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    limits: RuntimeLimits = Depends(get_runtime_limits),
) -> dict[str, Any]:
    """
Feature flags for Explorer, ingest, mappings, and diagnostics for this KB and role.
    """
    kb, role = get_kb_for_viewer(request, user, kb_id, store)
    return {
        "kb_id": kb.id,
        "role": role,
        **kb_capabilities(role),
        "graph_page_max_nodes": limits.graph_page_max_nodes,
        "graph_page_max_edges": limits.graph_page_max_edges,
        "upload_max_bytes": limits.upload_max_bytes,
        "import_max_bytes": limits.import_max_bytes,
        "ingest_max_inflight": limits.ingest_max_inflight,
        "ingest_max_pending": limits.ingest_max_pending,
        "processing_job_timeout_seconds": limits.processing_job_timeout_seconds,
        "ingest_max_extract_chars": limits.ingest_max_extract_chars,
        "mcp_tools": list(TOOL_NAMES),
    }


@router.patch("/{kb_id}")
async def update_kb(
    kb_id: str,
    body: UpdateKbRequest,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> dict:
    """
Update Kb. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
    """
    kb = store.update_kb(
        user,
        kb_id,
        name=body.name,
        description=body.description,
        visibility=body.visibility,
    )
    _, role = store.get_kb_for(user, kb.id, "viewer")
    item = kb.public()
    item["my_role"] = role
    return item


@router.delete("/{kb_id}")
async def delete_kb(
    kb_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> dict:
    """
Delete Kb. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
    """
    store.delete_kb(user, kb_id)
    drop_graph(request, kb_id)
    return {"ok": True}


@router.get("/{kb_id}/members")
async def list_members(
    kb_id: str,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> dict:
    """
List Members. KB membership and roles (session only). Requires session JWT (`sessionAuth`).
    """
    return {"members": store.list_members(user, kb_id)}


@router.put("/{kb_id}/members/{user_id}")
async def set_member_role(
    kb_id: str,
    user_id: str,
    body: MemberRoleRequest,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> dict:
    """
Set Member Role. KB membership and roles (session only). Requires session JWT (`sessionAuth`).
    """
    store.set_member_role(user, kb_id, user_id, body.role)
    revoke_kb_member_realtime(request, kb_id, user_id)
    return {"ok": True}


@router.delete("/{kb_id}/members/{user_id}")
async def remove_member(
    kb_id: str,
    user_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> dict:
    """
Remove Member. KB membership and roles (session only). Requires session JWT (`sessionAuth`).
    """
    store.remove_member(user, kb_id, user_id)
    revoke_kb_member_realtime(request, kb_id, user_id)
    return {"ok": True}


