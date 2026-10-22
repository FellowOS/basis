"""MCP tool inputSchema is derived from OpenAPI (R3)."""

from basis.interface.contract.mcp.openapi import MCP_TOOL_OPERATIONS, input_schema_for_tool
from basis.application.registry import TOOL_DEFINITIONS


def test_mcp_tools_have_openapi_backed_schemas() -> None:
    for name in MCP_TOOL_OPERATIONS:
        schema = input_schema_for_tool(name)
        assert schema is not None, name
        assert schema.get("type") == "object"


def test_describe_workspace_schema_from_get_workspace_route() -> None:
    schema = input_schema_for_tool("describe_workspace")
    assert schema is not None
    assert schema.get("type") == "object"
    assert not (schema.get("properties") or {})


def test_search_chunks_schema_uses_query_alias() -> None:
    schema = input_schema_for_tool("search_chunks")
    assert schema is not None
    props = schema.get("properties") or {}
    assert "query" in props
    assert "q" not in props
    assert "query" in (schema.get("required") or [])


def test_approve_remember_review_schema_merges_path_and_body() -> None:
    schema = input_schema_for_tool("approve_statement_remember_review")
    assert schema is not None
    props = schema.get("properties") or {}
    assert "item_id" in props
    assert "rationale" in props
    assert "item_id" in (schema.get("required") or [])


def test_reject_remember_review_schema_merges_path_and_body() -> None:
    schema = input_schema_for_tool("reject_statement_remember_review")
    assert schema is not None
    props = schema.get("properties") or {}
    assert "item_id" in props
    assert "item_id" in (schema.get("required") or [])


def test_approve_review_openapi_response_includes_decision_id() -> None:
    from basis.interface.contract.openapi.spec import _spec_app
    from basis.interface.contract.openapi.v1_export import export_openapi_v1_workspaces

    spec = export_openapi_v1_workspaces(_spec_app())
    op = spec["paths"]["/api/v1/workspaces/{workspace_id}/review/items/{item_id}/approve"]["post"]
    schema = op["responses"]["200"]["content"]["application/json"]["schema"]
    components = spec.get("components") or {}
    if "$ref" in schema:
        name = schema["$ref"].split("/")[-1]
        schema = components["schemas"][name]
    props = schema.get("properties") or {}
    assert "item" in props
    assert "decision_id" in props


def test_tool_definitions_match_registry() -> None:
    by_name = {t["name"]: t for t in TOOL_DEFINITIONS}
    for name in MCP_TOOL_OPERATIONS:
        assert name in by_name
        assert by_name[name]["inputSchema"]["type"] == "object"
