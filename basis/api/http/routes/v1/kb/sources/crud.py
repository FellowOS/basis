"""KB ingest source CRUD and admin routes."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query, Request

from basis.core.errors import AdminError
from basis.control.admin.store import AdminStore, User
from basis.api.http.deps import (
    get_current_user,
    get_kb_for_editor,
    get_kb_for_viewer,
    get_knowledge_store,
    get_store,
)
from basis.core.ledger.services.graph_audit import audit_kb_graph
from basis.core.ledger.store import KnowledgeStore
from basis.api.http.routes.v1.kb.sources.models import (
    CreateIngestSourceRequest,
    UpdateIngestSourceRequest,
)
from basis.api.http.routes.v1.kb.sources.support import webhook_path

router = APIRouter(tags=["knowledge-bases"])

@router.get("/{kb_id}/sources")
async def list_ingest_sources(
    kb_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    """
List Ingest Sources. Ingest sources (HTTP poll, webhook, manual sync). Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
    """
    get_kb_for_viewer(request, user, kb_id, store)
    sources = knowledge.list_ingest_sources(kb_id)
    for source in sources:
        if source["kind"] == "webhook":
            source["webhook_path"] = webhook_path(kb_id, source["id"])
    return {"sources": sources}


@router.post("/{kb_id}/sources")
async def create_ingest_source(
    kb_id: str,
    request: Request,
    body: CreateIngestSourceRequest,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    """
Create Ingest Source. Ingest sources (HTTP poll, webhook, manual sync). Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
    """
    get_kb_for_editor(request, user, kb_id, store)
    source, token = knowledge.create_ingest_source(
        kb_id,
        user.id,
        kind=body.kind,
        name=body.name,
        config=body.config,
        enabled=body.enabled,
    )
    audit_kb_graph(
        store,
        user,
        kb_id,
        "kb.ingest_source.created",
        extra={"source_id": source["id"], "kind": source["kind"]},
    )
    payload: dict[str, Any] = {"source": source}
    if token:
        payload["ingest_token"] = token
        payload["webhook_path"] = webhook_path(kb_id, source["id"])
    return payload


@router.get("/{kb_id}/sources/{source_id}")
async def get_ingest_source(
    kb_id: str,
    request: Request,
    source_id: str,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    """
Get Ingest Source. Ingest sources (HTTP poll, webhook, manual sync). Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
    """
    get_kb_for_viewer(request, user, kb_id, store)
    source = knowledge.get_ingest_source(kb_id, source_id)
    if source["kind"] == "webhook":
        source["webhook_path"] = webhook_path(kb_id, source_id)
    return {"source": source}


@router.patch("/{kb_id}/sources/{source_id}")
async def update_ingest_source(
    kb_id: str,
    request: Request,
    source_id: str,
    body: UpdateIngestSourceRequest,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    """
Update Ingest Source. Ingest sources (HTTP poll, webhook, manual sync). Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
    """
    get_kb_for_editor(request, user, kb_id, store)
    if body.config is not None:
        source = knowledge.get_ingest_source(kb_id, source_id)
        if source["kind"] == "http_poll":
            url = str(body.config.get("url") or source["config"].get("url") or "").strip()
            if url and not url.startswith(("http://", "https://")):
                raise AdminError(422, "bad_url", "http_poll 需要有效的 http(s) URL")
    source = knowledge.update_ingest_source(
        kb_id,
        source_id,
        name=body.name,
        enabled=body.enabled,
        config=body.config,
    )
    audit_kb_graph(
        store,
        user,
        kb_id,
        "kb.ingest_source.updated",
        extra={"source_id": source_id},
    )
    return {"source": source}


@router.delete("/{kb_id}/sources/{source_id}")
async def delete_ingest_source(
    kb_id: str,
    request: Request,
    source_id: str,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    """
Delete Ingest Source. Ingest sources (HTTP poll, webhook, manual sync). Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
    """
    get_kb_for_editor(request, user, kb_id, store)
    knowledge.delete_ingest_source(kb_id, source_id)
    audit_kb_graph(
        store,
        user,
        kb_id,
        "kb.ingest_source.deleted",
        extra={"source_id": source_id},
    )
    return {"status": "deleted"}


@router.post("/{kb_id}/sources/{source_id}/rotate-token")
async def rotate_ingest_source_token(
    kb_id: str,
    request: Request,
    source_id: str,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    """
Rotate Ingest Source Token. Ingest sources (HTTP poll, webhook, manual sync). Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
    """
    get_kb_for_editor(request, user, kb_id, store)
    token = knowledge.rotate_ingest_source_token(kb_id, source_id)
    audit_kb_graph(
        store,
        user,
        kb_id,
        "kb.ingest_source.token_rotated",
        extra={"source_id": source_id},
    )
    return {
        "ingest_token": token,
        "webhook_path": webhook_path(kb_id, source_id),
    }


@router.get("/{kb_id}/sources/{source_id}/sync-history")
async def list_ingest_source_sync_history(
    kb_id: str,
    source_id: str,
    request: Request,
    limit: int = Query(50, ge=1, le=200),
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    """Recent sync runs stored on the source config (`sync_events`, newest first)."""
    get_kb_for_viewer(request, user, kb_id, store)
    source = knowledge.get_ingest_source(kb_id, source_id)
    events = list(source.get("config", {}).get("sync_events") or [])
    capped = min(max(1, limit), 200)
    return {
        "source_id": source_id,
        "events": events[:capped],
        "last_sync_at": source.get("config", {}).get("last_sync_at"),
        "last_sync_status": source.get("config", {}).get("last_sync_status"),
    }

