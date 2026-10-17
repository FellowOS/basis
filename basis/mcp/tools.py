"""MCP adapter — re-exports core operations and protocol metadata."""

from __future__ import annotations

from basis.core.context import KbCoreContext, KbToolContext
from basis.core.registry import TOOL_DEFINITIONS, TOOL_NAMES, execute as call_tool

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
]
