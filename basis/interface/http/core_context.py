"""Build `WorkspaceCoreContext` for HTTP handlers."""

from __future__ import annotations

from fastapi import Request

from basis.domain.tenancy.admin.store import AdminStore, User
from basis.interface.http.deps import (
    graph_runtime_for,
    get_blob_store,
    get_chunk_search,
    get_workspace_for_editor,
    get_workspace_for_viewer,
    get_knowledge_store,
    get_store,
    graph_projection_bindings,
    rebuild_graph_projection,
    save_graph,
)
from basis.application.context import WorkspaceCoreContext


def build_workspace_core_context(
    request: Request,
    *,
    workspace_id: str,
    user: User,
    store: AdminStore | None = None,
    require_editor: bool = False,
) -> WorkspaceCoreContext:
    store = store or get_store(request)
    if require_editor:
        workspace, _role = get_workspace_for_editor(request, user, workspace_id, store)
    else:
        workspace, _role = get_workspace_for_viewer(request, user, workspace_id, store)
    return WorkspaceCoreContext(
        workspace=workspace,
        user=user,
        knowledge=get_knowledge_store(request),
        store=store,
        chunk_search=get_chunk_search(request),
        runtime_loader=lambda: graph_runtime_for(request, workspace_id),
        assert_workspace_editor=lambda: get_workspace_for_editor(request, user, workspace_id, store),
        rebuild_projection=lambda: rebuild_graph_projection(request, workspace_id),
        persist_graph=lambda kid: save_graph(request, kid),
        blob_store=get_blob_store(request),
        projection_bindings=graph_projection_bindings(request),
    )
