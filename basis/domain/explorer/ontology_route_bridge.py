"""Single allowlisted import site for semantica.explorer.routes.ontology (line 1 hub)."""

from __future__ import annotations

from collections.abc import Awaitable
from typing import Any, TypeVar

from basis.transport.http.explorer_route_errors import invoke_explorer

T = TypeVar("T")

_ontology_mod: Any = None


def ontology_module() -> Any:
    """Return the semantica Explorer ontology route module (lazy)."""
    global _ontology_mod
    if _ontology_mod is None:
        from semantica.explorer.routes import ontology as ont

        _ontology_mod = ont
    return _ontology_mod


async def invoke_ontology(coro: Awaitable[T], *, context: str = "ontology") -> T:
    return await invoke_explorer(coro, context=context)
