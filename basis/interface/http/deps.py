"""Auth and knowledge-base access for request handlers."""

from __future__ import annotations

from fastapi import Header, HTTPException, Request

from basis.domain.errors import AdminError
from basis.domain.graph.projection.projection_lifecycle import (
    GraphProjectionBindings,
    graph_session_for_kb,
    rebuild_kb_projection as rebuild_kb_projection_bindings,
    save_graph as save_graph_bindings,
)
from basis.domain.graph.explorer.session.registry import KbExplorerRuntime
from basis.domain.tenancy.admin.store import AdminStore, ApiTokenRecord, User
from basis.domain.graph.projection.snapshot_store import GraphPersistence
from basis.domain.graph.projection.session import GraphSession
from basis.domain.knowledge.blob_store import BlobStore
from basis.domain.knowledge.search import ChunkSearchService
from basis.domain.knowledge.store import KnowledgeStore
from basis.infra.runtime.limits import RuntimeLimits


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


def graph_projection_bindings(request: Request) -> GraphProjectionBindings:
    from basis.domain.graph.explorer.ontology.hub.hub_persistence import persist_kb_ontology_hub

    def _broadcast(kb_id: str, revision: int) -> None:
        request.app.state.ws_hub.try_broadcast(
            kb_id,
            {
                "type": "projection_updated",
                "kb_id": kb_id,
                "projection_revision": revision,
            },
        )

    return GraphProjectionBindings(
        graphs=request.app.state.graphs,
        persistence=get_graph_persistence(request),
        knowledge=get_knowledge_store(request),
        explorer_registry=get_explorer_registry(request),
        persist_ontology_hub=lambda kb_id: persist_kb_ontology_hub(request, kb_id),
        broadcast_projection=_broadcast,
    )


def explorer_runtime_for(request: Request, kb_id: str) -> KbExplorerRuntime:
    bindings = graph_projection_bindings(request)
    return get_explorer_registry(request).get(
        kb_id,
        knowledge=bindings.knowledge,
        basis_for_kb=lambda kid: graph_session_for_kb(bindings, kid),
    )


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
    user, _kind = resolve_actor(request, authorization)
    return user


def resolve_actor(
    request: Request,
    authorization: str | None,
) -> tuple[User, str]:
    settings = request.app.state.settings
    if settings.is_desktop and (not authorization or not authorization.strip()):
        user = getattr(request.app.state, "desktop_user", None)
        if user is None:
            raise HTTPException(
                status_code=500,
                detail={"code": "desktop_uninitialized", "message": "Desktop principal 未初始化"},
            )
        request.state.auth_kind = "desktop"
        request.state.token = None
        request.state.api_token = None
        return user, "desktop"
    return resolve_bearer(request, authorization)


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
    return graph_session_for_kb(graph_projection_bindings(request), kb_id)


def rebuild_kb_projection(request: Request, kb_id: str) -> dict:
    """Rebuild in-memory graph from ledger (including typed_facts) and persist."""
    return rebuild_kb_projection_bindings(graph_projection_bindings(request), kb_id)


def save_graph(request: Request, kb_id: str, *, sync_ledger: bool = True) -> None:
    save_graph_bindings(graph_projection_bindings(request), kb_id, sync_ledger=sync_ledger)


def drop_graph(request: Request, kb_id: str) -> None:
    request.app.state.graphs.pop(kb_id, None)
    persistence = get_graph_persistence(request)
    persistence.delete(kb_id)
    from basis.domain.graph.explorer.ontology.hub.hub_persistence import delete_kb_ontology_hub

    delete_kb_ontology_hub(persistence, kb_id)
    loaded: set[str] = getattr(request.app.state, "_kb_ontology_hub_loaded", set())
    loaded.discard(kb_id)
    for attr in (
        "kb_ontology_registries",
        "kb_ontology_alignments",
        "kb_ontology_drafts",
        "kb_ontology_proposals",
        "kb_ontology_versions",
    ):
        store = getattr(request.app.state, attr, None)
        if isinstance(store, dict):
            store.pop(kb_id, None)
