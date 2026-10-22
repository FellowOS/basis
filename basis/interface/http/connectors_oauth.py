"""BOCP connector routes — OAuth client config and token exchange."""

from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends, Request

from basis.domain.integration import get_connector_catalog
from basis.domain.errors import AdminError
from basis.domain.tenancy.admin.store import AdminStore, User
from basis.interface.http.deps import (
    get_current_user,
    get_workspace_for_editor,
    get_knowledge_store,
    get_store,
)
from basis.domain.knowledge.store import KnowledgeStore
from basis.interface.http.connectors_models import (
    BuildOAuthAuthorizeUrlRequest,
    ExchangeOAuthCodeRequest,
    UpsertOAuthConfigRequest,
)
from basis.interface.http.connectors_support import runtime_for

router = APIRouter(tags=["workspaces"])

@router.put("/{workspace_id}/connectors/oauth-configs/{service}")
async def upsert_connector_oauth_config(
    workspace_id: str,
    service: str,
    body: UpsertOAuthConfigRequest,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    """Store encrypted OAuth2 client credentials (`client_id`, `client_secret`) for a connector service."""
    get_workspace_for_editor(request, user, workspace_id, store)
    if not get_connector_catalog().get(service):
        raise AdminError(404, "connector_not_found", f"未知的连接器服务: {service}")
    rt = runtime_for(knowledge)
    saved = rt.vault.upsert_oauth_config(
        workspace_id,
        service,
        client_id=body.client_id,
        client_secret=body.client_secret,
        redirect_uri=body.redirect_uri,
        extra=body.extra,
    )
    return {"oauth_config": saved}


@router.post("/{workspace_id}/connectors/oauth/{service}/authorize-url")
async def build_connector_oauth_authorize_url(
    workspace_id: str,
    service: str,
    body: BuildOAuthAuthorizeUrlRequest,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    """Build an OAuth2 authorization URL (with optional PKCE S256) for a connector service."""
    get_workspace_for_editor(request, user, workspace_id, store)
    rt = runtime_for(knowledge)
    state = body.state or f"bocp_{uuid.uuid4().hex[:16]}"
    try:
        url = rt.vault.build_oauth2_authorize_url(
            workspace_id,
            service,
            state=state,
            redirect_uri=body.redirect_uri,
            connection_config=body.connection_config,
            code_challenge=body.code_challenge,
        )
        return {"authorize_url": url, "state": state}
    except Exception as exc:
        raise AdminError(422, "oauth_authorize_url_failed", str(exc)) from exc


@router.post("/{workspace_id}/connectors/oauth/{service}/exchange")
async def exchange_connector_oauth_code(
    workspace_id: str,
    service: str,
    body: ExchangeOAuthCodeRequest,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    """Exchange an OAuth2 authorization code for tokens and save the encrypted BOCP connection."""
    get_workspace_for_editor(request, user, workspace_id, store)
    rt = runtime_for(knowledge)
    try:
        stored = rt.vault.exchange_oauth2_code(
            workspace_id,
            service,
            code=body.code,
            redirect_uri=body.redirect_uri,
            code_verifier=body.code_verifier,
            connection_name=body.connection_name,
            connection_config=body.connection_config,
        )
        return {"connection": stored.to_public_dict()}
    except Exception as exc:
        raise AdminError(422, "oauth_exchange_failed", str(exc)) from exc
