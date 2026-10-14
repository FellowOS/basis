import asyncio
import mimetypes
import re
from pathlib import Path
from typing import Any, Literal

from fastapi import APIRouter, Depends, File, Form, Request, UploadFile
from pydantic import BaseModel, Field

from sema.admin.errors import AdminError
from sema.admin.store import AdminStore, User
from sema.api.deps import (
    drop_graph,
    get_chunk_search,
    get_current_user,
    get_explorer_registry,
    get_kb_for_editor,
    get_kb_for_viewer,
    get_knowledge_store,
    get_store,
    graph_for,
    save_graph,
)
from sema.knowledge.chunk_search import ChunkSearchService
from sema.limits import (
    CHUNK_SEARCH_MAX_LIMIT,
    GRAPH_PAGE_MAX_EDGES,
    GRAPH_PAGE_MAX_NODES,
)
from sema.knowledge.store import KnowledgeStore, StoreDocumentOutcome
from sema.graph.documents import list_documents
from sema.explorer.graph_read import (
    find_path,
    get_node,
    list_neighbors,
    paginate_edges,
    search_nodes,
)
from sema.graph.export import graph_snapshot
from sema.graph.projector import apply_rebuild_to_session
from sema.knowledge.graph_audit import audit_kb_graph
from sema.ontology.service import OntologyService
from sema.api.routes.ingest_helpers import respond_ingest
from sema.capabilities import kb_capabilities
from sema.realtime.access import revoke_kb_member_realtime
from sema.pipeline import TextIngestOptions
from sema.pipeline.file_ingest import FileParseError

router = APIRouter(prefix="/api/kbs", tags=["knowledge-bases"])
_ontology = OntologyService()


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


class GraphSearchRequest(BaseModel):
    query: str = Field(min_length=1)
    limit: int = Field(default=20, ge=1, le=50)


class SearchConfigRequest(BaseModel):
    chunk_backend: Literal["sqlite_ledger", "postgres_ledger"] = "sqlite_ledger"
    vector_backend: Literal["sqlite_vec", "pgvector"] = "sqlite_vec"
    embedding_model_id: str | None = None
    keyword_enabled: bool = True
    semantic_enabled: bool = True
    default_mode: Literal["keyword", "semantic", "hybrid"] = "hybrid"
    auto_index: bool = True


class ResolveNodeLabelsRequest(BaseModel):
    ids: list[str] = Field(default_factory=list, max_length=80)


class AppendTextVersionRequest(BaseModel):
    text: str


class IngestTextRequest(BaseModel):
    doc_id: str = Field(min_length=1)
    text: str
    # Deprecated compatibility fields. New clients create a processing job explicitly.
    wait: bool | None = None
    chunk: bool | None = None
    chunk_size: int | None = Field(default=None, ge=200, le=100_000)
    chunk_overlap: int | None = Field(default=None, ge=0, le=10_000)
    extract: bool | None = None
    ner_method: str | None = None
    relation_method: str | None = None
    extract_relations: bool | None = None
    extract_triplets: bool | None = None


class StartProcessingRequest(BaseModel):
    version_id: str = Field(min_length=1)
    wait: bool = False
    chunk: bool = True
    chunk_size: int = Field(default=1800, ge=200, le=100_000)
    chunk_overlap: int = Field(default=250, ge=0, le=10_000)
    extract: bool = True
    ner_method: str = Field(default="pattern", min_length=1, max_length=40)
    relation_method: str = Field(default="pattern", min_length=1, max_length=40)
    extract_relations: bool = True
    extract_triplets: bool = False


class RetryProcessingRequest(BaseModel):
    wait: bool = False


class CreateOntologyRequest(BaseModel):
    namespace: str = Field(min_length=1)
    name: str = Field(min_length=1)
    description: str | None = None


@router.get("")
async def list_kbs(
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> dict:
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
    kb, role = get_kb_for_viewer(request, user, kb_id, store)
    item = kb.public()
    item["my_role"] = role
    return item


@router.get("/{kb_id}/capabilities")
async def get_kb_capabilities(
    kb_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> dict[str, Any]:
    kb, role = get_kb_for_viewer(request, user, kb_id, store)
    return {"kb_id": kb.id, "role": role, **kb_capabilities(role)}


@router.patch("/{kb_id}")
async def update_kb(
    kb_id: str,
    body: UpdateKbRequest,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> dict:
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
    store.delete_kb(user, kb_id)
    drop_graph(request, kb_id)
    return {"ok": True}


@router.get("/{kb_id}/members")
async def list_members(
    kb_id: str,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> dict:
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
    store.remove_member(user, kb_id, user_id)
    revoke_kb_member_realtime(request, kb_id, user_id)
    return {"ok": True}


@router.post("/{kb_id}/graph/rebuild")
async def rebuild_graph(
    kb_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> dict[str, Any]:
    get_kb_for_editor(request, user, kb_id, store)
    session = graph_for(request, kb_id)
    meta = await asyncio.to_thread(
        apply_rebuild_to_session,
        get_knowledge_store(request),
        kb_id,
        session,
    )
    save_graph(request, kb_id)
    audit_kb_graph(
        store,
        user,
        kb_id,
        "kb.graph.projection_rebuild",
        extra={
            "projection_revision": meta.get("projection_revision"),
            "projection_status": meta.get("projection_status"),
            "node_count": meta.get("node_count"),
            "edge_count": meta.get("edge_count"),
        },
    )
    return meta


@router.get("/{kb_id}/graph/projection")
async def graph_projection_status(
    kb_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> dict[str, Any]:
    get_kb_for_viewer(request, user, kb_id, store)
    knowledge = get_knowledge_store(request)
    projection = knowledge.get_projection_state(kb_id)
    session = graph_for(request, kb_id)
    live = session.stats()
    return {
        **projection,
        "node_count": live.get("node_count"),
        "edge_count": live.get("edge_count"),
    }


@router.get("/{kb_id}/graph/stats")
async def graph_stats(
    kb_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> dict[str, int]:
    get_kb_for_viewer(request, user, kb_id, store)
    return graph_for(request, kb_id).stats()


@router.get("/{kb_id}/graph/nodes")
async def graph_nodes_route(
    kb_id: str,
    request: Request,
    node_type: str | None = None,
    search: str | None = None,
    limit: int = 50,
    cursor: str | None = None,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> dict[str, Any]:
    get_kb_for_viewer(request, user, kb_id, store)
    runtime = get_explorer_registry(request).get(request, kb_id)
    page_limit = min(max(1, limit), GRAPH_PAGE_MAX_NODES)
    if runtime.explorer is not None:
        nodes, total, next_cursor = runtime.explorer.paginate_nodes(
            node_type=node_type,
            search=search,
            limit=page_limit,
            cursor=cursor,
        )
        return {
            "nodes": nodes,
            "total": total,
            "next_cursor": next_cursor,
            "engine": "explorer",
        }
    snap = graph_snapshot(runtime.sema, limit_nodes=page_limit)
    nodes = snap["nodes"]
    if search:
        query = search.lower()
        nodes = [n for n in nodes if query in n["id"].lower() or query in n["label"].lower()]
    return {"nodes": nodes, "total": len(nodes), "next_cursor": None, "engine": "snapshot"}


@router.post("/{kb_id}/graph/resolve-labels")
async def resolve_graph_node_labels(
    kb_id: str,
    body: ResolveNodeLabelsRequest,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    get_kb_for_viewer(request, user, kb_id, store)
    ids = [str(i).strip() for i in body.ids if str(i).strip()]
    labels = knowledge.entity_labels_by_ids(kb_id, ids)
    runtime = get_explorer_registry(request).get(request, kb_id)
    for node_id in ids:
        if labels.get(node_id):
            continue
        node = await asyncio.to_thread(get_node, runtime, node_id)
        if node is None:
            continue
        content = str(node.get("content") or "").strip()
        props = node.get("properties") if isinstance(node.get("properties"), dict) else {}
        name = str(props.get("name") or props.get("pref_label") or "").strip()
        labels[node_id] = content or name or None
    return {"labels": labels}


@router.get("/{kb_id}/graph/nodes/{node_id}")
async def graph_node_route(
    kb_id: str,
    node_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> dict[str, Any]:
    get_kb_for_viewer(request, user, kb_id, store)
    runtime = get_explorer_registry(request).get(request, kb_id)
    node = await asyncio.to_thread(get_node, runtime, node_id)
    if node is None:
        raise AdminError(404, "not_found", "节点不存在")
    return {"node": node}


@router.get("/{kb_id}/graph/nodes/{node_id}/neighbors")
async def graph_neighbors_route(
    kb_id: str,
    node_id: str,
    request: Request,
    depth: int = 1,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> dict[str, Any]:
    get_kb_for_viewer(request, user, kb_id, store)
    runtime = get_explorer_registry(request).get(request, kb_id)
    neighbors = await asyncio.to_thread(list_neighbors, runtime, node_id, depth=depth)
    return {"node_id": node_id, "depth": min(max(1, depth), 5), "neighbors": neighbors}


@router.get("/{kb_id}/graph/path")
async def graph_path_route(
    kb_id: str,
    request: Request,
    source: str,
    target: str,
    algorithm: str = "bfs",
    directed: bool = True,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> dict[str, Any]:
    get_kb_for_viewer(request, user, kb_id, store)
    runtime = get_explorer_registry(request).get(request, kb_id)
    if algorithm not in {"bfs", "dijkstra"}:
        raise AdminError(422, "bad_algorithm", "algorithm 须为 bfs 或 dijkstra")
    return await asyncio.to_thread(
        find_path,
        runtime,
        source=source,
        target=target,
        algorithm=algorithm,
        directed=directed,
    )


@router.get("/{kb_id}/graph/edges")
async def graph_edges_route(
    kb_id: str,
    request: Request,
    type: str | None = None,
    source: str | None = None,
    target: str | None = None,
    limit: int = 100,
    cursor: str | None = None,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> dict[str, Any]:
    get_kb_for_viewer(request, user, kb_id, store)
    runtime = get_explorer_registry(request).get(request, kb_id)
    return await asyncio.to_thread(
        paginate_edges,
        runtime,
        edge_type=type,
        source=source,
        target=target,
        limit=limit,
        cursor=cursor,
    )


@router.get("/{kb_id}/search")
async def chunk_search_route(
    kb_id: str,
    q: str,
    request: Request,
    limit: int = 20,
    document_id: str | None = None,
    entity_id: str | None = None,
    mode: Literal["keyword", "semantic", "hybrid"] | None = None,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    chunk_search: ChunkSearchService = Depends(get_chunk_search),
) -> dict[str, Any]:
    get_kb_for_viewer(request, user, kb_id, store)
    capped_limit = min(max(1, limit), CHUNK_SEARCH_MAX_LIMIT)
    knowledge = get_knowledge_store(request)
    resolved_document_id = document_id
    if document_id:
        doc = knowledge.resolve_document_ref(kb_id, document_id)
        if doc is not None:
            resolved_document_id = doc["document_id"]
    return await asyncio.to_thread(
        chunk_search.search,
        kb_id,
        query=q,
        limit=capped_limit,
        document_id=resolved_document_id,
        entity_id=entity_id,
        mode=mode,
    )


@router.get("/{kb_id}/search/config")
async def get_chunk_search_config_route(
    kb_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
    chunk_search: ChunkSearchService = Depends(get_chunk_search),
) -> dict[str, Any]:
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


class SearchReindexRequest(BaseModel):
    document_id: str | None = None
    version_id: str | None = None


@router.post("/{kb_id}/search/reindex")
async def chunk_search_reindex_route(
    kb_id: str,
    request: Request,
    body: SearchReindexRequest | None = None,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    chunk_search: ChunkSearchService = Depends(get_chunk_search),
) -> dict[str, Any]:
    get_kb_for_editor(request, user, kb_id, store)
    body = body or SearchReindexRequest()

    def _reindex() -> dict[str, Any]:
        if body.version_id:
            return chunk_search.index_version(kb_id, body.version_id)
        return chunk_search.reindex_kb(kb_id)

    return await asyncio.to_thread(_reindex)


@router.post("/{kb_id}/graph/search")
async def graph_search_route(
    kb_id: str,
    body: GraphSearchRequest,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> dict[str, Any]:
    get_kb_for_viewer(request, user, kb_id, store)
    runtime = get_explorer_registry(request).get(request, kb_id)
    results = await asyncio.to_thread(
        search_nodes,
        runtime,
        query=body.query,
        limit=body.limit,
    )
    engine = "explorer" if runtime.explorer is not None else "snapshot"
    return {"results": results, "engine": engine}


@router.get("/{kb_id}/graph/snapshot")
async def graph_snapshot_route(
    kb_id: str,
    request: Request,
    limit_nodes: int = 200,
    limit_edges: int = 400,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> dict[str, Any]:
    get_kb_for_viewer(request, user, kb_id, store)
    session = graph_for(request, kb_id)
    capped_nodes = min(max(1, limit_nodes), GRAPH_PAGE_MAX_NODES)
    capped_edges = min(max(1, limit_edges), GRAPH_PAGE_MAX_EDGES)
    return graph_snapshot(session, limit_nodes=capped_nodes, limit_edges=capped_edges)


@router.post("/{kb_id}/documents", response_model=None)
async def ingest_document(
    kb_id: str,
    body: IngestTextRequest,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> Any:
    get_kb_for_editor(request, user, kb_id, store)
    doc_id = body.doc_id.strip()
    filename = f"{doc_id}.txt"
    knowledge = get_knowledge_store(request)
    outcome = knowledge.store_document_bytes(
        kb_id,
        title=filename,
        mime_type="text/plain",
        data=body.text.encode("utf-8"),
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
        "extract_triplets",
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
                extract_triplets=(
                    body.extract_triplets if body.extract_triplets is not None else False
                ),
            ),
            request=request,
            user=user,
            store=store,
            knowledge=knowledge,
        )
    return _document_store_payload(
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
) -> Any:
    get_kb_for_editor(request, user, kb_id, store)
    context = knowledge.resolve_document_ref(kb_id, document_id)
    if context is None:
        raise AdminError(404, "not_found", "文档不存在")
    doc_id = context["external_key"] or context["document_id"]
    filename = f"{doc_id}.txt"
    outcome = knowledge.append_document_version(
        kb_id,
        context["document_id"],
        title=filename,
        mime_type="text/plain",
        data=body.text.encode("utf-8"),
        created_by=user.id,
    )
    return _document_store_payload(
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
) -> Any:
    get_kb_for_editor(request, user, kb_id, store)
    context = knowledge.resolve_document_ref(kb_id, document_id)
    if context is None:
        raise AdminError(404, "not_found", "文档不存在")
    raw = await file.read()
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
    return _document_store_payload(
        knowledge,
        kb_id,
        outcome,
        doc_id=doc_id,
        filename=filename,
    )


@router.get("/{kb_id}/documents")
async def list_kb_documents(
    kb_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> dict[str, Any]:
    get_kb_for_viewer(request, user, kb_id, store)
    graph_docs = list_documents(graph_for(request, kb_id))
    merged: dict[str, dict[str, Any]] = {d["doc_id"]: dict(d) for d in graph_docs}
    for row in get_knowledge_store(request).list_documents(kb_id):
        doc_id = row["doc_id"]
        merged[doc_id] = {**merged.get(doc_id, {}), **row}
    return {"documents": list(merged.values())}


def _document_store_payload(
    knowledge: KnowledgeStore,
    kb_id: str,
    outcome: StoreDocumentOutcome,
    *,
    doc_id: str,
    filename: str,
) -> dict[str, Any]:
    version = knowledge.get_version(kb_id, outcome.version_id)
    unchanged = not outcome.new_document and not outcome.new_version
    return {
        "document_id": outcome.document_id,
        "version_id": outcome.version_id,
        "doc_id": doc_id,
        "filename": filename,
        "version_no": outcome.version_no,
        "new_document": outcome.new_document,
        "new_version": outcome.new_version,
        "unchanged": unchanged,
        "status": version.status,
        "byte_size": outcome.blob.byte_size,
    }


def _processing_options(body: StartProcessingRequest) -> tuple[TextIngestOptions, dict[str, Any]]:
    if body.chunk and body.chunk_overlap >= body.chunk_size:
        raise AdminError(422, "bad_chunk_options", "切分重叠必须小于块大小")
    payload = {
        "chunk": body.chunk,
        "chunk_size": body.chunk_size,
        "chunk_overlap": body.chunk_overlap,
        "extract": body.extract,
        "ner_method": body.ner_method,
        "relation_method": body.relation_method,
        "extract_relations": body.extract_relations,
        "extract_triplets": body.extract_triplets,
    }
    return TextIngestOptions(**payload), payload


@router.get("/{kb_id}/processing/jobs")
async def list_processing_jobs(
    kb_id: str,
    request: Request,
    status: str | None = None,
    limit: int = 100,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    get_kb_for_viewer(request, user, kb_id, store)
    if status and status not in {"queued", "running", "succeeded", "failed", "cancelled"}:
        raise AdminError(422, "bad_status", "任务状态无效")
    return {
        "jobs": knowledge.list_processing_jobs(
            kb_id,
            status=status,
            limit=min(max(1, limit), 200),
        )
    }


@router.post("/{kb_id}/processing/jobs", response_model=None)
async def start_processing_job(
    kb_id: str,
    body: StartProcessingRequest,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> Any:
    get_kb_for_editor(request, user, kb_id, store)
    context = knowledge.get_processing_context(kb_id, body.version_id)
    options, options_payload = _processing_options(body)
    job = knowledge.create_processing_job(
        kb_id,
        version_id=body.version_id,
        options=options_payload,
    )
    session = graph_for(request, kb_id) if body.wait else None

    def _run() -> Any:
        return respond_ingest(
            request.app,
            kb_id,
            body.version_id,
            job["id"],
            context["document_id"],
            wait=body.wait,
            filename=context["filename"],
            graph_doc_id=context["doc_id"],
            options=options,
            graph_session=session,
        )

    try:
        result = await asyncio.to_thread(_run)
    except FileParseError as exc:
        raise AdminError(422, "parse_failed", exc.message) from exc
    if body.wait:
        save_graph(request, kb_id)
    return result


@router.get("/{kb_id}/processing/jobs/{job_id}")
async def get_processing_job(
    kb_id: str,
    request: Request,
    job_id: str,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    get_kb_for_viewer(request, user, kb_id, store)
    job = knowledge.get_job(kb_id, job_id)
    return {
        "job": {
            "id": job.id,
            "kb_id": job.kb_id,
            "kind": job.kind,
            "subject_type": job.subject_type,
            "version_id": job.subject_id,
            "status": job.status,
            "attempt": job.attempt,
            "progress": job.progress,
            "error_code": job.error_code,
            "error_detail": job.error_detail,
            "options": job.options,
            "result": job.result,
            "created_at": job.created_at,
            "started_at": job.started_at,
            "finished_at": job.finished_at,
        }
    }


@router.post("/{kb_id}/processing/jobs/{job_id}/retry", response_model=None)
async def retry_processing_job(
    kb_id: str,
    job_id: str,
    body: RetryProcessingRequest,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> Any:
    get_kb_for_editor(request, user, kb_id, store)
    previous = knowledge.get_job(kb_id, job_id)
    if previous.status not in {"failed", "cancelled"}:
        raise AdminError(409, "job_not_retryable", "仅失败或已取消任务可重试")
    request_body = StartProcessingRequest(
        version_id=previous.subject_id,
        wait=body.wait,
        **previous.options,
    )
    return await start_processing_job(
        kb_id=kb_id,
        body=request_body,
        request=request,
        user=user,
        store=store,
        knowledge=knowledge,
    )


@router.get("/{kb_id}/ingest/jobs/{job_id}")
async def get_ingest_job(
    kb_id: str,
    job_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> dict[str, Any]:
    get_kb_for_viewer(request, user, kb_id, store)
    knowledge = get_knowledge_store(request)
    job = knowledge.get_job(kb_id, job_id)
    payload: dict[str, Any] = {
        "id": job.id,
        "kb_id": job.kb_id,
        "kind": job.kind,
        "subject_type": job.subject_type,
        "subject_id": job.subject_id,
        "status": job.status,
        "attempt": job.attempt,
        "progress": job.progress,
        "error_code": job.error_code,
        "error_detail": job.error_detail,
        "options": job.options,
        "result": job.result,
        "created_at": job.created_at,
        "started_at": job.started_at,
        "finished_at": job.finished_at,
    }
    version_payload: dict[str, Any] | None = None
    if job.subject_type == "document_version":
        version = knowledge.get_version(kb_id, job.subject_id)
        version_payload = {
            "id": version.id,
            "document_id": version.document_id,
            "status": version.status,
            "sha256": version.sha256,
            "byte_size": version.byte_size,
        }
    return {"job": payload, "version": version_payload}


def _doc_id_from_filename(filename: str) -> str:
    stem = Path(filename).stem.strip()
    safe = re.sub(r"[^a-zA-Z0-9._-]+", "-", stem).strip("-._") or "upload"
    return safe


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
) -> Any:
    get_kb_for_editor(request, user, kb_id, store)
    raw = await file.read()
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
    return _document_store_payload(
        knowledge,
        kb_id,
        outcome,
        doc_id=resolved_id,
        filename=filename,
    )


@router.post("/{kb_id}/ontology")
async def create_ontology(
    kb_id: str,
    body: CreateOntologyRequest,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> dict[str, Any]:
    store.get_kb_for(user, kb_id, "admin")
    result = _ontology.create(
        graph_for(request, kb_id),
        namespace=body.namespace,
        name=body.name,
        description=body.description,
    )
    save_graph(request, kb_id)
    return result
