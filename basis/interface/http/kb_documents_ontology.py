"""Legacy graph-session ontology create (``POST /{kb_id}/ontology``)."""

from __future__ import annotations

import asyncio
from typing import Any

from fastapi import APIRouter, Depends, Request

from basis.domain.tenancy.admin.store import AdminStore, User
from basis.interface.http.deps import (
    graph_workspace_runtime_for,
    get_current_user,
    get_store,
    graph_for,
    save_graph,
)
from basis.domain.ontology.hub.kb_scoped_state import KbOntologyState
from basis.domain.ontology.hub.create_write import create_ontology as create_ontology_domain
from basis.domain.graph.session.guard import require_graph_workspace_session
from basis.domain.ontology.legacy_graph_create import LegacyGraphOntologyService
from basis.infra.runtime.capabilities import graph_workspace_available
from basis.domain.knowledge.services.graph_audit import audit_kb_graph
from basis.interface.http.kb_documents_models import CreateOntologyRequest

router = APIRouter(tags=["knowledge-bases"])
_ontology = LegacyGraphOntologyService()


@router.post("/{kb_id}/ontology")
async def create_ontology(
    kb_id: str,
    body: CreateOntologyRequest,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> dict[str, Any]:
    """
Create Ontology. Ontology workspace (SKOS, alignments) via Explorer. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
    """
    store.get_kb_for(user, kb_id, "admin")
    if graph_workspace_available():
        runtime = graph_workspace_runtime_for(request, kb_id)
        session = require_graph_workspace_session(runtime)
        with KbOntologyState(request, kb_id):
            registry = request.app.state.kb_ontology_registries[kb_id]
            result = await asyncio.to_thread(
                create_ontology_domain,
                session,
                registry,
                namespace=body.namespace,
                name=body.name,
                description=body.description,
                mode="scratch",
            )
    else:
        result = _ontology.create(
            graph_for(request, kb_id),
            namespace=body.namespace,
            name=body.name,
            description=body.description,
        )
    save_graph(request, kb_id)
    audit_kb_graph(
        store,
        user,
        kb_id,
        "kb.graph.ontology_create",
        extra={"uri": result["uri"], "name": body.name, "namespace": body.namespace},
    )
    return result
