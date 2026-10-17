"""MCP tool inputSchema is derived from OpenAPI (R3)."""

from basis.core.mcp_openapi import MCP_TOOL_OPERATIONS, input_schema_for_tool
from basis.core.registry import TOOL_DEFINITIONS


def test_mcp_tools_have_openapi_backed_schemas() -> None:
    for name in MCP_TOOL_OPERATIONS:
        schema = input_schema_for_tool(name)
        assert schema is not None, name
        assert schema.get("type") == "object"


def test_search_chunks_schema_uses_query_alias() -> None:
    schema = input_schema_for_tool("search_chunks")
    assert schema is not None
    props = schema.get("properties") or {}
    assert "query" in props
    assert "q" not in props
    assert "query" in (schema.get("required") or [])


def test_tool_definitions_match_registry() -> None:
    by_name = {t["name"]: t for t in TOOL_DEFINITIONS}
    for name in MCP_TOOL_OPERATIONS:
        assert name in by_name
        assert by_name[name]["inputSchema"]["type"] == "object"
