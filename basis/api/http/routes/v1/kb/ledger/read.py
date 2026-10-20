"""KB evidence ledger read routes."""

from __future__ import annotations

import asyncio
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
from basis.api.http.kb_core_context import build_kb_core_context
from basis.application.http import http_response_from_payload
from basis.application.registry import run
from basis.core.ledger.store import KnowledgeStore

router = APIRouter(tags=["knowledge-bases"])

@router.get("/{kb_id}/ledger/surface-phrases")
async def list_surface_phrases(
    kb_id: str,
    request: Request,
    limit: int = Query(100, ge=1, le=200),
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    """
List Surface Phrases. Evidence ledger: documents, chunks, statements, entities. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
    """
    get_kb_for_viewer(request, user, kb_id, store)
    phrases = knowledge.list_distinct_surface_phrases(kb_id, limit=limit)
    return {"phrases": phrases}


@router.get("/{kb_id}/ledger/derived-facts")
async def list_derived_facts_route(
    kb_id: str,
    request: Request,
    limit: int = Query(100, ge=1, le=200),
    entity_id: str | None = Query(None, max_length=128),
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    """
List Derived Facts Route. Evidence ledger: documents, chunks, statements, entities. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
    """
    get_kb_for_viewer(request, user, kb_id, store)
    if entity_id and entity_id.strip():
        facts = knowledge.list_derived_facts_for_entity(
            kb_id, entity_id.strip(), limit=limit
        )
    else:
        facts = knowledge.list_derived_facts(kb_id, limit=limit)
    return {"derived_facts": facts}


@router.get("/{kb_id}/ledger/entities")
async def search_ledger_entities(
    kb_id: str,
    request: Request,
    query: str = Query("", max_length=200),
    limit: int = Query(20, ge=1, le=50),
    offset: int = Query(0, ge=0),
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    """
Search Ledger Entities. Evidence ledger: documents, chunks, statements, entities. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
    """
    get_kb_for_viewer(request, user, kb_id, store)
    q = query.strip()
    total = knowledge.count_browse_entities(kb_id, query=q)
    if q:
        entities = knowledge.find_entities(kb_id, query=q, limit=limit, offset=offset)
    else:
        entities = knowledge.list_recent_entities(kb_id, limit=limit, offset=offset)
    return {"entities": entities, "total": total, "limit": limit, "offset": offset}


@router.get("/{kb_id}/ledger/documents/{doc_ref}")
async def get_ledger_document_route(
    kb_id: str,
    request: Request,
    doc_ref: str,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    """
Get Ledger Document Route. Evidence ledger: documents, chunks, statements, entities. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
    """
    get_kb_for_viewer(request, user, kb_id, store)
    summary = knowledge.get_document_summary(kb_id, doc_ref)
    if summary is None:
        raise AdminError(404, "document_not_found", "文档不存在")
    return {"document": summary}


@router.get("/{kb_id}/ledger/documents/{doc_ref}/chunks")
async def list_document_chunks_route(
    kb_id: str,
    request: Request,
    doc_ref: str,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    """
List Document Chunks Route. Evidence ledger: documents, chunks, statements, entities. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
    """
    get_kb_for_viewer(request, user, kb_id, store)
    doc = knowledge.resolve_document_ref(kb_id, doc_ref)
    if doc is None:
        raise AdminError(404, "document_not_found", "文档不存在")
    version_id = doc.get("version_id")
    if not version_id:
        return {
            "doc_ref": doc_ref,
            "document_id": doc["document_id"],
            "external_key": doc.get("external_key"),
            "chunks": [],
        }
    chunks = knowledge.list_chunks_for_version(kb_id, version_id)
    return {
        "doc_ref": doc_ref,
        "document_id": doc["document_id"],
        "external_key": doc.get("external_key"),
        "version_id": version_id,
        "chunks": chunks,
    }


@router.get("/{kb_id}/ledger/chunks/{chunk_id}")
async def get_ledger_chunk_route(
    kb_id: str,
    request: Request,
    chunk_id: str,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    """
Get Ledger Chunk Route. Evidence ledger: documents, chunks, statements, entities. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
    """
    ctx = build_kb_core_context(request, kb_id=kb_id, user=user, store=store)
    payload = await asyncio.to_thread(run, ctx, "get_chunk", {"chunk_id": chunk_id})
    data = http_response_from_payload(payload)
    statements = knowledge.list_statements_for_chunk(kb_id, chunk_id)
    return {"chunk": data["chunk"], "statements": statements}


@router.get("/{kb_id}/ledger/statements/{statement_id}")
async def get_ledger_statement_route(
    kb_id: str,
    request: Request,
    statement_id: str,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    """
Get Ledger Statement. Resolve a statement id to its subject entity for console deep links (F-RUL-03). Requires KB membership (session) or KB API token with read scope. All paths are scoped to `{kb_id}`.
    """
    get_kb_for_viewer(request, user, kb_id, store)
    summary = knowledge.get_statement_browse(kb_id, statement_id=statement_id)
    if summary is None:
        raise AdminError(404, "statement_not_found", "陈述不存在")
    return {"statement": summary}


@router.get("/{kb_id}/ledger/entities/{entity_id}/facts")
async def list_entity_facts_route(
    kb_id: str,
    request: Request,
    entity_id: str,
    limit: int = Query(50, ge=1, le=100),
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    """
List Entity Facts Route. Evidence ledger: documents, chunks, statements, entities. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
    """
    ctx = build_kb_core_context(request, kb_id=kb_id, user=user, store=store)
    payload = await asyncio.to_thread(
        run,
        ctx,
        "entity_facts",
        {"entity_id": entity_id, "limit": limit},
    )
    data = http_response_from_payload(payload)
    derived_facts = knowledge.list_derived_facts_for_entity(kb_id, entity_id, limit=limit)
    sync_svc = knowledge.connector_sync_service()
    external_sync = sync_svc.get_entity_external_sync_context(kb_id, entity_id)
    return {**data, "derived_facts": derived_facts, "external_sync": external_sync}


@router.get("/{kb_id}/ledger/entities/{entity_id}/delete-preview")
async def preview_delete_ledger_entity(
    kb_id: str,
    entity_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    """
Preview Delete Ledger Entity. Evidence ledger: documents, chunks, statements, entities. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
    """
    get_kb_for_editor(request, user, kb_id, store)
    return knowledge.preview_entity_deletion(kb_id, entity_id)


@router.get("/{kb_id}/ledger/typed-facts")
async def list_typed_facts_route(
    kb_id: str,
    request: Request,
    limit: int = Query(100, ge=1, le=200),
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    """
List Typed Facts Route. Evidence ledger: documents, chunks, statements, entities. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
    """
    get_kb_for_viewer(request, user, kb_id, store)
    facts = knowledge.list_typed_facts(kb_id, limit=limit)
    return {"facts": facts}


@router.get("/{kb_id}/ledger/entity-merges")
async def list_entity_merges_route(
    kb_id: str,
    request: Request,
    limit: int = Query(100, ge=1, le=200),
    active_only: bool = Query(True),
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    """
List Entity Merges Route. Evidence ledger: documents, chunks, statements, entities. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
    """
    get_kb_for_viewer(request, user, kb_id, store)
    merges = knowledge.list_entity_merges(kb_id, limit=limit, active_only=active_only)
    return {"merges": merges}


