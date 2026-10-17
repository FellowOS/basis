"""Derive MCP tool inputSchema from committed OpenAPI (R3)."""

from __future__ import annotations

from functools import lru_cache
from typing import Any

from basis.api.openapi_spec import openapi_v1_kb

_SKIP_PARAMS = frozenset({"kb_id", "authorization"})

# MCP tool name → (HTTP method, OpenAPI path) in basis-v1-kb.yaml
MCP_TOOL_OPERATIONS: dict[str, tuple[str, str]] = {
    "search_chunks": ("get", "/api/v1/kbs/{kb_id}/search"),
    "get_chunk": ("get", "/api/v1/kbs/{kb_id}/ledger/chunks/{chunk_id}"),
    "find_entities": ("get", "/api/v1/kbs/{kb_id}/entities/find"),
    "neighbors": ("get", "/api/v1/kbs/{kb_id}/graph/nodes/{node_id}/neighbors"),
    "paths": ("get", "/api/v1/kbs/{kb_id}/graph/path"),
    "entity_facts": ("get", "/api/v1/kbs/{kb_id}/ledger/entities/{entity_id}/facts"),
    "propose_remember": ("post", "/api/v1/kbs/{kb_id}/chat/remember"),
}

# Back-compat alias for tests/docs
MCP_TOOL_OPERATION_IDS = MCP_TOOL_OPERATIONS

# OpenAPI query/path param name → MCP argument name
_PARAM_ALIASES: dict[str, dict[str, str]] = {
    "search_chunks": {"q": "query"},
    "find_entities": {"q": "query"},
}


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
        name = raw.get("name")
        if not name or name in _SKIP_PARAMS:
            continue
        if where not in ("query", "path"):
            continue
        arg_name = aliases.get(name, name)
        properties[arg_name] = _schema_from_parameter(raw)
        if raw.get("required"):
            required.append(arg_name)
    schema: dict[str, Any] = {"type": "object", "properties": properties}
    if required:
        schema["required"] = required
    return schema


def input_schema_for_tool(tool_name: str) -> dict[str, Any] | None:
    """Build MCP JSON Schema for a tool from OpenAPI, or None if unmapped."""
    route = MCP_TOOL_OPERATIONS.get(tool_name)
    if not route:
        return None
    method, path = route
    spec = openapi_v1_kb()
    op = _operation_by_path(spec, path, method)
    if op is None:
        return None
    components = spec.get("components") or {}
    aliases = _PARAM_ALIASES.get(tool_name, {})
    body = op.get("requestBody")
    if isinstance(body, dict):
        content = body.get("content") or {}
        app_json = content.get("application/json") or {}
        schema = app_json.get("schema")
        if isinstance(schema, dict):
            resolved = _resolve_ref(components, schema)
            if isinstance(resolved, dict):
                return resolved
    params = op.get("parameters")
    if isinstance(params, list):
        return _parameters_to_object_schema(params, aliases=aliases)
    return {"type": "object", "properties": {}}


@lru_cache(maxsize=1)
def all_mcp_input_schemas() -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    for name in MCP_TOOL_OPERATIONS:
        schema = input_schema_for_tool(name)
        if schema:
            out[name] = schema
    return out
