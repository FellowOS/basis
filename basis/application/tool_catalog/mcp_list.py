"""MCP tools/list metadata (description + inputSchema); independent of HTTP OpenAPI."""

from __future__ import annotations

from typing import Any

from basis.application.tool_catalog.catalog import OPERATIONS
from basis.application.tool_catalog.mcp_metadata import MCP_TOOL_METADATA

__all__ = ["description_for_tool", "input_schema_for_tool"]


def _assert_metadata_aligned() -> None:
    catalog = set(OPERATIONS)
    meta = set(MCP_TOOL_METADATA)
    if catalog != meta:
        missing = catalog - meta
        extra = meta - catalog
        raise RuntimeError(
            "MCP_TOOL_METADATA keys must match OPERATIONS: "
            f"missing={sorted(missing)!r} extra={sorted(extra)!r}"
        )


_assert_metadata_aligned()


def description_for_tool(tool_name: str) -> str | None:
    meta = MCP_TOOL_METADATA.get(tool_name)
    if not meta:
        return None
    spec = OPERATIONS.get(tool_name) or {}
    text = meta.get("description") or spec.get("description")
    if isinstance(text, str) and text.strip():
        return text.strip()
    return None


def input_schema_for_tool(tool_name: str) -> dict[str, Any] | None:
    meta = MCP_TOOL_METADATA.get(tool_name)
    if not meta:
        return None
    spec = OPERATIONS.get(tool_name) or {}
    schema = meta.get("input_schema") or spec.get("input_schema")
    if isinstance(schema, dict):
        return schema
    return {"type": "object", "properties": {}}
