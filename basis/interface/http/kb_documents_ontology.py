"""Legacy graph-session ontology create (``POST /{workspace_id}/ontology``)."""

from __future__ import annotations

import asyncio
from typing import Any

from fastapi import APIRouter, Depends, Request

from basis.domain.tenancy.admin.store import AdminStore, User
from basis.interface.http.deps import (
    kb_graph_runtime_for,
    get_current_user,
    get_store,
    graph_for,
    save_graph,
)
from basis.domain.ontology.hub.kb_scoped_state import KbOntologyState
from basis.domain.ontology.hub.create_write import create_ontology as create_ontology_domain
from basis.domain.graph.session.guard import require_kb_graph_session
from basis.domain.ontology.legacy_graph_create import LegacyGraphOntologyService
from basis.infra.runtime.capabilities import kb_graph_runtime_available
from basis.domain.knowledge.services.graph_audit import audit_kb_graph
from basis.interface.http.kb_documents_models import CreateOntologyRequest

router = APIRouter(tags=["knowledge-bases"])
_ontology = LegacyGraphOntologyService()


@router.post("/{workspace_id}/ontology")
async def create_ontology(
    workspace_id: str,
    body: CreateOntologyRequest,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> dict[str, Any]:
    """
Create Ontology. Ontology hub (SKOS, alignments) via Explorer. Requires workspace membership (session) or workspace API token with read/write scope. All paths are scoped to `{workspace_id}`.
    """
    store.get_workspace_for(user, workspace_id, "admin")
    if kb_graph_runtime_available():
        runtime = kb_graph_runtime_for(request, workspace_id)
        session = require_kb_graph_session(runtime)
        with KbOntologyState(request, workspace_id):
            registry = request.app.state.kb_ontology_registries[workspace_id]
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
            graph_for(request, workspace_id),
            namespace=body.namespace,
            name=body.name,
            description=body.description,
        )
    save_graph(request, workspace_id)
    audit_kb_graph(
        store,
        user,
        workspace_id,
        "kb.graph.ontology_create",
        extra={"uri": result["uri"], "name": body.name, "namespace": body.namespace},
    )
    return result
