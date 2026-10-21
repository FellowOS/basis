"""Guards for KB-scoped semantica Explorer GraphSession usage."""

from __future__ import annotations

from typing import Any

from basis.domain.errors import AdminError
from basis.domain.graph.explorer.session.registry import KbExplorerRuntime


def require_explorer_graph_session(runtime: KbExplorerRuntime) -> Any:
    if runtime.explorer is None:
        raise AdminError(503, "explorer_unavailable", "Explorer 会话不可用")
    return runtime.explorer
