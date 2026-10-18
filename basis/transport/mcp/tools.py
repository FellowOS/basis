"""MCP adapter — re-exports core operations and protocol metadata."""

from __future__ import annotations

from typing import Any

from basis.integration.context import KbCoreContext, KbToolContext
from basis.integration.registry import TOOL_NAMES, execute as call_tool, get_tool_definitions

SERVER_INFO = {"name": "basis-kb-mcp", "version": "0.1.0"}
CAPABILITIES = {"tools": {"listChanged": False}}
PROTOCOL_VERSION = "2024-11-05"

__all__ = [
    "CAPABILITIES",
    "KbCoreContext",
    "KbToolContext",
    "PROTOCOL_VERSION",
    "SERVER_INFO",
    "TOOL_DEFINITIONS",
    "TOOL_NAMES",
    "call_tool",
    "get_tool_definitions",
]


def __getattr__(name: str) -> Any:
    if name == "TOOL_DEFINITIONS":
        return get_tool_definitions()
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
