"""Explorer graph session helper for KB ontology/vocabulary routes."""

from __future__ import annotations

from fastapi import Request

from basis.api.http.deps import explorer_runtime_for
from basis.core.explorer.session.guard import require_explorer_graph_session


def explorer_graph_session(request: Request, kb_id: str):
    runtime = explorer_runtime_for(request, kb_id)
    return require_explorer_graph_session(runtime)
