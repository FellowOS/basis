"""Workspace API token operation grants (MCP tool names + HTTP route aliases)."""

from __future__ import annotations

import fnmatch
import json
from typing import Any

from basis.domain.tenancy.admin.admin_types import ApiTokenRecord

# FastAPI route ``name`` → grant id (usually static MCP tool name).
HTTP_ROUTE_OPERATION_GRANTS: dict[str, str] = {
    "graph_neighbors_route": "neighbors",
    "graph_path_route": "paths",
    "graph_search_route": "graph_search",
    "find_entities": "find_entities",
}


def parse_allowed_operations_json(raw: str | None) -> frozenset[str] | None:
    """``None`` = unrestricted (legacy tokens). Empty JSON list = unrestricted."""
    if raw is None or not str(raw).strip():
        return None
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return None
    if not isinstance(data, list):
        return None
    cleaned = {str(item).strip() for item in data if str(item).strip()}
    if not cleaned:
        return None
    return frozenset(cleaned)


def token_allows_operation(record: ApiTokenRecord, operation: str) -> bool:
    allowed = record.allowed_operations
    if allowed is None:
        return True
    op = operation.strip()
    if not op:
        return False
    if op in allowed:
        return True
    for pattern in allowed:
        if "*" in pattern and fnmatch.fnmatchcase(op, pattern):
            return True
    return False


def http_operation_grant_for_route(route: Any) -> str | None:
    """Resolve grant id for a matched FastAPI route, or ``None`` if not gated."""
    name = getattr(route, "name", None)
    if not isinstance(name, str) or not name.strip():
        return None
    if name in ("mcp_integration_info", "mcp_jsonrpc"):
        return None
    return HTTP_ROUTE_OPERATION_GRANTS.get(name, name)


def assert_api_token_http_operation(request: Any, record: ApiTokenRecord) -> None:
    from fastapi import HTTPException

    if record.allowed_operations is None:
        return
    route = request.scope.get("route")
    if route is None:
        return
    grant = http_operation_grant_for_route(route)
    if grant is None:
        return
    if not token_allows_operation(record, grant):
        raise HTTPException(
            status_code=403,
            detail={
                "code": "forbidden",
                "message": f"令牌未授权操作：{grant}",
            },
        )
