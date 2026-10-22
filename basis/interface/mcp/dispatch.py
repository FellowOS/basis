"""MCP tools/list and tools/call dispatch (wraps :mod:`basis.application.operation_registry`)."""

from __future__ import annotations

from functools import lru_cache
from typing import Any

from pydantic import ValidationError

from basis.application.kernel import CoreError, WorkspaceCoreContext
from basis.application.operation_registry import (
    OPERATIONS,
    TOOL_NAMES,
    coerce_operation_args,
    op_invoke_connector_primitive,
    validation_error_payload,
    validate_operation_response,
)
from basis.application.operation_registry import run as run_static_operation
from basis.domain.errors import AdminError
from basis.interface.contract.mcp.connector_tools import (
    connector_tool_definitions_for_workspace,
    parse_connector_mcp_tool_name,
)
from basis.interface.contract.mcp.format import mcp_text_result
from basis.interface.contract.mcp.openapi import input_schema_for_tool

__all__ = [
    "TOOL_DEFINITIONS",
    "TOOL_NAMES",
    "execute",
    "get_static_tool_definitions",
    "get_tool_definitions",
    "run",
]


def _mcp_exposed(name: str) -> bool:
    return OPERATIONS[name].get("mcp", True)


def _mcp_input_schema(name: str, fallback: dict[str, Any]) -> dict[str, Any]:
    derived = input_schema_for_tool(name)
    return derived if derived else fallback


@lru_cache(maxsize=1)
def get_static_tool_definitions() -> list[dict[str, Any]]:
    return [
        {
            "name": name,
            "description": spec["description"],
            "inputSchema": _mcp_input_schema(name, spec["input_schema"]),
        }
        for name, spec in OPERATIONS.items()
        if _mcp_exposed(name)
    ]


def get_tool_definitions(ctx: WorkspaceCoreContext | None = None) -> list[dict[str, Any]]:
    """MCP tools/list payload; includes manifest-derived connector tools when ``ctx`` is set."""
    tools = list(get_static_tool_definitions())
    if ctx is not None:
        tools.extend(connector_tool_definitions_for_workspace(ctx))
    return tools


def __getattr__(name: str) -> Any:
    if name == "TOOL_DEFINITIONS":
        return get_tool_definitions()
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


def _is_known_mcp_tool(name: str) -> bool:
    if name in OPERATIONS:
        return True
    return parse_connector_mcp_tool_name(name) is not None


def run(ctx: WorkspaceCoreContext, name: str, arguments: dict[str, Any] | None) -> dict[str, Any]:
    """Run a static or manifest-derived connector MCP tool; plain JSON dict."""
    binding = parse_connector_mcp_tool_name(name)
    if binding is not None:
        try:
            args = coerce_operation_args(name, arguments)
        except ValidationError as exc:
            return validation_error_payload(exc)
        args = {**binding, **args}
        result = op_invoke_connector_primitive(ctx, args)
        if isinstance(result, dict) and "error" not in result:
            return validate_operation_response(name, result)
        return result
    return run_static_operation(ctx, name, arguments)


def execute(ctx: WorkspaceCoreContext, name: str, arguments: dict[str, Any] | None) -> dict[str, Any]:
    """MCP tools/call envelope."""
    if not _is_known_mcp_tool(name):
        return mcp_text_result({"error": f"unknown tool: {name}"}, is_error=True)
    try:
        payload = run(ctx, name, arguments)
    except CoreError as exc:
        return mcp_text_result(exc.detail, is_error=True)
    except AdminError as exc:
        return mcp_text_result({"code": exc.code, "message": exc.message}, is_error=True)
    return mcp_text_result(payload)
