"""Per-request correlation IDs (X-02)."""

from __future__ import annotations

import contextvars
import logging
import uuid
from typing import Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

REQUEST_ID_HEADER = "X-Request-ID"

_request_id_ctx: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "request_id",
    default=None,
)


def new_request_id() -> str:
    return uuid.uuid4().hex


def get_request_id(request: Request) -> str | None:
    rid = getattr(request.state, "request_id", None)
    if isinstance(rid, str) and rid.strip():
        return rid.strip()
    return None


def current_request_id() -> str | None:
    return _request_id_ctx.get()


def attach_request_id_to_detail(request: Request, detail: dict[str, object]) -> dict[str, object]:
    rid = get_request_id(request)
    if rid:
        return {**detail, "request_id": rid}
    return detail


class RequestIdLogFilter(logging.Filter):
    """Adds request_id to log records when inside a request context."""

    def filter(self, record: logging.LogRecord) -> bool:
        rid = _request_id_ctx.get()
        if rid:
            record.request_id = rid  # type: ignore[attr-defined]
        return True


class RequestIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        incoming = request.headers.get(REQUEST_ID_HEADER)
        request_id = incoming.strip() if incoming and incoming.strip() else new_request_id()
        request.state.request_id = request_id
        token = _request_id_ctx.set(request_id)
        try:
            response = await call_next(request)
        finally:
            _request_id_ctx.reset(token)
        response.headers[REQUEST_ID_HEADER] = request_id
        return response


def install_request_id_logging() -> None:
    filt = RequestIdLogFilter()
    root = logging.getLogger("sema")
    if not any(isinstance(f, RequestIdLogFilter) for f in root.filters):
        root.addFilter(filt)
