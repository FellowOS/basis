"""Re-export :mod:`basis.application.mcp` dispatch (stable import path)."""

from __future__ import annotations

from typing import Any

from basis.application.mcp import (
    TOOL_NAMES,
    execute,
    get_static_tool_definitions,
    get_tool_definitions,
    run,
)

__all__ = [
    "TOOL_DEFINITIONS",
    "TOOL_NAMES",
    "execute",
    "get_static_tool_definitions",
    "get_tool_definitions",
    "run",
]


def __getattr__(name: str) -> Any:
    if name == "TOOL_DEFINITIONS":
        return get_tool_definitions()
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
