"""Explorer graph session helper for KB ontology/vocabulary routes."""

from __future__ import annotations

from fastapi import Request

from basis.interface.http.deps import kb_graph_runtime_for
from basis.domain.graph.session.guard import require_kb_graph_session


def kb_graph_session(request: Request, kb_id: str):
    runtime = kb_graph_runtime_for(request, kb_id)
    return require_kb_graph_session(runtime)
