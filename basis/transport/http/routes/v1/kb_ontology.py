"""KB-scoped vocabulary and ontology-hub (alignments) adapters."""

from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Depends, File, Form, Query, Request, UploadFile

from basis.platform.admin.store import AdminStore, User
from basis.transport.http.deps import get_current_user, get_explorer_registry, get_store, save_graph, get_kb_for_viewer, get_kb_for_editor
from basis.transport.http.explorer_route_errors import invoke_explorer
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
    from semantica.explorer.routes.vocabulary import list_schemes

    session = _session(request, kb_id)
    return await invoke_explorer(list_schemes(session=session), context="vocabulary")


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
    from semantica.explorer.routes.vocabulary import list_concepts

    session = _session(request, kb_id)
    return await invoke_explorer(
        list_concepts(scheme=scheme, search=search, session=session),
        context="vocabulary",
    )


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
    from semantica.explorer.routes.vocabulary import get_hierarchy

    session = _session(request, kb_id)
    return await invoke_explorer(get_hierarchy(scheme=scheme, session=session), context="vocabulary")


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
    from semantica.explorer.routes.vocabulary import import_vocabulary

    session = _session(request, kb_id)
    result = await invoke_explorer(
        import_vocabulary(file=file, text=text, format=format, session=session),
        context="vocabulary",
    )
    save_graph(request, kb_id)
    summary = result.model_dump() if hasattr(result, "model_dump") else dict(result)
    audit_kb_graph(store, user, kb_id, "kb.graph.vocabulary_import", extra=summary)
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
    from semantica.explorer.routes.ontology import list_registry

    session = _session(request, kb_id)
    with KbOntologyState(request, kb_id):
        return await invoke_explorer(
            list_registry(request, q=q, status=status, format=format, session=session),
            context="ontology",
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
                if item.source_uri.startswith(uri) or item.target_uri.startswith(uri)
            ]
        return sorted(
            alignments,
            key=lambda item: (item.source_label, item.target_label, item.relation),
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
    from semantica.explorer.routes.ontology import upsert_alignment
    from semantica.explorer.routes.ontology import OntologyAlignmentRequest

    raw = await request.json()
    body = OntologyAlignmentRequest.model_validate(raw)
    session = _session(request, kb_id)
    with KbOntologyState(request, kb_id):
        return await invoke_explorer(
            upsert_alignment(request, body=body, session=session),
            context="ontology",
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
    from semantica.explorer.routes.ontology import delete_alignment

    with KbOntologyState(request, kb_id):
        return await invoke_explorer(delete_alignment(request, id=id), context="ontology")


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
    from semantica.explorer.routes.ontology import suggest_alignments
    from semantica.explorer.routes.ontology import AlignmentSuggestionRequest

    raw = await request.json()
    body = AlignmentSuggestionRequest.model_validate(raw)
    session = _session(request, kb_id)
    return await invoke_explorer(suggest_alignments(body=body, session=session), context="ontology")


register_kb_ontology_hub_routes(router)
