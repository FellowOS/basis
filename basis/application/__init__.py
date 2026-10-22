"""Workspace integration core — shared by MCP, OpenAPI, and agent tools."""

from __future__ import annotations

from basis.application.kernel import WorkspaceCoreContext, WorkspaceToolContext
from basis.application.operation_registry import TOOL_NAMES, run

__all__ = [
    "WorkspaceCoreContext",
    "WorkspaceToolContext",
    "TOOL_NAMES",
    "run",
]
