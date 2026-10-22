"""Derive MCP tool inputSchema from live OpenAPI export (R3)."""

from __future__ import annotations

import weakref
from collections.abc import Mapping
from functools import lru_cache
from typing import Any

from basis.interface.contract.mcp.stamp_openapi import (
    MCP_PARAM_ALIASES_EXTENSION,
    MCP_TOOL_EXTENSION,
)
from basis.interface.contract.mcp.tool_bindings import MCP_TOOL_BINDINGS
from basis.interface.contract.openapi.v1_export import cached_openapi_v1_workspaces

_SKIP_PARAMS = frozenset({"workspace_id", "authorization"})

_openapi_app_ref: weakref.ref | None = None


class _McpToolOperationsView(Mapping[str, tuple[str, str]]):
    """Lazy view of tool name → (method, path) from stamped workspace OpenAPI."""

    def __getitem__(self, key: str) -> tuple[str, str]:
        return mcp_tool_operations()[key]

    def __iter__(self):
        return iter(mcp_tool_operations())

    def __len__(self) -> int:
        return len(mcp_tool_operations())

    def get(self, key: str, default: Any = None) -> Any:
        return mcp_tool_operations().get(key, default)


MCP_TOOL_OPERATIONS: Mapping[str, tuple[str, str]] = _McpToolOperationsView()
MCP_TOOL_OPERATION_IDS = MCP_TOOL_OPERATIONS


def bind_openapi_app(app: Any) -> None:
    """Called from `create_app` so MCP schemas match the running app's export."""
    global _openapi_app_ref
    _openapi_app_ref = weakref.ref(app)
    _workspaces_openapi_spec.cache_clear()
    mcp_tool_operations.cache_clear()
    all_mcp_input_schemas.cache_clear()


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
def _workspaces_openapi_spec() -> dict[str, Any]:
    app = _openapi_app_ref() if _openapi_app_ref is not None else None
    if app is None:
        raise RuntimeError(
            "MCP OpenAPI schemas require bind_openapi_app(app) on the FastAPI app "
            "(tests: bind_openapi_app via basis.interface.contract.openapi.spec._spec_app())."
        )
    return cached_openapi_v1_workspaces(app)


@lru_cache(maxsize=1)
def mcp_tool_operations() -> dict[str, tuple[str, str]]:
    """Build tool → (method, path) from ``x-basis-mcp-tool`` on workspace OpenAPI."""
    spec = _workspaces_openapi_spec()
    out: dict[str, tuple[str, str]] = {}
    for path, path_item in (spec.get("paths") or {}).items():
        if not isinstance(path_item, dict):
            continue
        for method, op in path_item.items():
            if method.startswith("x-") or not isinstance(op, dict):
                continue
            raw_tools = op.get(MCP_TOOL_EXTENSION)
            if not raw_tools:
                continue
            names = raw_tools if isinstance(raw_tools, list) else [raw_tools]
            for name in names:
                out[str(name)] = (method.lower(), path)
    return out


def _param_aliases_for_tool(tool_name: str, op: dict[str, Any]) -> dict[str, str]:
    raw = op.get(MCP_PARAM_ALIASES_EXTENSION)
    if isinstance(raw, dict) and tool_name in raw and isinstance(raw[tool_name], dict):
        return {str(k): str(v) for k, v in raw[tool_name].items()}
    return {}


def _openapi_operation_for_tool(tool_name: str) -> dict[str, Any] | None:
    route = mcp_tool_operations().get(tool_name)
    if route is None:
        return None
    method, path = route
    spec = _workspaces_openapi_spec()
    return _operation_by_path(spec, path, method)


def description_for_tool(tool_name: str) -> str | None:
    op = _openapi_operation_for_tool(tool_name)
    if op is None:
        return None
    text = str(op.get("description") or op.get("summary") or "").strip()
    return text or None


def input_schema_for_tool(tool_name: str) -> dict[str, Any] | None:
    op = _openapi_operation_for_tool(tool_name)
    if op is None:
        return None
    spec = _workspaces_openapi_spec()
    components = spec.get("components") or {}
    aliases = _param_aliases_for_tool(tool_name, op)
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
    for name in mcp_tool_operations():
        schema = input_schema_for_tool(name)
        if schema:
            out[name] = schema
    return out


def binding_tool_names() -> frozenset[str]:
    """Static binding table tool names (for catalog alignment tests)."""
    return frozenset(b.name for b in MCP_TOOL_BINDINGS)
