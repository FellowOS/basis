"""KB ingest source connectors (F-SRC-06/07 MVP: webhook)."""

from __future__ import annotations

import re
import uuid
from typing import Any

from fastapi import APIRouter, Depends, Header, Request
from pydantic import BaseModel, Field

from sema.admin.errors import AdminError
from sema.admin.store import AdminStore, User
from sema.api.deps import get_current_user, get_knowledge_store, get_store
from sema.api.routes.ingest_helpers import enqueue_version_ingest, ingest_accept_payload
from sema.knowledge.graph_audit import audit_kb_graph
from sema.knowledge.store import KnowledgeStore
from sema.pipeline.document import TextIngestOptions

router = APIRouter(prefix="/api/kbs", tags=["knowledge-bases"])


class CreateIngestSourceRequest(BaseModel):
    kind: str = Field(default="webhook", pattern="^webhook$")
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
    stem = re.sub(r"[^a-zA-Z0-9._-]+", "-", (title or "webhook").strip()).strip("-._")
    return stem or f"webhook-{uuid.uuid4().hex[:12]}"


@router.get("/{kb_id}/sources")
async def list_ingest_sources(
    kb_id: str,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    store.get_kb_for(user, kb_id, "viewer")
    return {"sources": knowledge.list_ingest_sources(kb_id)}


@router.post("/{kb_id}/sources")
async def create_ingest_source(
    kb_id: str,
    body: CreateIngestSourceRequest,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    store.get_kb_for(user, kb_id, "editor")
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
        payload["webhook_path"] = f"/api/kbs/{kb_id}/sources/{source['id']}/webhook"
    return payload


@router.get("/{kb_id}/sources/{source_id}")
async def get_ingest_source(
    kb_id: str,
    source_id: str,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    store.get_kb_for(user, kb_id, "viewer")
    return {"source": knowledge.get_ingest_source(kb_id, source_id)}


@router.patch("/{kb_id}/sources/{source_id}")
async def update_ingest_source(
    kb_id: str,
    source_id: str,
    body: UpdateIngestSourceRequest,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    store.get_kb_for(user, kb_id, "editor")
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
    source_id: str,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    store.get_kb_for(user, kb_id, "editor")
    knowledge.delete_ingest_source(kb_id, source_id)
    audit_kb_graph(
        store,
        user,
        kb_id,
        "kb.ingest_source.deleted",
        extra={"source_id": source_id},
    )
    return {"status": "deleted"}


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
    filename = f"{doc_id}.txt"
    outcome = knowledge.store_document_bytes(
        kb_id,
        title=title,
        mime_type="text/plain",
        data=body.text.encode("utf-8"),
        created_by=None,
        original_filename=filename,
        external_key=doc_id,
        source_id=source_id,
    )

    if not body.auto_process:
        return {
            "accepted": True,
            "document_id": outcome.document_id,
            "version_id": outcome.version_id,
            "doc_id": doc_id,
            "status": "uploaded",
        }

    options_payload = {
        "chunk": True,
        "chunk_size": 1800,
        "chunk_overlap": 250,
        "extract": True,
        "ner_method": "pattern",
        "relation_method": "pattern",
        "extract_relations": True,
        "extract_triplets": False,
    }
    options = TextIngestOptions(**options_payload)
    job = knowledge.create_processing_job(
        kb_id,
        version_id=outcome.version_id,
        options=options_payload,
    )
    enqueue_version_ingest(
        request.app,
        kb_id,
        outcome.version_id,
        job["id"],
        filename=filename,
        graph_doc_id=doc_id,
        options=options,
    )
    return ingest_accept_payload(
        job_id=job["id"],
        version_id=outcome.version_id,
        ledger_document_id=outcome.document_id,
        doc_id=doc_id,
        filename=filename,
    )
