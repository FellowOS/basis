"""Read-only ledger helpers for KB manage workspaces."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query, Request

from sema.admin.errors import AdminError
from sema.admin.store import AdminStore, User
from sema.api.deps import get_current_user, get_knowledge_store, get_store, rebuild_kb_projection, get_kb_for_viewer, get_kb_for_editor
from sema.knowledge.graph_audit import audit_kb_graph
from sema.knowledge.store import KnowledgeStore

router = APIRouter(prefix="/api/kbs", tags=["knowledge-bases"])


@router.get("/{kb_id}/ledger/surface-phrases")
async def list_surface_phrases(
    kb_id: str,
    request: Request,
    limit: int = Query(100, ge=1, le=200),
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    get_kb_for_viewer(request, user, kb_id, store)
    phrases = knowledge.list_distinct_surface_phrases(kb_id, limit=limit)
    return {"phrases": phrases}


@router.get("/{kb_id}/ledger/derived-facts")
async def list_derived_facts_route(
    kb_id: str,
    request: Request,
    limit: int = Query(100, ge=1, le=200),
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    get_kb_for_viewer(request, user, kb_id, store)
    return {"derived_facts": knowledge.list_derived_facts(kb_id, limit=limit)}


@router.get("/{kb_id}/ledger/entities")
async def search_ledger_entities(
    kb_id: str,
    request: Request,
    query: str = Query("", max_length=200),
    limit: int = Query(20, ge=1, le=50),
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    get_kb_for_viewer(request, user, kb_id, store)
    if query.strip():
        entities = knowledge.find_entities(kb_id, query=query, limit=limit)
    else:
        entities = knowledge.list_recent_entities(kb_id, limit=limit)
    return {"entities": entities}


@router.get("/{kb_id}/ledger/documents/{doc_ref}")
async def get_ledger_document_route(
    kb_id: str,
    request: Request,
    doc_ref: str,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
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
    get_kb_for_viewer(request, user, kb_id, store)
    chunk = knowledge.get_chunk(kb_id, chunk_id)
    if chunk is None:
        raise AdminError(404, "chunk_not_found", "片段不存在")
    statements = knowledge.list_statements_for_chunk(kb_id, chunk_id)
    return {"chunk": chunk, "statements": statements}


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
    get_kb_for_viewer(request, user, kb_id, store)
    facts = knowledge.list_entity_facts(kb_id, entity_id=entity_id, limit=limit)
    return {"entity_id": entity_id, "facts": facts}


@router.get("/{kb_id}/ledger/typed-facts")
async def list_typed_facts_route(
    kb_id: str,
    request: Request,
    limit: int = Query(100, ge=1, le=200),
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
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
    get_kb_for_viewer(request, user, kb_id, store)
    merges = knowledge.list_entity_merges(kb_id, limit=limit, active_only=active_only)
    return {"merges": merges}


@router.post("/{kb_id}/ledger/entity-merges/{merge_id}/revert")
async def revert_entity_merge_route(
    kb_id: str,
    merge_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    get_kb_for_editor(request, user, kb_id, store)
    merged = knowledge.revert_entity_merge(kb_id, merge_id, reverted_by=user.id)
    projection = rebuild_kb_projection(request, kb_id)
    audit_kb_graph(
        store,
        user,
        kb_id,
        "kb.ledger.entity_merge_revert",
        extra={"merge_id": merge_id, "merge": merged, "projection": projection},
    )
    return {"merge": merged, "projection": projection}
