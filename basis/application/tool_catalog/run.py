"""Dispatch a registered static tool by name."""

from __future__ import annotations

from typing import Any

from pydantic import ValidationError

from basis.application.kernel import WorkspaceCoreContext
from basis.application.tool_catalog.catalog import OPERATIONS
from basis.application.tool_catalog.validation import (
    coerce_operation_args,
    validation_error_payload,
    validate_operation_response,
)


def _mcp_exposed(name: str) -> bool:
    return OPERATIONS[name].get("mcp", True)


TOOL_NAMES: tuple[str, ...] = tuple(name for name in OPERATIONS if _mcp_exposed(name))


def run(ctx: WorkspaceCoreContext, name: str, arguments: dict[str, Any] | None) -> dict[str, Any]:
    """Run a registered static operation; returns a plain JSON-serializable dict."""
    spec = OPERATIONS.get(name)
    if spec is None:
        return {"error": f"unknown tool: {name}"}
    handler = spec["handler"]
    try:
        args = coerce_operation_args(name, arguments)
    except ValidationError as exc:
        return validation_error_payload(exc)
    result = handler(ctx, args)
    if isinstance(result, dict) and "error" not in result:
        return validate_operation_response(name, result)
    return result
