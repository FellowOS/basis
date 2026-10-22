"""OpenAPI extensions for MCP-exposed workspace HTTP operations."""

from __future__ import annotations

from typing import Any

MCP_TOOL_EXTENSION = "x-basis-mcp-tool"
MCP_PARAM_ALIASES_EXTENSION = "x-basis-mcp-param-aliases"


def mcp_tool_openapi(
    *names: str,
    param_aliases: dict[str, str] | None = None,
) -> dict[str, Any]:
    """FastAPI ``openapi_extra`` marking one or more static MCP tool names."""
    if not names:
        raise ValueError("mcp_tool_openapi requires at least one tool name")
    extra: dict[str, Any] = {
        MCP_TOOL_EXTENSION: names[0] if len(names) == 1 else list(names),
    }
    if param_aliases:
        if len(names) != 1:
            raise ValueError("param_aliases requires exactly one MCP tool name")
        extra[MCP_PARAM_ALIASES_EXTENSION] = {names[0]: dict(param_aliases)}
    return extra
