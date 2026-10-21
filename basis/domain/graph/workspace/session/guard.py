"""Guards for KB-scoped graph workspace session usage."""

from __future__ import annotations

from typing import Any

from basis.domain.errors import AdminError
from basis.domain.graph.workspace.session.registry import KbGraphWorkspaceRuntime


def require_graph_workspace_session(runtime: KbGraphWorkspaceRuntime) -> Any:
    if runtime.adapter is None:
        raise AdminError(503, "graph_workspace_unavailable", "Graph workspace session unavailable")
    return runtime.adapter
