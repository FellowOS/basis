"""Workspace integration core — shared by MCP, OpenAPI, and agent tools."""

from __future__ import annotations

from typing import Any

from basis.application.kernel import WorkspaceCoreContext, WorkspaceToolContext
from basis.application.mcp import TOOL_NAMES, execute, get_tool_definitions, run

__all__ = [
    "WorkspaceCoreContext",
    "WorkspaceToolContext",
    "TOOL_DEFINITIONS",
    "TOOL_NAMES",
    "execute",
    "get_tool_definitions",
    "run",
]


def __getattr__(name: str) -> Any:
    if name == "TOOL_DEFINITIONS":
        return get_tool_definitions()
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
