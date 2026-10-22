"""Operation registry (MCP tools/list schemas and dispatch)."""

from __future__ import annotations

from functools import lru_cache
from typing import Any

from pydantic import ValidationError

from basis.application.context import WorkspaceCoreContext
from basis.application.errors import CoreError
from basis.domain.errors import AdminError
from basis.interface.contract.mcp.format import mcp_text_result
from basis.application.models import (
    coerce_operation_args,
    validate_operation_response,
    validation_error_payload,
)
import basis.application.operations_connectors as conn_ops
from basis.application.operations_catalog import OPERATIONS, OperationHandler

def _mcp_exposed(name: str) -> bool:
    return OPERATIONS[name].get("mcp", True)


TOOL_NAMES: tuple[str, ...] = tuple(name for name in OPERATIONS if _mcp_exposed(name))

def _mcp_input_schema(name: str, fallback: dict[str, Any]) -> dict[str, Any]:
    from basis.interface.contract.mcp.openapi import input_schema_for_tool

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
        from basis.interface.contract.mcp.connector_tools import connector_tool_definitions_for_workspace

        tools.extend(connector_tool_definitions_for_workspace(ctx))
    return tools


def __getattr__(name: str) -> Any:
    if name == "TOOL_DEFINITIONS":
        return get_tool_definitions()
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


_MCP_TOOL_NAMES = frozenset(TOOL_NAMES)

_HANDLERS: dict[str, OperationHandler] = {
    name: spec["handler"] for name, spec in OPERATIONS.items()
}


def _resolve_mcp_tool_handler(name: str) -> OperationHandler | None:
    if name in _HANDLERS:
        return _HANDLERS[name]
    from basis.interface.contract.mcp.connector_tools import parse_connector_mcp_tool_name

    if parse_connector_mcp_tool_name(name) is not None:
        return conn_ops.op_invoke_connector_primitive
    return None


def _is_known_mcp_tool(name: str) -> bool:
    return _resolve_mcp_tool_handler(name) is not None


def run(ctx: WorkspaceCoreContext, name: str, arguments: dict[str, Any] | None) -> dict[str, Any]:
    """Run a registered operation; returns a plain JSON-serializable dict."""
    handler = _resolve_mcp_tool_handler(name)
    if handler is None:
        return {"error": f"unknown tool: {name}"}
    binding: dict[str, Any] | None = None
    if name not in _HANDLERS:
        from basis.interface.contract.mcp.connector_tools import parse_connector_mcp_tool_name

        binding = parse_connector_mcp_tool_name(name)
    try:
        args = coerce_operation_args(name, arguments)
    except ValidationError as exc:
        return validation_error_payload(exc)
    if binding:
        args = {**binding, **args}
    result = handler(ctx, args)
    if isinstance(result, dict) and "error" not in result:
        return validate_operation_response(name, result)
    return result


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
