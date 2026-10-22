"""Workspace review reject route."""

from __future__ import annotations

import asyncio
from typing import Any

from fastapi import APIRouter, Depends, Request

from basis.domain.tenancy.admin.store import AdminStore, User
from basis.interface.http.deps import get_current_user, get_store
from basis.interface.http.core_context import build_workspace_core_context
from basis.interface.http.operation_http import http_response_from_payload
from basis.application.review.operations import op_reject_review_item
from basis.interface.contract.mcp.annotations import mcp_tool_openapi
from basis.interface.http.review_models import ResolveReviewRequest

router = APIRouter(tags=["workspaces"])


@router.post(
    "/{workspace_id}/review/items/{item_id}/reject",
    openapi_extra=mcp_tool_openapi(
        "reject_review_item",
        "reject_statement_remember_review",
    ),
)
async def reject_review_item(
    workspace_id: str,
    item_id: str,
    request: Request,
    body: ResolveReviewRequest,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> dict[str, Any]:
    """
Reject Review Item. Human review queue for merges, imports, and conflicts. Requires workspace membership (session) or workspace API token with read/write scope. All paths are scoped to `{workspace_id}`.
    """
    ctx = build_workspace_core_context(
        request,
        workspace_id=workspace_id,
        user=user,
        store=store,
        require_editor=True,
    )
    payload = await asyncio.to_thread(
        op_reject_review_item,
        ctx,
        {"item_id": item_id, "rationale": body.rationale},
    )
    return http_response_from_payload(payload)
