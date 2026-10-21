"""Explorer graph session helper for KB ontology/vocabulary routes."""

from __future__ import annotations

from fastapi import Request

from basis.interface.http.deps import graph_workspace_runtime_for
from basis.domain.graph.session.guard import require_graph_workspace_session


def graph_workspace_session(request: Request, kb_id: str):
    runtime = graph_workspace_runtime_for(request, kb_id)
    return require_graph_workspace_session(runtime)
