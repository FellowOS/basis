"""KB document CRUD, ingest, and upload routes."""

from __future__ import annotations

import asyncio
import mimetypes
import re
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, File, Form, Query, Request, UploadFile

from basis.core.errors import AdminError
from basis.control.admin.store import AdminStore, User
from basis.api.http.deps import (
    get_chunk_search,
    get_current_user,
    get_kb_for_editor,
    get_kb_for_viewer,
    get_knowledge_store,
    get_runtime_limits,
    get_store,
    graph_for,
    rebuild_kb_projection,
)
from basis.core.ledger.search import ChunkSearchService
from basis.runtime.limits import RuntimeLimits
from basis.core.ledger.store import KnowledgeStore
from basis.core.projection.documents import list_documents
from basis.api.http.upload_bounds import ensure_payload_bytes, read_bounded_upload
from basis.api.http.routes.v1.kb.documents.jobs import start_processing_job
from basis.api.http.routes.v1.kb.documents.models import (
    AppendTextVersionRequest,
    IngestTextRequest,
    StartProcessingRequest,
)
from basis.api.http.routes.v1.kb.documents.processing_support import (
    document_store_payload,
)

router = APIRouter(tags=["knowledge-bases"])


def _doc_id_from_filename(filename: str) -> str:
    stem = Path(filename).stem.strip()
    safe = re.sub(r"[^a-zA-Z0-9._-]+", "-", stem).strip("-._") or "upload"
    return safe


@router.post("/{kb_id}/documents", response_model=None)
async def ingest_document(
    kb_id: str,
    body: IngestTextRequest,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    limits: RuntimeLimits = Depends(get_runtime_limits),
) -> Any:
    """
Ingest Document. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
    """
    get_kb_for_editor(request, user, kb_id, store)
    doc_id = body.doc_id.strip()
    filename = f"{doc_id}.txt"
    knowledge = get_knowledge_store(request)
    if body.url is not None and body.url.strip():
        url = body.url.strip()
        if not url.startswith(("http://", "https://")):
            raise AdminError(422, "bad_url", "需要有效的 http(s) URL")
        from basis.core.ledger.services.ingest_source_service import fetch_http_poll_text

        raw_text = await asyncio.to_thread(fetch_http_poll_text, url)
    elif body.text is not None:
        raw_text = body.text
    else:
        raise AdminError(422, "empty_body", "需要提供文本或 URL")
    text_bytes = raw_text.encode("utf-8")
    ensure_payload_bytes(len(text_bytes), limits.upload_max_bytes, label="文本上传")
    outcome = knowledge.store_document_bytes(
        kb_id,
        title=filename,
        mime_type="text/plain",
        data=text_bytes,
        created_by=user.id,
        original_filename=filename,
        external_key=doc_id,
    )
    legacy_fields = {
        "wait",
        "chunk",
        "chunk_size",
        "chunk_overlap",
        "extract",
        "ner_method",
        "relation_method",
        "extract_relations",
    }
    if body.model_fields_set & legacy_fields:
        return await start_processing_job(
            kb_id=kb_id,
            body=StartProcessingRequest(
                version_id=outcome.version_id,
                wait=body.wait if body.wait is not None else True,
                chunk=body.chunk if body.chunk is not None else True,
                chunk_size=body.chunk_size or 1800,
                chunk_overlap=body.chunk_overlap if body.chunk_overlap is not None else 250,
                extract=body.extract if body.extract is not None else True,
                ner_method=body.ner_method or "pattern",
                relation_method=body.relation_method or "pattern",
                extract_relations=(
                    body.extract_relations if body.extract_relations is not None else True
                ),
            ),
            request=request,
            user=user,
            store=store,
            knowledge=knowledge,
        )
    return document_store_payload(
        knowledge,
        kb_id,
        outcome,
        doc_id=doc_id,
        filename=filename,
    )


@router.post("/{kb_id}/documents/{document_id}/versions", response_model=None)
async def append_document_version_text(
    kb_id: str,
    document_id: str,
    body: AppendTextVersionRequest,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
    limits: RuntimeLimits = Depends(get_runtime_limits),
) -> Any:
    """
Append Document Version Text. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
    """
    get_kb_for_editor(request, user, kb_id, store)
    context = knowledge.resolve_document_ref(kb_id, document_id)
    if context is None:
        raise AdminError(404, "not_found", "文档不存在")
    doc_id = context["external_key"] or context["document_id"]
    filename = f"{doc_id}.txt"
    text_bytes = body.text.encode("utf-8")
    ensure_payload_bytes(len(text_bytes), limits.upload_max_bytes, label="文本上传")
    outcome = knowledge.append_document_version(
        kb_id,
        context["document_id"],
        title=filename,
        mime_type="text/plain",
        data=text_bytes,
        created_by=user.id,
    )
    return document_store_payload(
        knowledge,
        kb_id,
        outcome,
        doc_id=doc_id,
        filename=filename,
    )


@router.post("/{kb_id}/documents/{document_id}/versions/upload", response_model=None)
async def append_document_version_upload(
    kb_id: str,
    document_id: str,
    request: Request,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
    limits: RuntimeLimits = Depends(get_runtime_limits),
) -> Any:
    """
Append Document Version Upload. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
    """
    get_kb_for_editor(request, user, kb_id, store)
    context = knowledge.resolve_document_ref(kb_id, document_id)
    if context is None:
        raise AdminError(404, "not_found", "文档不存在")
    raw = await read_bounded_upload(file, limits.upload_max_bytes)
    filename = file.filename or "upload.txt"
    doc_id = context["external_key"] or context["document_id"]
    mime_type = file.content_type or mimetypes.guess_type(filename)[0] or "application/octet-stream"
    outcome = knowledge.append_document_version(
        kb_id,
        context["document_id"],
        title=filename,
        mime_type=mime_type,
        data=raw,
        created_by=user.id,
    )
    return document_store_payload(
        knowledge,
        kb_id,
        outcome,
        doc_id=doc_id,
        filename=filename,
    )


@router.delete("/{kb_id}/documents/{document_id}")
async def delete_kb_document(
    kb_id: str,
    document_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    chunk_search: ChunkSearchService = Depends(get_chunk_search),
) -> dict[str, Any]:
    """
Delete Kb Document. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
    """
    get_kb_for_editor(request, user, kb_id, store)
    knowledge = get_knowledge_store(request)
    context = knowledge.resolve_document_ref(kb_id, document_id)
    if context is None:
        raise AdminError(404, "not_found", "文档不存在")
    outcome = knowledge.hard_delete_document(kb_id, context["document_id"])
    chunk_ids = outcome.get("chunk_ids") or []
    if chunk_ids:
        await asyncio.to_thread(chunk_search.delete_chunk_vectors, kb_id, chunk_ids)
    projection = await asyncio.to_thread(rebuild_kb_projection, request, kb_id)
    return {"ok": True, **outcome, "projection": projection}


@router.get("/{kb_id}/documents")
async def list_kb_documents(
    kb_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> dict[str, Any]:
    """
List Kb Documents. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
    """
    get_kb_for_viewer(request, user, kb_id, store)
    graph_docs = list_documents(graph_for(request, kb_id))
    merged: dict[str, dict[str, Any]] = {d["doc_id"]: dict(d) for d in graph_docs}
    for row in get_knowledge_store(request).list_documents(kb_id):
        doc_id = row["doc_id"]
        merged[doc_id] = {**merged.get(doc_id, {}), **row}
    documents = sorted(
        merged.values(),
        key=lambda row: row.get("created_at") or "",
        reverse=True,
    )
    return {"documents": documents}


@router.get("/{kb_id}/documents/{document_id}/timeline")
async def get_kb_document_timeline(
    kb_id: str,
    document_id: str,
    request: Request,
    limit: int = Query(200, ge=1, le=500),
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    """Document-level ledger timeline (F-TIM-02).

    Ordered events for one document: `version_created`, `processing_job`,
    `statement_recorded`, and `time_mention` (when present). Instants use ledger
    `created_at` / `recorded_at` / job `finished_at` — align with graph scrubber
    via `GET .../temporal/*`, not chunk search `as_of` alone.
    """
    get_kb_for_viewer(request, user, kb_id, store)
    context = knowledge.resolve_document_ref(kb_id, document_id)
    if context is None:
        raise AdminError(404, "not_found", "文档不存在")
    doc_uuid = context["document_id"]
    events = knowledge.list_document_timeline_events(kb_id, doc_uuid, limit=limit)
    return {
        "document_id": doc_uuid,
        "doc_id": context.get("external_key"),
        "events": events,
    }


@router.post("/{kb_id}/documents/upload", response_model=None)
async def upload_document(
    kb_id: str,
    request: Request,
    file: UploadFile = File(...),
    doc_id: str | None = Form(default=None),
    extract: bool | None = Form(default=None),
    wait: bool | None = Form(default=None),
    chunk: bool | None = Form(default=None),
    chunk_size: int | None = Form(default=None),
    chunk_overlap: int | None = Form(default=None),
    ner_method: str | None = Form(default=None),
    relation_method: str | None = Form(default=None),
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    limits: RuntimeLimits = Depends(get_runtime_limits),
) -> Any:
    """
Upload Document. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
    """
    get_kb_for_editor(request, user, kb_id, store)
    raw = await read_bounded_upload(file, limits.upload_max_bytes)
    filename = file.filename or "upload.txt"
    resolved_id = (doc_id or _doc_id_from_filename(filename)).strip()
    if not resolved_id:
        raise AdminError(422, "bad_doc_id", "doc_id 无效")
    mime_type = file.content_type or mimetypes.guess_type(filename)[0] or "application/octet-stream"
    knowledge = get_knowledge_store(request)
    outcome = knowledge.store_document_bytes(
        kb_id,
        title=filename,
        mime_type=mime_type,
        data=raw,
        created_by=user.id,
        original_filename=filename,
        external_key=resolved_id,
    )
    if any(
        value is not None
        for value in (
            extract,
            wait,
            chunk,
            chunk_size,
            chunk_overlap,
            ner_method,
            relation_method,
        )
    ):
        return await start_processing_job(
            kb_id=kb_id,
            body=StartProcessingRequest(
                version_id=outcome.version_id,
                wait=wait if wait is not None else True,
                chunk=chunk if chunk is not None else True,
                chunk_size=chunk_size or 1800,
                chunk_overlap=chunk_overlap if chunk_overlap is not None else 250,
                extract=extract if extract is not None else True,
                ner_method=ner_method or "pattern",
                relation_method=relation_method or "pattern",
            ),
            request=request,
            user=user,
            store=store,
            knowledge=knowledge,
        )
    return document_store_payload(
        knowledge,
        kb_id,
        outcome,
        doc_id=resolved_id,
        filename=filename,
    )
