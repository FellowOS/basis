"""KB ontology mapping ledger routes."""

from __future__ import annotations

from typing import Any, Literal

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, Field

from sema.admin.store import AdminStore, User
from sema.api.deps import get_current_user, get_knowledge_store, get_store, rebuild_kb_projection
from sema.knowledge.graph_audit import audit_kb_graph
from sema.knowledge.store import KnowledgeStore

router = APIRouter(prefix="/api/kbs", tags=["knowledge-bases"])


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


@router.get("/{kb_id}/mappings")
async def list_kb_mappings(
    kb_id: str,
    status: str | None = Query(None),
    limit: int = Query(100, ge=1, le=200),
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    store.get_kb_for(user, kb_id, "viewer")
    mappings = knowledge.list_mappings(kb_id, status=status, limit=limit)
    return {"mappings": mappings}


@router.post("/{kb_id}/mappings")
async def create_kb_mapping(
    kb_id: str,
    body: CreateMappingRequest,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    minimum = "editor" if body.status == "confirmed" else "viewer"
    store.get_kb_for(user, kb_id, minimum)
    mapping = knowledge.create_mapping(
        kb_id,
        user.id,
        signature=body.signature,
        target_uri=body.target_uri,
        target_kind=body.target_kind,
        direction=body.direction,
        status=body.status,
        why=body.why,
    )
    audit_kb_graph(
        store,
        user,
        kb_id,
        "kb.mapping.created",
        extra={"mapping_id": mapping["id"], "signature": mapping["signature"], "status": mapping["status"]},
    )
    return {"mapping": mapping}


@router.post("/{kb_id}/mappings/{mapping_id}/status")
async def update_kb_mapping_status(
    kb_id: str,
    mapping_id: str,
    request: Request,
    body: UpdateMappingStatusRequest,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    store.get_kb_for(user, kb_id, "editor")
    mapping = knowledge.update_mapping_status(
        kb_id,
        mapping_id,
        user.id,
        status=body.status,
        why=body.why,
    )
    materialized: dict[str, Any] | None = None
    projection: dict[str, Any] | None = None
    if body.status == "confirmed":
        materialized = knowledge.materialize_mapping_facts(kb_id, mapping_id)
        if materialized.get("created", 0) > 0:
            projection = rebuild_kb_projection(request, kb_id)
    audit_kb_graph(
        store,
        user,
        kb_id,
        "kb.mapping.status",
        extra={
            "mapping_id": mapping_id,
            "status": body.status,
            "materialized": materialized,
        },
    )
    return {"mapping": mapping, "materialized": materialized, "projection": projection}
