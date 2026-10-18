"""Build `KbCoreContext` for HTTP handlers."""

from __future__ import annotations

from fastapi import Request

from basis.platform.admin.store import AdminStore, User
from basis.transport.http.deps import (
    get_chunk_search,
    get_explorer_registry,
    get_kb_for_editor,
    get_kb_for_viewer,
    get_knowledge_store,
    get_store,
)
from basis.integration.context import KbCoreContext


def build_kb_core_context(
    request: Request,
    *,
    kb_id: str,
    user: User,
    store: AdminStore | None = None,
    require_editor: bool = False,
) -> KbCoreContext:
    store = store or get_store(request)
    if require_editor:
        kb, _role = get_kb_for_editor(request, user, kb_id, store)
    else:
        kb, _role = get_kb_for_viewer(request, user, kb_id, store)
    return KbCoreContext(
        kb=kb,
        user=user,
        knowledge=get_knowledge_store(request),
        store=store,
        chunk_search=get_chunk_search(request),
        runtime_loader=lambda: get_explorer_registry(request).get(request, kb_id),
        assert_kb_editor=lambda: get_kb_for_editor(request, user, kb_id, store),
        http_request=request,
    )
