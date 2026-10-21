"""Map graph workspace HTTP errors to stable AdminError codes for Basis clients."""

from __future__ import annotations

from fastapi import HTTPException

from basis.domain.ontology.io.admin_errors import admin_error_from_http_status


def admin_error_from_graph_workspace_http(
    exc: HTTPException, *, context: str = "graph_workspace"
):
    return admin_error_from_http_status(exc.status_code, exc.detail, context=context)


__all__ = ["admin_error_from_graph_workspace_http"]
