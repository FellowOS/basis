"""Workspace ontology mapping ledger routes."""

from __future__ import annotations

from typing import Any, Literal

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, Field

from basis.domain.tenancy.admin.store import AdminStore, User
from basis.interface.http.deps import (
    get_current_user,
    get_workspace_for_editor,
    get_workspace_for_viewer,
    get_knowledge_store,
    get_store,
    graph_projection_bindings,
    rebuild_kb_projection,
)
from basis.domain.knowledge.services.graph_audit import audit_kb_graph
from basis.domain.ontology.mappings.service import (
    apply_mapping_status_change,
    ensure_mapping_review_item,
)
from basis.domain.knowledge.store import KnowledgeStore

router = APIRouter(tags=["knowledge-bases"])


class CreateMappingRequest(BaseModel):
    signature: str = Field(min_length=1, max_length=512)
    target_uri: str | None = Field(default=None, max_length=2048)
    target_kind: Literal["class", "property", "none"] = "property"
    direction: Literal["forward", "reverse", "n/a"] = "forward"
    status: Literal["proposed", "confirmed"] = "proposed"
    why: str | None = Field(default=None, max_length=2000)


class UpdateMappingStatusRequest(BaseModel):
    status: Literal["confirmed", "rejected", "superseded"]
    why: str | None = Field(default=None, max_length=2000)


@router.get("/{workspace_id}/mappings")
async def list_kb_mappings(
    workspace_id: str,
    request: Request,
    status: str | None = Query(None),
    limit: int = Query(100, ge=1, le=200),
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    """
List Mappings. Statement-to-entity mapping proposals and status. Requires workspace membership (session) or workspace API token with read/write scope. All paths are scoped to `{workspace_id}`.
    """
    get_workspace_for_viewer(request, user, workspace_id, store)
    mappings = knowledge.list_mappings(workspace_id, status=status, limit=limit)
    return {"mappings": mappings}


@router.post("/{workspace_id}/mappings")
async def create_kb_mapping(
    workspace_id: str,
    body: CreateMappingRequest,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    """
Create Mapping. Statement-to-entity mapping proposals and status. Requires workspace membership (session) or workspace API token with read/write scope. All paths are scoped to `{workspace_id}`.
    """
    minimum = "editor" if body.status == "confirmed" else "viewer"
    store.get_workspace_for(user, workspace_id, minimum)
    mapping = knowledge.create_mapping(
        workspace_id,
        user.id,
        signature=body.signature,
        target_uri=body.target_uri,
        target_kind=body.target_kind,
        direction=body.direction,
        status=body.status,
        why=body.why,
    )
    materialized = None
    projection = None
    if body.status == "proposed":
        ensure_mapping_review_item(knowledge, workspace_id, mapping)
    else:
        materialized = knowledge.materialize_mapping_facts(workspace_id, mapping["id"])
        if materialized.get("created", 0) > 0:
            projection = rebuild_kb_projection(request, workspace_id)
    audit_kb_graph(
        store,
        user,
        workspace_id,
        "kb.mapping.created",
        extra={
            "mapping_id": mapping["id"],
            "signature": mapping["signature"],
            "status": mapping["status"],
            "materialized": materialized,
        },
    )
    return {"mapping": mapping, "materialized": materialized, "projection": projection}


@router.post("/{workspace_id}/mappings/{mapping_id}/status")
async def update_kb_mapping_status(
    workspace_id: str,
    mapping_id: str,
    request: Request,
    body: UpdateMappingStatusRequest,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    """
Update Mapping Status. Statement-to-entity mapping proposals and status. Requires workspace membership (session) or workspace API token with read/write scope. All paths are scoped to `{workspace_id}`.
    """
    get_workspace_for_editor(request, user, workspace_id, store)
    return apply_mapping_status_change(
        workspace_id,
        mapping_id,
        user,
        store,
        knowledge,
        status=body.status,
        why=body.why,
        sync_review=True,
        projection_bindings=graph_projection_bindings(request),
    )
