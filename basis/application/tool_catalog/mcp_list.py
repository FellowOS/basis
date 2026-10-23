"""MCP tools/list metadata (description + inputSchema); independent of HTTP OpenAPI."""

from __future__ import annotations

from typing import Any

from basis.application.tool_catalog.catalog import OPERATIONS
from basis.application.tool_catalog.mcp_metadata import MCP_TOOL_METADATA
from basis.application.tool_catalog.validation import OPERATION_INPUT_MODELS

__all__ = ["description_for_tool", "input_schema_for_tool"]


def _assert_catalog_aligned() -> None:
    catalog = set(OPERATIONS)
    meta = set(MCP_TOOL_METADATA)
    models = set(OPERATION_INPUT_MODELS)
    if catalog != meta:
        missing = catalog - meta
        extra = meta - catalog
        raise RuntimeError(
            "MCP_TOOL_METADATA keys must match OPERATIONS: "
            f"missing={sorted(missing)!r} extra={sorted(extra)!r}"
        )
    if catalog != models:
        missing = catalog - models
        extra = models - catalog
        raise RuntimeError(
            "OPERATION_INPUT_MODELS keys must match OPERATIONS: "
            f"missing={sorted(missing)!r} extra={sorted(extra)!r}"
        )


_assert_catalog_aligned()


def description_for_tool(tool_name: str) -> str:
    meta = MCP_TOOL_METADATA.get(tool_name)
    if not meta:
        return tool_name
    text = meta.get("description")
    if isinstance(text, str) and text.strip():
        return text.strip()
    return tool_name


def input_schema_for_tool(tool_name: str) -> dict[str, Any]:
    model = OPERATION_INPUT_MODELS[tool_name]
    return model.model_json_schema(mode="serialization")
