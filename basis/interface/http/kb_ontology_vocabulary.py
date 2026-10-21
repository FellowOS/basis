"""Workspace SKOS vocabulary routes."""

from __future__ import annotations

import asyncio
from typing import Any, Optional

from fastapi import APIRouter, Depends, File, Form, Query, Request, UploadFile

from basis.domain.tenancy.admin.store import AdminStore, User
from basis.interface.http.deps import (
    get_current_user,
    get_workspace_for_editor,
    get_workspace_for_viewer,
    get_store,
    save_graph,
)
from basis.domain.knowledge.services.graph_audit import audit_kb_graph
from basis.interface.http.kb_ontology_session import kb_graph_session

router = APIRouter(tags=["knowledge-bases"])

@router.get("/{workspace_id}/vocabulary/schemes")
async def kb_vocabulary_schemes(
    workspace_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> Any:
    """
Vocabulary Schemes. Requires workspace membership (session) or workspace API token with read/write scope. All paths are scoped to `{workspace_id}`.
    """
    get_workspace_for_viewer(request, user, workspace_id, store)
    from basis.domain.ontology.vocabulary.read import list_schemes

    session = kb_graph_session(request, workspace_id)
    return await asyncio.to_thread(list_schemes, session)


@router.get("/{workspace_id}/vocabulary/concepts")
async def kb_vocabulary_concepts(
    workspace_id: str,
    request: Request,
    scheme: str = Query(...),
    search: Optional[str] = Query(None),
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> Any:
    """
Vocabulary Concepts. Requires workspace membership (session) or workspace API token with read/write scope. All paths are scoped to `{workspace_id}`.
    """
    get_workspace_for_viewer(request, user, workspace_id, store)
    from basis.domain.ontology.vocabulary.read import list_concepts

    session = kb_graph_session(request, workspace_id)
    return await asyncio.to_thread(list_concepts, session, scheme=scheme, search=search)


@router.get("/{workspace_id}/vocabulary/hierarchy")
async def kb_vocabulary_hierarchy(
    workspace_id: str,
    request: Request,
    scheme: str = Query(...),
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> Any:
    """
Vocabulary Hierarchy. Requires workspace membership (session) or workspace API token with read/write scope. All paths are scoped to `{workspace_id}`.
    """
    get_workspace_for_viewer(request, user, workspace_id, store)
    from basis.domain.ontology.vocabulary.read import get_hierarchy

    session = kb_graph_session(request, workspace_id)
    return await asyncio.to_thread(get_hierarchy, session, scheme=scheme)


@router.post("/{workspace_id}/vocabulary/import")
async def kb_vocabulary_import(
    workspace_id: str,
    request: Request,
    file: Optional[UploadFile] = File(None),
    text: Optional[str] = Form(None),
    format: Optional[str] = Form(None),
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> Any:
    """
Vocabulary Import. Requires workspace membership (session) or workspace API token with read/write scope. All paths are scoped to `{workspace_id}`.
    """
    get_workspace_for_editor(request, user, workspace_id, store)
    from basis.domain.ontology.vocabulary.write import import_vocabulary

    session = kb_graph_session(request, workspace_id)
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
    save_graph(request, workspace_id, sync_ledger=False)
    audit_kb_graph(store, user, workspace_id, "kb.graph.vocabulary_import", extra=result)
    return result
