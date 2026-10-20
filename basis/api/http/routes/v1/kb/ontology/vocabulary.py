"""KB SKOS vocabulary routes."""

from __future__ import annotations

import asyncio
from typing import Any, Optional

from fastapi import APIRouter, Depends, File, Form, Query, Request, UploadFile

from basis.control.admin.store import AdminStore, User
from basis.api.http.deps import (
    get_current_user,
    get_kb_for_editor,
    get_kb_for_viewer,
    get_store,
    save_graph,
)
from basis.core.ledger.services.graph_audit import audit_kb_graph
from basis.api.http.routes.v1.kb.ontology.session import explorer_graph_session

router = APIRouter(tags=["knowledge-bases"])

@router.get("/{kb_id}/vocabulary/schemes")
async def kb_vocabulary_schemes(
    kb_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> Any:
    """
Kb Vocabulary Schemes. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
    """
    get_kb_for_viewer(request, user, kb_id, store)
    from basis.core.explorer.vocabulary.read import list_schemes

    session = explorer_graph_session(request, kb_id)
    return await asyncio.to_thread(list_schemes, session)


@router.get("/{kb_id}/vocabulary/concepts")
async def kb_vocabulary_concepts(
    kb_id: str,
    request: Request,
    scheme: str = Query(...),
    search: Optional[str] = Query(None),
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> Any:
    """
Kb Vocabulary Concepts. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
    """
    get_kb_for_viewer(request, user, kb_id, store)
    from basis.core.explorer.vocabulary.read import list_concepts

    session = explorer_graph_session(request, kb_id)
    return await asyncio.to_thread(list_concepts, session, scheme=scheme, search=search)


@router.get("/{kb_id}/vocabulary/hierarchy")
async def kb_vocabulary_hierarchy(
    kb_id: str,
    request: Request,
    scheme: str = Query(...),
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> Any:
    """
Kb Vocabulary Hierarchy. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
    """
    get_kb_for_viewer(request, user, kb_id, store)
    from basis.core.explorer.vocabulary.read import get_hierarchy

    session = explorer_graph_session(request, kb_id)
    return await asyncio.to_thread(get_hierarchy, session, scheme=scheme)


@router.post("/{kb_id}/vocabulary/import")
async def kb_vocabulary_import(
    kb_id: str,
    request: Request,
    file: Optional[UploadFile] = File(None),
    text: Optional[str] = Form(None),
    format: Optional[str] = Form(None),
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> Any:
    """
Kb Vocabulary Import. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
    """
    get_kb_for_editor(request, user, kb_id, store)
    from basis.core.explorer.vocabulary.write import import_vocabulary

    session = explorer_graph_session(request, kb_id)
    if file is not None:
        content = await file.read()
        result = await asyncio.to_thread(
            import_vocabulary,
            session,
            content=content,
            filename=file.filename,
            format=format,
        )
    else:
        result = await asyncio.to_thread(
            import_vocabulary,
            session,
            text=text,
            format=format,
        )
    save_graph(request, kb_id, sync_ledger=False)
    audit_kb_graph(store, user, kb_id, "kb.graph.vocabulary_import", extra=result)
    return result

