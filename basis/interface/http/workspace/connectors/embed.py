"""BOCP embed routes under ``/workspaces/{id}/connectors/embed/*`` (end_user clients)."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query, Request

from basis.application.connectors import catalog, connections, oauth
from basis.domain.connector.connection_scope import SCOPE_END_USER
from basis.application.kernel import CoreError
from basis.interface.http.shared.operation_http import http_exception_from_core
from basis.domain.tenancy.admin.store import AdminStore, User
from basis.interface.http.workspace.connectors.models import (
    EmbedOAuthAuthorizeRequest,
    EmbedUpsertConnectionRequest,
    ExchangeOAuthCodeRequest,
)
from basis.interface.http.shared.core_context import build_workspace_core_context
from basis.interface.http.shared.deps import get_current_user, get_store

router = APIRouter(tags=["workspaces"])


@router.get("/{workspace_id}/connectors/embed/providers")
async def embed_list_providers(
    workspace_id: str,
    request: Request,
    has_streams_only: bool = Query(default=False),
    limit: int = Query(default=100, ge=1, le=500),
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> dict[str, Any]:
    """List connector manifests for embed clients (includes auth[] definitions)."""
    try:
        ctx = build_workspace_core_context(
            request, workspace_id=workspace_id, user=user, store=store
        )
        return catalog.list_embed_providers(
            ctx, has_streams_only=has_streams_only, limit=limit
        )
    except CoreError as exc:
        raise http_exception_from_core(exc) from exc


@router.get("/{workspace_id}/connectors/embed/connections")
async def embed_list_connections(
    workspace_id: str,
    request: Request,
    subject_id: str = Query(..., min_length=1),
    service: str | None = Query(default=None),
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> dict[str, Any]:
    """List end_user connections for one embed subject (credentials redacted)."""
    try:
        ctx = build_workspace_core_context(
            request, workspace_id=workspace_id, user=user, store=store
        )
        return connections.list_connections_public(
            ctx,
            service=service,
            connection_scope=SCOPE_END_USER,
            subject_id=subject_id.strip(),
        )
    except CoreError as exc:
        raise http_exception_from_core(exc) from exc


@router.put("/{workspace_id}/connectors/embed/connections/{service}")
async def embed_upsert_connection(
    workspace_id: str,
    service: str,
    body: EmbedUpsertConnectionRequest,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> dict[str, Any]:
    """Create or update an end_user connection for an embed subject."""
    try:
        ctx = build_workspace_core_context(
            request,
            workspace_id=workspace_id,
            user=user,
            store=store,
            require_editor=True,
        )
        return connections.upsert_embed_connection(
            ctx,
            service=service,
            subject_id=body.subject_id,
            auth_type=body.auth_type,
            connection_config=body.connection_config,
            credentials=body.credentials,
        )
    except CoreError as exc:
        raise http_exception_from_core(exc) from exc


@router.delete("/{workspace_id}/connectors/embed/connections/{service}")
async def embed_delete_connection(
    workspace_id: str,
    service: str,
    request: Request,
    subject_id: str = Query(..., min_length=1),
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> dict[str, Any]:
    """Delete an end_user connection for one embed subject."""
    try:
        ctx = build_workspace_core_context(
            request,
            workspace_id=workspace_id,
            user=user,
            store=store,
            require_editor=True,
        )
        return connections.delete_embed_connection(
            ctx, service=service, subject_id=subject_id
        )
    except CoreError as exc:
        raise http_exception_from_core(exc) from exc


@router.post("/{workspace_id}/connectors/embed/connections/{service}/check")
async def embed_check_connection(
    workspace_id: str,
    service: str,
    request: Request,
    subject_id: str = Query(..., min_length=1),
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> dict[str, Any]:
    """Run BOCP CHECK for an end_user connection."""
    try:
        ctx = build_workspace_core_context(
            request,
            workspace_id=workspace_id,
            user=user,
            store=store,
            require_editor=True,
        )
        return connections.check_embed_connection(
            ctx, service=service, subject_id=subject_id
        )
    except CoreError as exc:
        raise http_exception_from_core(exc) from exc


@router.post("/{workspace_id}/connectors/embed/oauth/{service}/authorize-url")
async def embed_oauth_authorize_url(
    workspace_id: str,
    service: str,
    body: EmbedOAuthAuthorizeRequest,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> dict[str, Any]:
    """Build OAuth2 authorize URL; state binds service + end_user subject_id."""
    try:
        ctx = build_workspace_core_context(
            request,
            workspace_id=workspace_id,
            user=user,
            store=store,
            require_editor=True,
        )
        return oauth.build_embed_authorize_url(
            ctx,
            service=service,
            subject_id=body.subject_id,
            redirect_uri=body.redirect_uri,
            connection_config=body.connection_config,
            code_challenge=body.code_challenge,
        )
    except CoreError as exc:
        raise http_exception_from_core(exc) from exc


@router.post("/{workspace_id}/connectors/embed/oauth/{service}/exchange")
async def embed_oauth_exchange(
    workspace_id: str,
    service: str,
    body: ExchangeOAuthCodeRequest,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> dict[str, Any]:
    """Exchange OAuth code; defaults to end_user scope when subject_id is set."""
    try:
        ctx = build_workspace_core_context(
            request,
            workspace_id=workspace_id,
            user=user,
            store=store,
            require_editor=True,
        )
        return oauth.exchange_oauth_code(
            ctx,
            service=service,
            code=body.code,
            redirect_uri=body.redirect_uri,
            code_verifier=body.code_verifier,
            state=body.state,
            connection_name=body.connection_name,
            connection_scope=body.connection_scope,
            subject_id=body.subject_id,
            connection_config=body.connection_config,
        )
    except CoreError as exc:
        raise http_exception_from_core(exc) from exc
