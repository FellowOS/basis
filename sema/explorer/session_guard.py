"""Guards for KB-scoped Semantica Explorer GraphSession usage."""

from __future__ import annotations

from typing import Any

from sema.admin.errors import AdminError
from sema.capabilities import explorer_available
from sema.explorer.registry import KbExplorerRuntime


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
