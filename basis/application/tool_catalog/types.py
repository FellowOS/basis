"""Types for the static workspace tool catalog."""

from __future__ import annotations

from typing import Any, Callable, NotRequired, TypedDict

from basis.application.kernel import WorkspaceCoreContext

OperationHandler = Callable[[WorkspaceCoreContext, dict[str, Any]], dict[str, Any]]


class OperationSpec(TypedDict):
    handler: OperationHandler
    mcp: NotRequired[bool]
