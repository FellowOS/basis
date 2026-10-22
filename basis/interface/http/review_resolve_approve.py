"""Workspace review approve route."""

from __future__ import annotations

import asyncio

from fastapi import APIRouter, Depends, HTTPException, Request

from basis.domain.errors import AdminError
from basis.domain.tenancy.admin.store import AdminStore, User
from basis.interface.http.deps import (
    graph_runtime_for,
    get_current_user,
    get_knowledge_store,
    get_store,
    save_graph,
)
from basis.interface.http.core_context import build_workspace_core_context
from basis.interface.http.graph_route_errors import admin_error_from_graph_http
from basis.domain.graph.governance.decision import maybe_emit_governance_tripped_on_review_approve
from basis.domain.knowledge.store import KnowledgeStore
from basis.application.errors import CoreError
from basis.application.operation_http import http_exception_from_core, http_response_from_payload
from basis.application.registry import run
from basis.interface.http.review_models import (
    ApproveReviewItemResponse,
    ResolveReviewRequest,
)

router = APIRouter(tags=["workspaces"])


@router.post("/{workspace_id}/review/items/{item_id}/approve")
async def approve_review_item(
    workspace_id: str,
    item_id: str,
    request: Request,
    body: ResolveReviewRequest,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> ApproveReviewItemResponse:
    """
Approve Review Item. Human review queue for merges, imports, and conflicts. Requires workspace membership (session) or workspace API token with read/write scope. All paths are scoped to `{workspace_id}`.
    """
    review_kind = knowledge.get_review_item(workspace_id, item_id).get("kind")
    ctx = build_workspace_core_context(
        request,
        workspace_id=workspace_id,
        user=user,
        store=store,
        require_editor=True,
    )
    args = {
        "item_id": item_id,
        "rationale": body.rationale,
        "keeper_statement_id": body.keeper_statement_id,
        "primary_id": body.primary_id,
    }
    try:
        payload = await asyncio.to_thread(run, ctx, "approve_review_item", args)
        return http_response_from_payload(payload)
    except CoreError as exc:
        http_exc = http_exception_from_core(exc)
        mapped = admin_error_from_graph_http(http_exc, context="enrich")
        maybe_emit_governance_tripped_on_review_approve(
            workspace_id,
            knowledge,
            code=mapped.code,
            message=mapped.message,
            detail={
                "item_id": item_id,
                "kind": review_kind,
                "source": "review_approve",
            },
            actor_id=user.id,
            runtime_loader=lambda: graph_runtime_for(request, workspace_id),
            persist_graph=lambda kid: save_graph(request, kid),
        )
        raise mapped
    except HTTPException as exc:
        mapped = admin_error_from_graph_http(exc, context="enrich")
        maybe_emit_governance_tripped_on_review_approve(
            workspace_id,
            knowledge,
            code=mapped.code,
            message=mapped.message,
            detail={
                "item_id": item_id,
                "kind": review_kind,
                "source": "review_approve",
            },
            actor_id=user.id,
            runtime_loader=lambda: graph_runtime_for(request, workspace_id),
            persist_graph=lambda kid: save_graph(request, kid),
        )
        raise mapped
    except AdminError as exc:
        maybe_emit_governance_tripped_on_review_approve(
            workspace_id,
            knowledge,
            code=exc.code,
            message=exc.message,
            detail={
                "item_id": item_id,
                "kind": review_kind,
                "source": "review_approve",
            },
            actor_id=user.id,
            runtime_loader=lambda: graph_runtime_for(request, workspace_id),
            persist_graph=lambda kid: save_graph(request, kid),
        )
        raise
