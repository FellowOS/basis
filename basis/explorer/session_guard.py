"""Guards for KB-scoped semantica Explorer GraphSession usage."""

from __future__ import annotations

from typing import Any

from basis.admin.errors import AdminError
from basis.capabilities import explorer_available
from basis.explorer.registry import KbExplorerRuntime


def require_explorer_graph_session(runtime: KbExplorerRuntime) -> Any:
    if not explorer_available():
        raise AdminError(
            503,
            "explorer_unavailable",
            "Explorer 未安装，请执行 uv sync --extra explorer",
        )
    if runtime.explorer is None:
        raise AdminError(503, "explorer_unavailable", "Explorer 会话不可用")
    return runtime.explorer
