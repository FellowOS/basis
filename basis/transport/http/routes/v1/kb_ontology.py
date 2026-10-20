"""KB-scoped vocabulary and ontology-hub (alignments) adapters."""

from __future__ import annotations

import asyncio
from typing import Any, Optional

from fastapi import APIRouter, Depends, File, Form, Query, Request, UploadFile

from basis.platform.admin.errors import AdminError
from basis.platform.admin.store import AdminStore, User
from basis.transport.http.deps import get_current_user, get_explorer_registry, get_store, save_graph, get_kb_for_viewer, get_kb_for_editor
from basis.domain.explorer.kb_scoped_ontology_state import KbOntologyState
from basis.domain.explorer.session_guard import require_explorer_graph_session
from basis.domain.kb.services.graph_audit import audit_kb_graph
from basis.domain.explorer.ontology_kb_hub import register_kb_ontology_hub_routes

router = APIRouter(tags=["knowledge-bases"])


def _session(request: Request, kb_id: str):
    runtime = get_explorer_registry(request).get(request, kb_id)
    return require_explorer_graph_session(runtime)


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
    from basis.domain.explorer.vocabulary_read import list_schemes

    session = _session(request, kb_id)
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
    from basis.domain.explorer.vocabulary_read import list_concepts

    session = _session(request, kb_id)
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
    from basis.domain.explorer.vocabulary_read import get_hierarchy

    session = _session(request, kb_id)
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
    from basis.domain.explorer.vocabulary_write import import_vocabulary

    session = _session(request, kb_id)
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


@router.get("/{kb_id}/ontology/registry")
async def kb_ontology_registry(
    kb_id: str,
    request: Request,
    q: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    format: Optional[str] = Query(None),
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> Any:
    """
Kb Ontology Registry. Ontology workspace (SKOS, alignments) via Explorer. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
    """
    get_kb_for_viewer(request, user, kb_id, store)
    from basis.domain.explorer.ontology_catalog import list_registry

    session = _session(request, kb_id)
    with KbOntologyState(request, kb_id):
        registry = request.app.state.kb_ontology_registries[kb_id]
        return await asyncio.to_thread(
            list_registry,
            registry,
            session,
            q=q,
            status=status,
            format=format,
        )


@router.get("/{kb_id}/ontology/alignments")
async def kb_list_alignments(
    kb_id: str,
    request: Request,
    uri: Optional[str] = Query(None),
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> Any:
    """
Kb List Alignments. Ontology workspace (SKOS, alignments) via Explorer. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
    """
    get_kb_for_viewer(request, user, kb_id, store)

    with KbOntologyState(request, kb_id):
        align_store = request.app.state.kb_ontology_alignments[kb_id]
        alignments = list(align_store.values())
        if uri:
            alignments = [
                item
                for item in alignments
                if str(item.get("source_uri", "")).startswith(uri)
                or str(item.get("target_uri", "")).startswith(uri)
            ]
        return sorted(
            alignments,
            key=lambda item: (
                item.get("source_label", ""),
                item.get("target_label", ""),
                item.get("relation", ""),
            ),
        )


@router.post("/{kb_id}/ontology/alignments")
async def kb_upsert_alignment(
    kb_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> Any:
    """
Kb Upsert Alignment. Ontology workspace (SKOS, alignments) via Explorer. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
    """
    get_kb_for_editor(request, user, kb_id, store)
    from basis.domain.explorer.ontology_catalog import upsert_alignment

    raw = await request.json()
    if not isinstance(raw, dict):
        raise AdminError(422, "validation_error", "请求体须为 JSON 对象")
    session = _session(request, kb_id)
    with KbOntologyState(request, kb_id):
        align_store = request.app.state.kb_ontology_alignments[kb_id]
        return await asyncio.to_thread(
            upsert_alignment,
            align_store,
            session,
            source_uri=str(raw.get("source_uri", "")),
            target_uri=str(raw.get("target_uri", "")),
            relation=str(raw.get("relation", "")),
            source_label=raw.get("source_label"),
            target_label=raw.get("target_label"),
            confidence=float(raw.get("confidence", 1.0)),
            provenance=raw.get("provenance"),
            source=raw.get("source"),
            reviewer=raw.get("reviewer"),
        )


@router.delete("/{kb_id}/ontology/alignments")
async def kb_delete_alignment(
    kb_id: str,
    request: Request,
    id: str = Query(...),
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> Any:
    """
Kb Delete Alignment. Ontology workspace (SKOS, alignments) via Explorer. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
    """
    get_kb_for_editor(request, user, kb_id, store)
    from basis.domain.explorer.ontology_catalog import delete_alignment

    with KbOntologyState(request, kb_id):
        align_store = request.app.state.kb_ontology_alignments[kb_id]
        return await asyncio.to_thread(delete_alignment, align_store, id)


@router.post("/{kb_id}/ontology/suggest-alignments")
async def kb_suggest_alignments(
    kb_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> Any:
    """
Kb Suggest Alignments. Ontology workspace (SKOS, alignments) via Explorer. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
    """
    get_kb_for_viewer(request, user, kb_id, store)
    from basis.domain.explorer.ontology_catalog import suggest_alignments

    raw = await request.json()
    if not isinstance(raw, dict):
        raise AdminError(422, "validation_error", "请求体须为 JSON 对象")
    session = _session(request, kb_id)
    return await asyncio.to_thread(
        suggest_alignments,
        session,
        source_ontology_uri=raw.get("source_ontology_uri"),
        target_ontology_uri=raw.get("target_ontology_uri"),
        threshold=float(raw.get("threshold", 0.65)),
        limit=int(raw.get("limit", 25)),
    )


register_kb_ontology_hub_routes(router)
