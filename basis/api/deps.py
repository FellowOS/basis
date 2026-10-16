"""Auth and knowledge-base access for request handlers."""

from __future__ import annotations

from fastapi import Header, HTTPException, Request

from basis.admin.errors import AdminError
from basis.admin.store import AdminStore, ApiTokenRecord, User
from basis.graph.persistence import GraphPersistence
from basis.graph.projector import apply_rebuild_to_session
from basis.graph.session import GraphSession
from basis.knowledge.blob_store import BlobStore
from basis.knowledge.chunk_search import ChunkSearchService
from basis.knowledge.store import KnowledgeStore
from basis.limits import RuntimeLimits


def get_store(request: Request) -> AdminStore:
    return request.app.state.store


def get_graph_persistence(request: Request) -> GraphPersistence:
    return request.app.state.graph_persistence


def get_blob_store(request: Request) -> BlobStore:
    return request.app.state.blob_store


def get_knowledge_store(request: Request) -> KnowledgeStore:
    return request.app.state.knowledge_store


def get_chunk_search(request: Request) -> ChunkSearchService:
    return request.app.state.chunk_search


def get_runtime_limits(request: Request) -> RuntimeLimits:
    return request.app.state.limits


def get_explorer_registry(request: Request):
    return request.app.state.explorer_registry


def bearer_token(authorization: str | None) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail={"code": "unauthorized", "message": "需要登录"})
    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail={"code": "unauthorized", "message": "需要登录"})
    return token


def get_current_user(
    request: Request,
    authorization: str | None = Header(default=None),
) -> User:
    user, _kind = resolve_bearer(request, authorization)
    return user


def resolve_bearer(
    request: Request,
    authorization: str | None,
) -> tuple[User, str]:
    token = bearer_token(authorization)
    store = get_store(request)
    user = store.user_by_token(token)
    if user is not None:
        request.state.token = token
        request.state.auth_kind = "session"
        request.state.api_token = None
        return user, "session"
    resolved = store.resolve_api_token(token)
    if resolved is None:
        raise HTTPException(status_code=401, detail={"code": "unauthorized", "message": "登录已失效"})
    user, api_record = resolved
    request.state.token = token
    request.state.auth_kind = "api_token"
    request.state.api_token = api_record
    return user, "api_token"


def get_api_token_record(request: Request) -> ApiTokenRecord | None:
    return getattr(request.state, "api_token", None)


def _check_api_token_kb_access(
    request: Request,
    store: AdminStore,
    kb_id: str,
    *,
    write: bool = False,
) -> None:
    api_record = get_api_token_record(request)
    if api_record is None:
        return
    if not store.api_token_allows_kb(api_record, kb_id):
        raise HTTPException(
            status_code=403,
            detail={"code": "forbidden", "message": "令牌未授权此知识库"},
        )
    if write and api_record.scope != "write":
        raise HTTPException(
            status_code=403,
            detail={"code": "forbidden", "message": "令牌无写权限"},
        )


def get_kb_for_viewer(
    request: Request,
    user: User,
    kb_id: str,
    store: AdminStore,
):
    _check_api_token_kb_access(request, store, kb_id)
    return store.get_kb_for(user, kb_id, "viewer")


def get_kb_for_editor(
    request: Request,
    user: User,
    kb_id: str,
    store: AdminStore,
):
    _check_api_token_kb_access(request, store, kb_id, write=True)
    return store.get_kb_for(user, kb_id, "editor")


def get_kb_for_role(
    request: Request,
    user: User,
    kb_id: str,
    store: AdminStore,
    role: str,
):
    if role == "editor":
        return get_kb_for_editor(request, user, kb_id, store)
    return get_kb_for_viewer(request, user, kb_id, store)


def ensure_kb_viewer(
    request: Request,
    user: User,
    kb_id: str,
    store: AdminStore,
) -> None:
    get_kb_for_viewer(request, user, kb_id, store)


def get_kb_for_admin(
    request: Request,
    user: User,
    kb_id: str,
    store: AdminStore,
):
    """KB admin routes (token management, etc.) — session auth only."""
    if get_api_token_record(request) is not None:
        raise HTTPException(
            status_code=403,
            detail={"code": "forbidden", "message": "请使用登录会话管理访问令牌"},
        )
    return store.get_kb_for(user, kb_id, "admin")


def require_system_admin(user: User) -> User:
    if not user.is_admin:
        raise AdminError(403, "forbidden", "需要系统管理员")
    return user


def graph_for(request: Request, kb_id: str) -> GraphSession:
    graphs: dict[str, GraphSession] = request.app.state.graphs
    session = graphs.get(kb_id)
    if session is not None:
        return session

    persistence = get_graph_persistence(request)
    knowledge = get_knowledge_store(request)
    session, meta = persistence.load_snapshot(kb_id)
    ledger = knowledge.get_projection_state(kb_id)
    stale = meta is None or meta.projection_revision < ledger["revision"]
    has_ledger_docs = bool(knowledge.list_ready_documents_for_projection(kb_id))
    if stale and (ledger["revision"] > 0 or has_ledger_docs):
        apply_rebuild_to_session(knowledge, kb_id, session)
        ledger = knowledge.get_projection_state(kb_id)
        persistence.save(
            kb_id,
            session,
            projection_revision=ledger["revision"],
            schema_version=ledger["schema_version"],
        )
    graphs[kb_id] = session
    return session


def rebuild_kb_projection(request: Request, kb_id: str) -> dict:
    """Rebuild in-memory graph from ledger (including typed_facts) and persist."""
    get_explorer_registry(request).invalidate(kb_id)
    session = graph_for(request, kb_id)
    meta = apply_rebuild_to_session(get_knowledge_store(request), kb_id, session)
    save_graph(request, kb_id)
    return meta


def save_graph(request: Request, kb_id: str) -> None:
    session = graph_for(request, kb_id)
    knowledge = get_knowledge_store(request)
    from basis.knowledge.graph_sync import sync_graph_to_ledger

    synced = sync_graph_to_ledger(knowledge, kb_id, session)
    if synced["entities_created"] or synced["statements_created"]:
        apply_rebuild_to_session(knowledge, kb_id, session)
    ledger = knowledge.get_projection_state(kb_id)
    get_graph_persistence(request).save(
        kb_id,
        session,
        projection_revision=ledger["revision"],
        schema_version=ledger["schema_version"],
    )
    get_explorer_registry(request).invalidate(kb_id)
    request.app.state.ws_hub.try_broadcast(
        kb_id,
        {
            "type": "projection_updated",
            "kb_id": kb_id,
            "projection_revision": ledger["revision"],
        },
    )


def drop_graph(request: Request, kb_id: str) -> None:
    request.app.state.graphs.pop(kb_id, None)
    get_graph_persistence(request).delete(kb_id)
