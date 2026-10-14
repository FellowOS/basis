"""KB ingest source connectors (F-SRC-06/07 MVP: webhook + http_poll)."""

from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from typing import Any, Literal

from fastapi import APIRouter, Depends, Header, Request
from pydantic import BaseModel, Field

from sema.admin.errors import AdminError
from sema.admin.store import AdminStore, User
from sema.api.deps import get_current_user, get_knowledge_store, get_store, get_kb_for_viewer, get_kb_for_editor
from sema.knowledge.graph_audit import audit_kb_graph
from sema.knowledge.ingest_source_service import (
    enqueue_text_from_source,
    execute_http_poll_sync,
    record_ingest_source_event,
)
from sema.knowledge.store import KnowledgeStore

router = APIRouter(prefix="/api/kbs", tags=["knowledge-bases"])


class CreateIngestSourceRequest(BaseModel):
    kind: Literal["webhook", "http_poll"] = "webhook"
    name: str = Field(min_length=1, max_length=128)
    config: dict[str, Any] = Field(default_factory=dict)
    enabled: bool = True


class UpdateIngestSourceRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=128)
    config: dict[str, Any] | None = None
    enabled: bool | None = None


class WebhookIngestRequest(BaseModel):
    title: str | None = Field(default=None, max_length=256)
    text: str = Field(min_length=1)
    external_key: str | None = Field(default=None, max_length=256)
    auto_process: bool = True


class SyncIngestSourceRequest(BaseModel):
    auto_process: bool = True


def _bearer_token(authorization: str | None) -> str | None:
    if not authorization:
        return None
    parts = authorization.split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    return parts[1].strip() or None


def _doc_id_from_external_key(external_key: str | None, title: str) -> str:
    if external_key and external_key.strip():
        return external_key.strip()
    stem = re.sub(r"[^a-zA-Z0-9._-]+", "-", (title or "ingest").strip()).strip("-._")
    return stem or f"ingest-{uuid.uuid4().hex[:12]}"


def _webhook_path(kb_id: str, source_id: str) -> str:
    return f"/api/kbs/{kb_id}/sources/{source_id}/webhook"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@router.get("/{kb_id}/sources")
async def list_ingest_sources(
    kb_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    get_kb_for_viewer(request, user, kb_id, store)
    sources = knowledge.list_ingest_sources(kb_id)
    for source in sources:
        if source["kind"] == "webhook":
            source["webhook_path"] = _webhook_path(kb_id, source["id"])
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
        payload["webhook_path"] = _webhook_path(kb_id, source["id"])
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
    get_kb_for_viewer(request, user, kb_id, store)
    source = knowledge.get_ingest_source(kb_id, source_id)
    if source["kind"] == "webhook":
        source["webhook_path"] = _webhook_path(kb_id, source_id)
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
        "webhook_path": _webhook_path(kb_id, source_id),
    }


@router.post("/{kb_id}/sources/{source_id}/sync")
async def sync_ingest_source(
    kb_id: str,
    source_id: str,
    request: Request,
    body: SyncIngestSourceRequest,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    get_kb_for_editor(request, user, kb_id, store)
    result = execute_http_poll_sync(
        request.app,
        knowledge,
        kb_id,
        source_id,
        auto_process=body.auto_process,
    )
    audit_kb_graph(
        store,
        user,
        kb_id,
        "kb.ingest_source.sync",
        extra={"source_id": source_id, "doc_id": result.get("doc_id")},
    )
    return {"source_id": source_id, "result": result}


@router.post("/{kb_id}/sources/{source_id}/webhook")
async def ingest_via_webhook(
    kb_id: str,
    source_id: str,
    body: WebhookIngestRequest,
    request: Request,
    authorization: str | None = Header(default=None),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    token = _bearer_token(authorization)
    expected = knowledge.get_ingest_source_secret(kb_id, source_id)
    if not expected or not token or token != expected:
        raise AdminError(401, "unauthorized", "Webhook 令牌无效")

    source = knowledge.get_ingest_source(kb_id, source_id)
    if source["kind"] != "webhook" or not source["enabled"]:
        raise AdminError(403, "forbidden", "来源未启用")

    title = (body.title or "Webhook ingest").strip() or "Webhook ingest"
    doc_id = _doc_id_from_external_key(body.external_key, title)
    at = _now_iso()
    try:
        result = enqueue_text_from_source(
            request.app,
            knowledge,
            kb_id,
            source_id,
            title=title,
            text=body.text,
            doc_id=doc_id,
            auto_process=body.auto_process,
        )
    except Exception as exc:
        record_ingest_source_event(
            knowledge,
            kb_id,
            source_id,
            {"at": at, "status": "failed", "mode": "webhook", "error": str(exc)[:500]},
        )
        raise

    record_ingest_source_event(
        knowledge,
        kb_id,
        source_id,
        {
            "at": at,
            "status": "succeeded",
            "mode": "webhook",
            "doc_id": result.get("doc_id"),
            "job_id": result.get("job_id"),
        },
    )
    return result
