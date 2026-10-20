"""Derive MCP tool inputSchema from live OpenAPI export (R3)."""

from __future__ import annotations

import weakref
from functools import lru_cache
from typing import Any

from basis.application.openapi_v1_export import cached_openapi_v1_kb

_SKIP_PARAMS = frozenset({"kb_id", "authorization"})

# MCP tool name → (HTTP method, OpenAPI path) in KB OpenAPI slice
MCP_TOOL_OPERATIONS: dict[str, tuple[str, str]] = {
    "describe_kb": ("get", "/api/v1/kbs/{kb_id}"),
    "search_chunks": ("get", "/api/v1/kbs/{kb_id}/search"),
    "get_chunk": ("get", "/api/v1/kbs/{kb_id}/ledger/chunks/{chunk_id}"),
    "find_entities": ("get", "/api/v1/kbs/{kb_id}/entities/find"),
    "neighbors": ("get", "/api/v1/kbs/{kb_id}/graph/nodes/{node_id}/neighbors"),
    "paths": ("get", "/api/v1/kbs/{kb_id}/graph/path"),
    "entity_facts": ("get", "/api/v1/kbs/{kb_id}/ledger/entities/{entity_id}/facts"),
    "propose_remember": ("post", "/api/v1/kbs/{kb_id}/remember/proposals"),
    "graph_search": ("post", "/api/v1/kbs/{kb_id}/graph/search"),
    "list_review_items": ("get", "/api/v1/kbs/{kb_id}/review/items"),
    "get_review_item": ("get", "/api/v1/kbs/{kb_id}/review/items/{item_id}"),
    "approve_statement_remember_review": (
        "post",
        "/api/v1/kbs/{kb_id}/review/items/{item_id}/approve",
    ),
    "reject_statement_remember_review": (
        "post",
        "/api/v1/kbs/{kb_id}/review/items/{item_id}/reject",
    ),
    "approve_review_item": (
        "post",
        "/api/v1/kbs/{kb_id}/review/items/{item_id}/approve",
    ),
    "reject_review_item": (
        "post",
        "/api/v1/kbs/{kb_id}/review/items/{item_id}/reject",
    ),
    "list_connector_catalog": ("get", "/api/v1/kbs/{kb_id}/connectors/catalog"),
    "describe_connector_service": (
        "get",
        "/api/v1/kbs/{kb_id}/connectors/catalog/{service}",
    ),
    "list_connector_connections": ("get", "/api/v1/kbs/{kb_id}/connectors/connections"),
    "list_connector_table_mappings": (
        "get",
        "/api/v1/kbs/{kb_id}/connectors/table-mappings",
    ),
    "sync_connector_table_mapping": (
        "post",
        "/api/v1/kbs/{kb_id}/connectors/table-mappings/{mapping_id}/sync",
    ),
    "propose_entity_writeback": ("post", "/api/v1/kbs/{kb_id}/connectors/outbox/propose"),
    "execute_connector_tool": ("post", "/api/v1/kbs/{kb_id}/connectors/tools/execute"),
}

# Back-compat alias for tests/docs
MCP_TOOL_OPERATION_IDS = MCP_TOOL_OPERATIONS

# OpenAPI query/path param name → MCP argument name
_PARAM_ALIASES: dict[str, dict[str, str]] = {
    "search_chunks": {"q": "query"},
    "find_entities": {"q": "query"},
}

_openapi_app_ref: weakref.ref | None = None


def bind_openapi_app(app: Any) -> None:
    """Called from `create_app` so MCP schemas match the running app's export."""
    global _openapi_app_ref
    _openapi_app_ref = weakref.ref(app)
    _kb_openapi_spec.cache_clear()


def _resolve_ref(components: dict[str, Any], node: Any) -> Any:
    if isinstance(node, dict) and "$ref" in node:
        ref = node["$ref"]
        if not ref.startswith("#/components/"):
            return node
        parts = ref.removeprefix("#/components/").split("/")
        cur: Any = components
        for part in parts:
            cur = cur[part]
        return _resolve_ref(components, cur)
    if isinstance(node, dict):
        return {k: _resolve_ref(components, v) for k, v in node.items()}
    if isinstance(node, list):
        return [_resolve_ref(components, item) for item in node]
    return node


def _schema_from_parameter(param: dict[str, Any]) -> dict[str, Any]:
    schema = param.get("schema") or {"type": "string"}
    if isinstance(schema, dict):
        out = dict(schema)
        if param.get("description") and "description" not in out:
            out["description"] = param["description"]
        return out
    return {"type": "string"}


def _operation_by_path(
    spec: dict[str, Any], path: str, method: str
) -> dict[str, Any] | None:
    path_item = (spec.get("paths") or {}).get(path)
    if not isinstance(path_item, dict):
        return None
    op = path_item.get(method.lower())
    return op if isinstance(op, dict) else None


def _merge_object_schemas(*schemas: dict[str, Any]) -> dict[str, Any]:
    properties: dict[str, Any] = {}
    required: list[str] = []
    for schema in schemas:
        if schema.get("type") != "object":
            continue
        properties.update(schema.get("properties") or {})
        for key in schema.get("required") or []:
            if key not in required:
                required.append(key)
    out: dict[str, Any] = {"type": "object", "properties": properties}
    if required:
        out["required"] = required
    return out


def _parameters_to_object_schema(
    parameters: list[Any],
    *,
    aliases: dict[str, str],
) -> dict[str, Any]:
    properties: dict[str, Any] = {}
    required: list[str] = []
    for raw in parameters:
        if not isinstance(raw, dict):
            continue
        where = raw.get("in")
        if where not in {"query", "path"}:
            continue
        name = str(raw.get("name") or "")
        if not name or name in _SKIP_PARAMS:
            continue
        arg_name = aliases.get(name, name)
        properties[arg_name] = _schema_from_parameter(raw)
        if raw.get("required"):
            required.append(arg_name)
    out: dict[str, Any] = {"type": "object", "properties": properties}
    if required:
        out["required"] = required
    return out


@lru_cache(maxsize=1)
def _kb_openapi_spec() -> dict[str, Any]:
    app = _openapi_app_ref() if _openapi_app_ref is not None else None
    if app is None:
        raise RuntimeError(
            "MCP OpenAPI schemas require bind_openapi_app(app) on the FastAPI app "
            "(tests: use bind_openapi_app from integration.openapi_spec._spec_app())."
        )
    return cached_openapi_v1_kb(app)


def input_schema_for_tool(tool_name: str) -> dict[str, Any] | None:
    route = MCP_TOOL_OPERATIONS.get(tool_name)
    if route is None:
        return None
    method, path = route
    spec = _kb_openapi_spec()
    op = _operation_by_path(spec, path, method)
    if op is None:
        return None
    components = spec.get("components") or {}
    aliases = _PARAM_ALIASES.get(tool_name, {})
    param_schema: dict[str, Any] = {"type": "object", "properties": {}}
    params = op.get("parameters")
    if isinstance(params, list):
        param_schema = _parameters_to_object_schema(params, aliases=aliases)

    body_schema: dict[str, Any] | None = None
    body = op.get("requestBody")
    if isinstance(body, dict):
        content = body.get("content") or {}
        app_json = content.get("application/json") or {}
        schema = app_json.get("schema")
        if isinstance(schema, dict):
            resolved = _resolve_ref(components, schema)
            if isinstance(resolved, dict):
                body_schema = resolved

    if body_schema is not None and param_schema.get("properties"):
        return _merge_object_schemas(param_schema, body_schema)
    if body_schema is not None:
        return body_schema
    if param_schema.get("properties"):
        return param_schema
    return {"type": "object", "properties": {}}


@lru_cache(maxsize=1)
def all_mcp_input_schemas() -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    for name in MCP_TOOL_OPERATIONS:
        schema = input_schema_for_tool(name)
        if schema:
            out[name] = schema
    return out
