"""Guards for workspace-scoped graph session usage."""

from __future__ import annotations

from typing import Any

from basis.domain.errors import AdminError
from basis.domain.graph.session.registry import GraphRuntime


def require_graph_session(runtime: GraphRuntime) -> Any:
    if runtime.adapter is None:
        raise AdminError(503, "graph_session_unavailable", "Workspace graph session unavailable")
    return runtime.adapter
