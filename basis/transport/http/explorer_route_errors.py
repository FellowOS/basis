"""Map Explorer (semantica) HTTP errors to stable AdminError codes for Basis clients."""

from __future__ import annotations

from collections.abc import Awaitable
from typing import TypeVar

from fastapi import HTTPException

from basis.platform.admin.errors import AdminError

T = TypeVar("T")


def _explorer_error_message(detail: object) -> str:
    if isinstance(detail, str):
        return detail
    if isinstance(detail, dict):
        msg = detail.get("message")
        if isinstance(msg, str) and msg.strip():
            return msg
    return str(detail)


def admin_error_from_explorer_http(exc: HTTPException, *, context: str = "explorer") -> AdminError:
    """Normalize FastAPI HTTPException from semantica explorer handlers."""
    detail = exc.detail
    if isinstance(detail, dict) and detail.get("code"):
        code = str(detail["code"])
        message = _explorer_error_message(detail)
        return AdminError(exc.status_code, code, message or "Explorer 图接口错误")

    message = _explorer_error_message(detail)

    if context == "semantic_neighborhood":
        if exc.status_code == 404:
            return AdminError(404, "semantic_node_not_found", "语义距离接口未找到所选节点")
        if exc.status_code == 503:
            return AdminError(503, "semantic_unavailable", "当前图谱不支持语义相似度")

    if exc.status_code == 404:
        return AdminError(404, "not_found", message or "资源不存在")
    if exc.status_code == 422:
        return AdminError(422, "validation_error", message or "请求无效")
    if exc.status_code == 503:
        return AdminError(503, "explorer_unavailable", message or "Explorer 会话不可用")

    return AdminError(
        exc.status_code,
        "explorer_graph_error",
        message or "Explorer 图接口错误",
    )


async def invoke_explorer(coro: Awaitable[T], *, context: str = "explorer") -> T:
    """Await a semantica explorer handler and map HTTPException to AdminError."""
    try:
        return await coro
    except HTTPException as exc:
        raise admin_error_from_explorer_http(exc, context=context) from exc
