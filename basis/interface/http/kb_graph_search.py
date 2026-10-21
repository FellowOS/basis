"""KB chunk search, entity find, and search config routes."""

from __future__ import annotations

import asyncio
from typing import Any, Literal

from fastapi import APIRouter, Depends, Query, Request

from basis.domain.tenancy.admin.store import AdminStore, User
from basis.interface.http.deps import (
    get_chunk_search,
    get_current_user,
    get_kb_for_editor,
    get_kb_for_viewer,
    get_knowledge_store,
    get_runtime_limits,
    get_store,
)
from basis.interface.http.kb_core_context import build_kb_core_context
from basis.application.operation_http import http_response_from_payload
from basis.application.registry import run
from basis.domain.knowledge.search import ChunkSearchService
from basis.infra.runtime.limits import RuntimeLimits
from basis.domain.knowledge.store import KnowledgeStore
from basis.interface.http.kb_graph_models import (
    SearchConfigRequest,
    SearchReindexRequest,
)

router = APIRouter(tags=["knowledge-bases"])


@router.get("/{kb_id}/search")
async def chunk_search_route(
    kb_id: str,
    q: str,
    request: Request,
    limit: int = 20,
    document_id: str | None = None,
    entity_id: str | None = None,
    created_after: str | None = None,
    created_before: str | None = None,
    as_of: str | None = Query(
        None,
        description="Point-in-time (ISO): alias for created_before when that param is omitted.",
    ),
    mode: Literal["keyword", "semantic", "hybrid"] | None = None,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    chunk_search: ChunkSearchService = Depends(get_chunk_search),
    limits: RuntimeLimits = Depends(get_runtime_limits),
) -> dict[str, Any]:
    """
Chunk Search Route. Chunk retrieval (keyword, semantic, or hybrid per KB config). Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
    """
    capped_limit = min(max(1, limit), limits.chunk_search_max_limit)
    knowledge = get_knowledge_store(request)
    resolved_document_id = document_id
    if document_id:
        doc = knowledge.resolve_document_ref(kb_id, document_id)
        if doc is not None:
            resolved_document_id = doc["document_id"]
    ctx = build_kb_core_context(request, kb_id=kb_id, user=user, store=store)
    payload = await asyncio.to_thread(
        run,
        ctx,
        "search_chunks",
        {
            "query": q,
            "limit": capped_limit,
            "limit_max": limits.chunk_search_max_limit,
            "document_id": resolved_document_id,
            "entity_id": entity_id,
            "created_after": created_after,
            "created_before": created_before,
            "as_of": as_of,
            "mode": mode,
        },
    )
    return http_response_from_payload(payload)


@router.get("/{kb_id}/search/config")
async def get_chunk_search_config_route(
    kb_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
    chunk_search: ChunkSearchService = Depends(get_chunk_search),
) -> dict[str, Any]:
    """
Get Chunk Search Config Route. Chunk retrieval (keyword, semantic, or hybrid per KB config). Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
    """
    get_kb_for_viewer(request, user, kb_id, store)
    config = knowledge.get_search_config(kb_id)
    postgres = knowledge.database.backend == "postgres"
    return {
        "config": config.public_dict(),
        "status": chunk_search.status(kb_id),
        "available": {
            "chunk_backends": ["postgres_ledger"] if postgres else ["sqlite_ledger"],
            "vector_backends": (
                ["pgvector", "sqlite_vec"] if postgres else ["sqlite_vec"]
            ),
            "search_modes": ["keyword", "semantic", "hybrid"],
            "embedding_models": store.list_configured_models("embed"),
        },
    }


@router.put("/{kb_id}/search/config")
async def update_chunk_search_config_route(
    kb_id: str,
    body: SearchConfigRequest,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
    chunk_search: ChunkSearchService = Depends(get_chunk_search),
) -> dict[str, Any]:
    """
Update Chunk Search Config Route. Chunk retrieval (keyword, semantic, or hybrid per KB config). Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
    """
    store.get_kb_for(user, kb_id, "admin")
    if body.embedding_model_id:
        store.get_embed_settings(body.embedding_model_id)
    previous = knowledge.get_search_config(kb_id)
    config = knowledge.update_search_config(
        kb_id,
        chunk_backend=body.chunk_backend,
        vector_backend=body.vector_backend,
        embedding_model_id=body.embedding_model_id,
        keyword_enabled=body.keyword_enabled,
        semantic_enabled=body.semantic_enabled,
        default_mode=body.default_mode,
        auto_index=body.auto_index,
    )
    reindex_required = (
        previous.vector_backend != config.vector_backend
        or previous.embedding_model_id != config.embedding_model_id
    )
    return {
        "config": config.public_dict(),
        "status": chunk_search.status(kb_id),
        "reindex_required": reindex_required,
    }


@router.post("/{kb_id}/search/reindex")
async def chunk_search_reindex_route(
    kb_id: str,
    request: Request,
    body: SearchReindexRequest | None = None,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    chunk_search: ChunkSearchService = Depends(get_chunk_search),
) -> dict[str, Any]:
    """
Chunk Search Reindex Route. Chunk retrieval (keyword, semantic, or hybrid per KB config). Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
    """
    get_kb_for_editor(request, user, kb_id, store)
    body = body or SearchReindexRequest()

    def _reindex() -> dict[str, Any]:
        if body.version_id:
            return chunk_search.index_version(kb_id, body.version_id)
        return chunk_search.reindex_kb(kb_id)

    return await asyncio.to_thread(_reindex)


@router.get("/{kb_id}/entities/find")
async def find_entities_route(
    kb_id: str,
    request: Request,
    q: str,
    limit: int = 20,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> dict[str, Any]:
    """
Find Entities Route. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
    """
    ctx = build_kb_core_context(request, kb_id=kb_id, user=user, store=store)
    payload = await asyncio.to_thread(
        run,
        ctx,
        "find_entities",
        {"query": q, "limit": limit},
    )
    return http_response_from_payload(payload)
