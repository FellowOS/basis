"""BOCP connector routes — catalog and workspace policy."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query, Request

from basis.application.connectors import catalog, policy
from basis.application.kernel import CoreError
from basis.application.operation_http import http_exception_from_core
from basis.domain.tenancy.admin.store import AdminStore, User
from basis.interface.http.workspace.connectors.models import UpsertConnectorPolicyRequest
from basis.interface.http.core_context import build_workspace_core_context
from basis.interface.http.deps import get_current_user, get_store

router = APIRouter(tags=["workspaces"])


@router.get("/{workspace_id}/connectors/catalog")
async def list_connector_catalog(
    workspace_id: str,
    request: Request,
    category: str | None = Query(default=None),
    auth_mode: str | None = Query(default=None),
    has_streams_only: bool = Query(default=False),
    query: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=1500),
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> dict[str, Any]:
    """List BOCP connector manifests available in the platform catalog."""
    try:
        ctx = build_workspace_core_context(
            request, workspace_id=workspace_id, user=user, store=store
        )
        return catalog.list_catalog_detailed(
            ctx,
            category=category,
            auth_mode=auth_mode,
            has_streams_only=has_streams_only,
            query=query,
            limit=limit,
        )
    except CoreError as exc:
        raise http_exception_from_core(exc) from exc


@router.get("/{workspace_id}/connectors/catalog/{service}")
async def get_connector_manifest_route(
    workspace_id: str,
    service: str,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> dict[str, Any]:
    """Fetch one BOCP connector manifest by service key."""
    try:
        ctx = build_workspace_core_context(
            request, workspace_id=workspace_id, user=user, store=store
        )
        return catalog.get_manifest(ctx, service=service)
    except CoreError as exc:
        raise http_exception_from_core(exc) from exc


@router.get("/{workspace_id}/connectors/policy")
async def get_connector_policy(
    workspace_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> dict[str, Any]:
    """Get workspace-scoped connector allowlist and action governance policy."""
    try:
        ctx = build_workspace_core_context(
            request, workspace_id=workspace_id, user=user, store=store
        )
        return policy.get_policy(ctx)
    except CoreError as exc:
        raise http_exception_from_core(exc) from exc


@router.put("/{workspace_id}/connectors/policy")
async def put_connector_policy(
    workspace_id: str,
    body: UpsertConnectorPolicyRequest,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> dict[str, Any]:
    """Update workspace-scoped connector allowlist and action governance policy."""
    try:
        ctx = build_workspace_core_context(
            request,
            workspace_id=workspace_id,
            user=user,
            store=store,
            require_editor=True,
        )
        return policy.upsert_policy(
            ctx,
            allowed_providers=body.allowed_providers,
            action_policy=body.action_policy,
        )
    except CoreError as exc:
        raise http_exception_from_core(exc) from exc
