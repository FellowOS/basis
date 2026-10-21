"""Guards for workspace-scoped graph session usage."""

from __future__ import annotations

from typing import Any

from basis.domain.errors import AdminError
from basis.domain.graph.session.registry import KbGraphRuntime


def require_kb_graph_session(runtime: KbGraphRuntime) -> Any:
    if runtime.adapter is None:
        raise AdminError(503, "kb_graph_session_unavailable", "Workspace graph session unavailable")
    return runtime.adapter
