"""Request-scoped correlation IDs (usable outside the HTTP layer)."""

from __future__ import annotations

import contextvars
import uuid

_request_id_ctx: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "request_id",
    default=None,
)


def new_request_id() -> str:
    return uuid.uuid4().hex


def current_request_id() -> str | None:
    return _request_id_ctx.get()


def set_request_id(request_id: str) -> contextvars.Token[str | None]:
    return _request_id_ctx.set(request_id.strip())


def reset_request_id(token: contextvars.Token[str | None]) -> None:
    _request_id_ctx.reset(token)
