"""Map Explorer (semantica) HTTP errors to stable AdminError codes for Sema clients."""

from __future__ import annotations

from fastapi import HTTPException

from sema.admin.errors import AdminError


def admin_error_from_explorer_http(exc: HTTPException, *, context: str = "explorer") -> AdminError:
    """Normalize FastAPI HTTPException from semantica explorer handlers."""
    detail = exc.detail
    message = detail if isinstance(detail, str) else str(detail)

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
