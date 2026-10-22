"""Stamp MCP tool metadata onto exported OpenAPI operations."""

from __future__ import annotations

from collections import defaultdict
from typing import Any

from basis.interface.contract.mcp.tool_bindings import MCP_TOOL_BINDINGS

MCP_TOOL_EXTENSION = "x-basis-mcp-tool"
MCP_PARAM_ALIASES_EXTENSION = "x-basis-mcp-param-aliases"


def stamp_mcp_tools_on_paths(paths: dict[str, Any]) -> None:
    """Attach ``x-basis-mcp-tool`` (and optional param aliases) from :data:`MCP_TOOL_BINDINGS`."""
    by_route: dict[tuple[str, str], list] = defaultdict(list)
    for binding in MCP_TOOL_BINDINGS:
        by_route[(binding.method.lower(), binding.path)].append(binding)

    for (method, path), bindings in by_route.items():
        path_item = paths.get(path)
        if not isinstance(path_item, dict):
            continue
        op = path_item.get(method)
        if not isinstance(op, dict):
            continue
        names = [b.name for b in bindings]
        op[MCP_TOOL_EXTENSION] = names[0] if len(names) == 1 else names
        alias_map: dict[str, dict[str, str]] = {}
        for b in bindings:
            if b.param_aliases:
                alias_map[b.name] = dict(b.param_aliases)
        if alias_map:
            op[MCP_PARAM_ALIASES_EXTENSION] = alias_map
